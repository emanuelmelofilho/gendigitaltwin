import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../http.js';
import {
  createDeclaredItem, informationHistory, listInformations, removeValidated,
  reviewInformation, updateValidated, upsertDeclaredSingle,
} from '../services/informations.js';

const STATUSES = ['pendente', 'confirmada', 'corrigida', 'rejeitada'];
const ref = { category: z.string().min(1).max(40), key: z.string().min(1).max(60) };
const noteSchema = z.string().trim().max(500).optional();

export const informationsRouter = Router();

informationsRouter.get('/', async (req, res) => {
  const { status, category } = parse(z.object({
    status: z.string().optional().transform((s) => (s ? s.split(',') : undefined)).pipe(z.array(z.enum(STATUSES)).optional()),
    category: z.string().optional(),
  }), req.query);
  res.json(await listInformations(req.personId, { statuses: status, category }));
});

// Item de lista declarado (habilidade, interesse, compromisso)
informationsRouter.post('/', async (req, res) => {
  const body = parse(z.object({ ...ref, value: z.unknown() }), req.body);
  res.status(201).json(await createDeclaredItem(req.personId, body));
});

// Valor único declarado (profissão, horas de sono, renda...). value null remove.
informationsRouter.put('/declared', async (req, res) => {
  const body = parse(z.object({ ...ref, value: z.unknown() }), req.body);
  res.json(await upsertDeclaredSingle(req.personId, { ...body, value: body.value ?? null }));
});

informationsRouter.patch('/:id', async (req, res) => {
  const body = parse(z.object({ value: z.unknown(), note: noteSchema }), req.body);
  res.json(await updateValidated(req.personId, req.params.id, body));
});

informationsRouter.delete('/:id', async (req, res) => {
  await removeValidated(req.personId, req.params.id);
  res.status(204).end();
});

informationsRouter.post('/:id/review', async (req, res) => {
  const body = parse(z.object({
    action: z.enum(['confirmar', 'corrigir', 'rejeitar']),
    value: z.unknown().optional(),
    note: noteSchema,
  }), req.body);
  res.json(await reviewInformation(req.personId, req.params.id, body));
});

informationsRouter.get('/:id/history', async (req, res) => {
  res.json(await informationHistory(req.personId, req.params.id));
});
