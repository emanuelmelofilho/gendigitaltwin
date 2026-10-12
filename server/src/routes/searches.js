import { Router } from 'express';
import { z } from 'zod';
import { camelize, query, tx } from '../db.js';
import { HttpError, parse } from '../http.js';
import { enqueue } from '../jobs.js';
import { buildQuery, getSearchProvider } from '../search/index.js';

const DAILY_LIMIT = 5;

export const searchesRouter = Router();

searchesRouter.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM searches WHERE person_id = $1 ORDER BY created_at DESC LIMIT 10', [req.personId]);
  res.json({ available: Boolean(getSearchProvider()), searches: rows.map(camelize) });
});

searchesRouter.post('/', async (req, res) => {
  const { terms } = parse(z.object({
    terms: z.string().trim().max(200).optional(),
    consent: z.literal(true, { errorMap: () => ({ message: 'É preciso autorizar a busca' }) }),
  }), req.body);
  const provider = getSearchProvider();
  if (!provider) throw new HttpError(503, 'Busca por nome desativada: defina BRAVE_SEARCH_API_KEY no .env');

  const search = await tx(async (db) => {
    const { rows: [person] } = await db.query('SELECT name FROM persons WHERE id = $1 FOR UPDATE', [req.personId]);
    if (!person.name) throw new HttpError(400, 'Informe seu nome no perfil antes de buscar');
    const { rows: [stats] } = await db.query(
      `SELECT count(*) FILTER (WHERE status IN ('pendente', 'executando'))::int AS running,
              count(*) FILTER (WHERE created_at > now() - interval '1 day')::int AS today
         FROM searches WHERE person_id = $1`,
      [req.personId],
    );
    if (stats.running) throw new HttpError(409, 'Já existe uma busca em andamento');
    if (stats.today >= DAILY_LIMIT) throw new HttpError(429, `Limite de ${DAILY_LIMIT} buscas por dia atingido`);
    const { rows } = await db.query(
      `INSERT INTO searches (person_id, query, provider, consented_at) VALUES ($1, $2, $3, now()) RETURNING *`,
      [req.personId, buildQuery(person.name, terms), provider.name],
    );
    await enqueue(db, 'buscar_nome', { searchId: rows[0].id });
    return rows[0];
  });
  res.status(201).json(camelize(search));
});
