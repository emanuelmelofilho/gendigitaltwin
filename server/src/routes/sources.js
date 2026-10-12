import { Router } from 'express';
import { z } from 'zod';
import { camelize, query, tx } from '../db.js';
import { HttpError, parse } from '../http.js';
import { enqueue } from '../jobs.js';

const SELECT_SOURCES = `
  SELECT s.*,
         count(i.id)::int AS findings_count,
         (count(i.id) FILTER (WHERE i.status = 'pendente'))::int AS pending_count
    FROM sources s
    LEFT JOIN informations i ON i.source_id = s.id
   WHERE s.person_id = $1`;

function normalizeUrl(raw) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(400, 'Link inválido');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new HttpError(400, 'Use um link http ou https');
  url.hash = '';
  return url;
}

export const sourcesRouter = Router();

sourcesRouter.get('/', async (req, res) => {
  const { rows } = await query(`${SELECT_SOURCES} GROUP BY s.id ORDER BY s.created_at DESC`, [req.personId]);
  res.json(rows.map(camelize));
});

sourcesRouter.post('/', async (req, res) => {
  const body = parse(z.object({
    url: z.string().min(1).max(2000),
    consent: z.literal(true, { errorMap: () => ({ message: 'É preciso autorizar a consulta' }) }),
  }), req.body);
  const url = normalizeUrl(body.url);
  const kind = ['github.com', 'www.github.com'].includes(url.hostname) ? 'github' : 'pagina';

  const source = await tx(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO sources (person_id, url, kind, consented_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (person_id, url) DO NOTHING RETURNING *`,
      [req.personId, url.href, kind],
    );
    if (!rows[0]) throw new HttpError(409, 'Esta fonte já foi adicionada');
    await enqueue(db, 'coletar_fonte', { sourceId: rows[0].id });
    return rows[0];
  });
  res.status(201).json({ ...camelize(source), findingsCount: 0, pendingCount: 0 });
});

sourcesRouter.post('/:id/retry', async (req, res) => {
  await tx(async (db) => {
    const { rows } = await db.query(
      `UPDATE sources SET status = 'pendente', error = NULL
        WHERE id = $1 AND person_id = $2 AND status IN ('erro', 'coletada') RETURNING id`,
      [req.params.id, req.personId],
    );
    if (!rows[0]) throw new HttpError(409, 'A fonte já está na fila de coleta');
    await enqueue(db, 'coletar_fonte', { sourceId: rows[0].id });
  });
  res.status(202).json({ ok: true });
});
