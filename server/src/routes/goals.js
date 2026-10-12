import { Router } from 'express';
import { z } from 'zod';
import { camelize, query } from '../db.js';
import { HttpError, parse } from '../http.js';

const goalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  area: z.enum(['trabalho', 'estudo', 'pessoal', 'financas']),
  priority: z.number().int().min(1).max(3).default(2),
  deadline: z.string().date().nullable().optional(),
  status: z.enum(['ativo', 'concluido', 'abandonado']).optional(),
});

export const goalsRouter = Router();

goalsRouter.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM goals WHERE person_id = $1 ORDER BY status, priority, deadline NULLS LAST, created_at', [req.personId]);
  res.json(rows.map(camelize));
});

goalsRouter.post('/', async (req, res) => {
  const g = parse(goalSchema, req.body);
  const { rows } = await query(
    'INSERT INTO goals (person_id, title, area, priority, deadline) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [req.personId, g.title, g.area, g.priority, g.deadline ?? null],
  );
  res.status(201).json(camelize(rows[0]));
});

goalsRouter.patch('/:id', async (req, res) => {
  const g = parse(goalSchema.partial(), req.body);
  const { rows } = await query(
    `UPDATE goals SET
       title = COALESCE($3, title), area = COALESCE($4, area), priority = COALESCE($5, priority),
       deadline = CASE WHEN $6::boolean THEN $7::date ELSE deadline END,
       status = COALESCE($8, status), updated_at = now()
     WHERE id = $1 AND person_id = $2 RETURNING *`,
    [req.params.id, req.personId, g.title ?? null, g.area ?? null, g.priority ?? null, 'deadline' in g, g.deadline ?? null, g.status ?? null],
  );
  if (!rows[0]) throw new HttpError(404, 'Objetivo não encontrado');
  res.json(camelize(rows[0]));
});

goalsRouter.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM goals WHERE id = $1 AND person_id = $2', [req.params.id, req.personId]);
  if (!rowCount) throw new HttpError(404, 'Objetivo não encontrado');
  res.status(204).end();
});
