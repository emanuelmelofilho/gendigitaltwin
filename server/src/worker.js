import { dedupeKey, KEYS } from './catalog.js';
import { collectSource } from './collect/collectSource.js';
import { PermanentError } from './collect/errors.js';
import { query, tx } from './db.js';
import { getExtractor } from './extract/index.js';
import { claimNext, complete, fail, requeueStale } from './jobs.js';
import { getSearchProvider } from './search/index.js';
import { insertInformation } from './services/informations.js';
import { insertSuggestions } from './services/suggestions.js';

const POLL_MS = 1_000;
// Máximo de achados novos por coleta, contados depois de descartar o que a pessoa já tem.
const MAX_NEW_FINDINGS = 30;
const extractor = getExtractor();
const searchProvider = getSearchProvider();

async function collectAndExtract({ sourceId }) {
  const { rows } = await query(`UPDATE sources SET status = 'coletando', error = NULL WHERE id = $1 RETURNING *`, [sourceId]);
  const source = rows[0];
  if (!source) return;

  const collected = await collectSource(source);
  const findings = await extractor.extract({ source, collected });

  await tx(async (db) => {
    // Inclui informações rejeitadas: o que a pessoa já recusou não é sugerido de novo.
    const existing = await db.query('SELECT category, key, value FROM informations WHERE person_id = $1', [source.person_id]);
    const seen = new Set(existing.rows.map((r) => dedupeKey(r.category, r.key, r.value)));
    let added = 0;
    for (const f of findings) {
      if (added >= MAX_NEW_FINDINGS) break;
      const def = KEYS[`${f.category}.${f.key}`];
      const parsed = def?.schema.safeParse(f.value);
      if (!parsed?.success) continue;
      const k = dedupeKey(f.category, f.key, parsed.data);
      if (seen.has(k)) continue;
      seen.add(k);
      await insertInformation(db, {
        personId: source.person_id, category: f.category, key: f.key, value: parsed.data,
        origin: 'extraida', sourceId: source.id, evidence: f.evidence, evidenceUrl: f.evidenceUrl ?? null, confidence: f.confidence,
        status: 'pendente', actor: 'sistema', note: `Extraída de ${source.url} (${extractor.name})`,
      });
      added += 1;
    }
    await insertSuggestions(db, source.person_id, collected.suggestions, { via: 'pagina', fromSourceId: source.id });
    await db.query(
      `UPDATE sources SET status = 'coletada', collected_at = now(), title = COALESCE($2, title), pages = $3 WHERE id = $1`,
      [source.id, collected.title, JSON.stringify(collected.pages.map((p) => p.url))],
    );
  });
}

async function searchByName({ searchId }) {
  const { rows } = await query(`UPDATE searches SET status = 'executando', error = NULL WHERE id = $1 RETURNING *`, [searchId]);
  const search = rows[0];
  if (!search) return;
  if (!searchProvider) throw new PermanentError('Nenhum buscador configurado');
  const results = await searchProvider.search(search.query);
  await tx(async (db) => {
    const inserted = await insertSuggestions(db, search.person_id, results, { via: 'busca', searchId });
    await db.query(`UPDATE searches SET status = 'concluida', results_count = $2, finished_at = now() WHERE id = $1`, [searchId, inserted]);
  });
}

const handlers = { coletar_fonte: collectAndExtract, buscar_nome: searchByName };

async function runJob(job) {
  try {
    const handler = handlers[job.type];
    if (!handler) throw new PermanentError(`Tipo de job desconhecido: ${job.type}`);
    await handler(job.payload);
    await complete(job.id);
    console.log(`job ${job.id} (${job.type}) concluído`);
  } catch (err) {
    const final = await fail(job, err, { permanent: err instanceof PermanentError });
    console.warn(`job ${job.id} (${job.type}) falhou${final ? ' definitivamente' : ', nova tentativa agendada'}: ${err.message}`);
    if (job.type === 'coletar_fonte') {
      await query('UPDATE sources SET status = $2, error = $3 WHERE id = $1', [job.payload.sourceId, final ? 'erro' : 'pendente', err.message]);
    } else if (job.type === 'buscar_nome') {
      await query('UPDATE searches SET status = $2, error = $3, finished_at = now() WHERE id = $1', [job.payload.searchId, final ? 'erro' : 'pendente', err.message]);
    }
  }
}

let running = true;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { running = false; });

console.log(`worker iniciado (extrator: ${extractor.name}; busca por nome: ${searchProvider?.name ?? 'desativada'})`);
await requeueStale();
while (running) {
  const job = await claimNext().catch((err) => { console.error(err.message); return null; });
  if (job) await runJob(job);
  else await new Promise((r) => setTimeout(r, POLL_MS));
}
process.exit(0);
