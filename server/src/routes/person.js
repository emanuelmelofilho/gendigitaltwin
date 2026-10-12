import { Router } from 'express';
import { z } from 'zod';
import { camelize, query } from '../db.js';
import { parse } from '../http.js';

const AREAS = ['trabalho', 'estudo', 'pessoal', 'financas'];

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  purpose: z.object({
    areas: z.array(z.enum(AREAS)).max(AREAS.length),
    decisoes: z.array(z.string().trim().min(1).max(300)).max(20),
  }).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
  onboardingStep: z.number().int().min(1).max(6).optional(),
});

export const personRouter = Router();

personRouter.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM persons WHERE id = $1', [req.personId]);
  const { userId, ...person } = camelize(rows[0]);
  res.json(person);
});

personRouter.patch('/', async (req, res) => {
  const body = parse(patchSchema, req.body);
  const { rows } = await query(
    `UPDATE persons SET
       name = COALESCE($2, name),
       purpose = COALESCE($3, purpose),
       preferences = COALESCE($4, preferences),
       onboarding_step = GREATEST(onboarding_step, COALESCE($5, onboarding_step)),
       updated_at = now()
     WHERE id = $1 RETURNING *`,
    [
      req.personId, body.name ?? null,
      body.purpose ? JSON.stringify(body.purpose) : null,
      body.preferences ? JSON.stringify(body.preferences) : null,
      body.onboardingStep ?? null,
    ],
  );
  const { userId, ...person } = camelize(rows[0]);
  res.json(person);
});
