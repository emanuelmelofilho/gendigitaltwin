import { dedupeKey, keyDef, validateValue } from '../catalog.js';
import { camelize, query, tx } from '../db.js';
import { HttpError } from '../http.js';

const EFFECTIVE = ['confirmada', 'corrigida'];

const SELECT_INFO = `
  SELECT i.*, s.url AS source_url, s.collected_at AS source_collected_at
    FROM informations i
    LEFT JOIN sources s ON s.id = i.source_id`;

export async function listInformations(personId, { statuses, category } = {}) {
  const { rows } = await query(
    `${SELECT_INFO}
      WHERE i.person_id = $1
        AND ($2::text[] IS NULL OR i.status = ANY($2))
        AND ($3::text IS NULL OR i.category = $3)
      ORDER BY i.category, i.created_at`,
    [personId, statuses ?? null, category ?? null],
  );
  return rows.map(camelize);
}

export const listEffective = (personId) => listInformations(personId, { statuses: EFFECTIVE });

async function addVersion(db, informationId, value, status, actor, note) {
  await db.query(
    'INSERT INTO information_versions (information_id, value, status, actor, note) VALUES ($1, $2, $3, $4, $5)',
    [informationId, JSON.stringify(value), status, actor, note],
  );
}

export async function insertInformation(db, { personId, category, key, value, origin, sourceId = null, evidence = null, confidence = null, status, actor, note }) {
  const { rows } = await db.query(
    `INSERT INTO informations (person_id, category, key, value, origin, source_id, evidence, confidence, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [personId, category, key, JSON.stringify(value), origin, sourceId, evidence, confidence, status],
  );
  await addVersion(db, rows[0].id, value, status, actor, note);
  return camelize(rows[0]);
}

async function setInformation(db, id, { value, status, note }) {
  const { rows } = await db.query(
    'UPDATE informations SET value = $2, status = $3, updated_at = now() WHERE id = $1 RETURNING *',
    [id, JSON.stringify(value), status],
  );
  await addVersion(db, id, value, status, 'pessoa', note);
  return camelize(rows[0]);
}

async function getOwnedForUpdate(db, personId, id) {
  const { rows } = await db.query('SELECT * FROM informations WHERE id = $1 AND person_id = $2 FOR UPDATE', [id, personId]);
  if (!rows[0]) throw new HttpError(404, 'Informação não encontrada');
  return camelize(rows[0]);
}

/** Cria um item de lista declarado pela pessoa (habilidade, interesse, compromisso). */
export async function createDeclaredItem(personId, { category, key, value }) {
  if (keyDef(category, key).single) throw new HttpError(400, 'Use a atualização de valor único para esta chave');
  const parsed = validateValue(category, key, value);
  return tx(async (db) => {
    const { rows } = await db.query(
      `SELECT category, key, value FROM informations
        WHERE person_id = $1 AND category = $2 AND key = $3 AND status IN ('confirmada', 'corrigida')`,
      [personId, category, key],
    );
    const target = dedupeKey(category, key, parsed);
    if (rows.some((r) => dedupeKey(r.category, r.key, r.value) === target)) {
      throw new HttpError(409, 'Esta informação já está no seu perfil');
    }
    return insertInformation(db, {
      personId, category, key, value: parsed, origin: 'declarada', status: 'confirmada', actor: 'pessoa', note: 'Informada pela pessoa',
    });
  });
}

/**
 * Define o valor declarado de uma chave única. Atualiza a declaração anterior (gerando versão)
 * em vez de criar outra; `value === null` remove a declaração.
 */
export async function upsertDeclaredSingle(personId, { category, key, value }) {
  if (!keyDef(category, key).single) throw new HttpError(400, 'Esta chave aceita vários itens');
  const parsed = value === null ? null : validateValue(category, key, value);
  return tx(async (db) => {
    const { rows } = await db.query(
      `SELECT * FROM informations
        WHERE person_id = $1 AND category = $2 AND key = $3 AND origin = 'declarada' AND status = 'confirmada'
        ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
      [personId, category, key],
    );
    const existing = rows[0] && camelize(rows[0]);
    if (parsed === null) {
      if (existing) await setInformation(db, existing.id, { value: existing.value, status: 'rejeitada', note: 'Removida pela pessoa' });
      return null;
    }
    if (existing) {
      if (JSON.stringify(existing.value) === JSON.stringify(parsed)) return existing;
      return setInformation(db, existing.id, { value: parsed, status: 'confirmada', note: 'Atualizada pela pessoa' });
    }
    return insertInformation(db, {
      personId, category, key, value: parsed, origin: 'declarada', status: 'confirmada', actor: 'pessoa', note: 'Informada pela pessoa',
    });
  });
}

/** Edição posterior de uma informação já validada (registro de mudança — etapa 6). */
export async function updateValidated(personId, id, { value, note }) {
  return tx(async (db) => {
    const info = await getOwnedForUpdate(db, personId, id);
    if (!EFFECTIVE.includes(info.status)) throw new HttpError(409, 'Só é possível editar informações validadas');
    const parsed = validateValue(info.category, info.key, value);
    // Uma informação extraída que a pessoa altera passa a ser "corrigida"; a origem é preservada.
    const status = info.origin === 'extraida' ? 'corrigida' : 'confirmada';
    return setInformation(db, id, { value: parsed, status, note: note || 'Atualizada pela pessoa' });
  });
}

export async function removeValidated(personId, id, note) {
  return tx(async (db) => {
    const info = await getOwnedForUpdate(db, personId, id);
    if (!EFFECTIVE.includes(info.status)) throw new HttpError(409, 'Esta informação não está ativa');
    return setInformation(db, id, { value: info.value, status: 'rejeitada', note: note || 'Removida pela pessoa' });
  });
}

const REVIEW_STATUS = { confirmar: 'confirmada', corrigir: 'corrigida', rejeitar: 'rejeitada' };
const REVIEW_NOTE = { confirmar: 'Confirmada na revisão', corrigir: 'Corrigida na revisão', rejeitar: 'Rejeitada na revisão' };

/** Revisão de uma informação pendente (etapa 5). */
export async function reviewInformation(personId, id, { action, value, note }) {
  return tx(async (db) => {
    const info = await getOwnedForUpdate(db, personId, id);
    if (info.status !== 'pendente') throw new HttpError(409, 'Esta informação já foi revisada');
    let newValue = info.value;
    if (action === 'corrigir') {
      if (value === undefined) throw new HttpError(400, 'Informe o valor corrigido');
      newValue = validateValue(info.category, info.key, value);
    }
    await db.query(
      'INSERT INTO reviews (information_id, action, previous_value, new_value, note) VALUES ($1, $2, $3, $4, $5)',
      [id, action, JSON.stringify(info.value), action === 'corrigir' ? JSON.stringify(newValue) : null, note ?? null],
    );
    const fullNote = note ? `${REVIEW_NOTE[action]}: ${note}` : REVIEW_NOTE[action];
    return setInformation(db, id, { value: newValue, status: REVIEW_STATUS[action], note: fullNote });
  });
}

export async function informationHistory(personId, id) {
  const owned = await query('SELECT 1 FROM informations WHERE id = $1 AND person_id = $2', [id, personId]);
  if (!owned.rowCount) throw new HttpError(404, 'Informação não encontrada');
  const [versions, reviews] = await Promise.all([
    query('SELECT * FROM information_versions WHERE information_id = $1 ORDER BY id', [id]),
    query('SELECT * FROM reviews WHERE information_id = $1 ORDER BY created_at', [id]),
  ]);
  return { versions: versions.rows.map(camelize), reviews: reviews.rows.map(camelize) };
}
