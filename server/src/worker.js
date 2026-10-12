import { dedupeKey, KEYS } from './catalog.js';
import { collectSource } from './collect/collectSource.js';
import { PermanentError } from './collect/errors.js';
import { query, tx } from './db.js';
import { getExtractor } from './extract/index.js';
import { claimNext, complete, fail, requeueStale } from './jobs.js';
import { insertInformation } from './services/informations.js';

const POLL_MS = 1_000;
const extractor = getExtractor();

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
    for (const f of findings) {
      const def = KEYS[`${f.category}.${f.key}`];
      const parsed = def?.schema.safeParse(f.value);
      if (!parsed?.success) continue;
      const k = dedupeKey(f.category, f.key, parsed.data);
      if (seen.has(k)) continue;
      seen.add(k);
      await insertInformation(db, {
        personId: source.person_id, category: f.category, key: f.key, value: parsed.data,
        origin: 'extraida', sourceId: source.id, evidence: f.evidence, confidence: f.confidence,
        status: 'pendente', actor: 'sistema', note: `Extraída de ${source.url} (${extractor.name})`,
      });
    }
    await db.query(`UPDATE sources SET status = 'coletada', collected_at = now(), title = $2 WHERE id = $1`, [source.id, collected.title]);
  });
}

const handlers = { coletar_fonte: collectAndExtract };

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
    }
  }
}

let running = true;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { running = false; });

console.log(`worker iniciado (extrator: ${extractor.name})`);
await requeueStale();
while (running) {
  const job = await claimNext().catch((err) => { console.error(err.message); return null; });
  if (job) await runJob(job);
  else await new Promise((r) => setTimeout(r, POLL_MS));
}
process.exit(0);
