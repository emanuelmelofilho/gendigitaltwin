import { Router } from 'express';
import { z } from 'zod';
import { AREAS } from '../catalog.js';
import { parse } from '../http.js';
import { buildBaseline } from '../services/baseline.js';
import { listEffective } from '../services/informations.js';
import { compare } from '../services/simulation.js';

const scenarioSchema = z.object({
  nome: z.string().trim().min(1).max(60),
  atividades: z.array(z.object({
    nome: z.string().trim().min(1).max(80),
    area: z.enum(AREAS),
    horasSemana: z.number().min(0).max(112),
    rendaMensal: z.number().min(0).max(1e9).default(0),
    custoMensal: z.number().min(0).max(1e9).default(0),
  })).max(10),
});

export const scenariosRouter = Router();

scenariosRouter.get('/baseline', async (req, res) => {
  res.json(buildBaseline(await listEffective(req.personId)));
});

scenariosRouter.post('/simulate', async (req, res) => {
  const { cenarios } = parse(z.object({ cenarios: z.array(scenarioSchema).max(3) }), req.body);
  const { baseline, premissas } = buildBaseline(await listEffective(req.personId));
  res.json({ premissas, resultados: compare(baseline, cenarios) });
});
