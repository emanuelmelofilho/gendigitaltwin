import { Router } from 'express';
import { z } from 'zod';
import { camelize, query } from '../db.js';
import { HttpError, parse } from '../http.js';

const decisionSchema = z.object({
  title: z.string().trim().min(1).max(200),
  context: z.string().trim().max(2000).optional(),
  alternatives: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  chosen: z.string().trim().min(1).max(200),
  rationale: z.string().trim().max(2000).optional(),
  // Instantâneo da simulação (premissas + resultados) no momento da decisão
  simulation: z.record(z.string(), z.unknown()).optional(),
});

const outcomeSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  observedAt: z.string().date().optional(),
  metrics: z.object({
    horasLivresSemana: z.number().min(-168).max(168).optional(),
    rendaExtraMensal: z.number().min(0).max(1e9).optional(),
    saldoMensal: z.number().min(-1e9).max(1e9).optional(),
  }).default({}),
});

export const decisionsRouter = Router();

decisionsRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT d.*, COALESCE(
              jsonb_agg(to_jsonb(o) - 'decision_id' ORDER BY o.observed_at, o.created_at) FILTER (WHERE o.id IS NOT NULL),
              '[]') AS outcomes
       FROM decisions d
       LEFT JOIN outcomes o ON o.decision_id = d.id
      WHERE d.person_id = $1
      GROUP BY d.id
      ORDER BY d.decided_at DESC`,
    [req.personId],
  );
  res.json(rows.map((r) => ({ ...camelize(r), outcomes: r.outcomes.map(camelize) })));
});

decisionsRouter.post('/', async (req, res) => {
  const d = parse(decisionSchema, req.body);
  const { rows } = await query(
    `INSERT INTO decisions (person_id, title, context, alternatives, chosen, rationale, simulation)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.personId, d.title, d.context ?? null, JSON.stringify(d.alternatives), d.chosen, d.rationale ?? null, d.simulation ? JSON.stringify(d.simulation) : null],
  );
  res.status(201).json({ ...camelize(rows[0]), outcomes: [] });
});

decisionsRouter.post('/:id/outcomes', async (req, res) => {
  const o = parse(outcomeSchema, req.body);
  const owned = await query('SELECT 1 FROM decisions WHERE id = $1 AND person_id = $2', [req.params.id, req.personId]);
  if (!owned.rowCount) throw new HttpError(404, 'Decisão não encontrada');
  const { rows } = await query(
    `INSERT INTO outcomes (decision_id, description, metrics, observed_at)
     VALUES ($1, $2, $3, COALESCE($4::date, current_date)) RETURNING *`,
    [req.params.id, o.description, JSON.stringify(o.metrics), o.observedAt ?? null],
  );
  res.status(201).json(camelize(rows[0]));
});
