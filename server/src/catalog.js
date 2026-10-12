import { z } from 'zod';
import { HttpError } from './http.js';

// Áreas usadas em compromissos e atividades de cenário
export const AREAS = ['trabalho', 'estudo', 'familia', 'saude', 'pessoal', 'renda_extra'];

const text = z.string().trim().min(1).max(500);
const hours = (max) => z.number().min(0).max(max);
const money = z.number().min(0).max(1e9);

/**
 * Chaves aceitas para Informação. `single`: a pessoa tem um valor vigente por chave
 * (o mais recente entre as informações confirmadas). Demais chaves são listas.
 */
export const KEYS = {
  'perfil.profissao': { single: true, schema: text },
  'contexto.situacao': { single: true, schema: z.string().trim().min(1).max(2000) },
  'contexto.bio': { single: true, schema: z.string().trim().min(1).max(2000) },
  'contexto.empresa': { single: true, schema: text },
  'contexto.localizacao': { single: true, schema: text },
  'habilidade.habilidade': { single: false, schema: text },
  'interesse.interesse': { single: false, schema: text },
  'rotina.sono_horas_dia': { single: true, schema: hours(16) },
  'rotina.trabalho_horas_semana': { single: true, schema: hours(100) },
  'rotina.deslocamento_horas_semana': { single: true, schema: hours(60) },
  'rotina.estudo_horas_semana_desejadas': { single: true, schema: hours(80) },
  'rotina.familia_horas_semana_desejadas': { single: true, schema: hours(100) },
  'compromisso.compromisso': {
    single: false,
    schema: z.object({
      titulo: text,
      area: z.enum(AREAS),
      horasSemana: hours(100),
    }),
  },
  'financas.renda_mensal': { single: true, schema: money },
  'financas.despesas_mensais': { single: true, schema: money },
};

export function keyDef(category, key) {
  const def = KEYS[`${category}.${key}`];
  if (!def) throw new HttpError(400, `Chave desconhecida: ${category}.${key}`);
  return def;
}

export function validateValue(category, key, value) {
  const result = keyDef(category, key).schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(400, 'Valor inválido', result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return result.data;
}

/** Chave usada para detectar duplicatas ("React" e "react" são a mesma habilidade). */
export function dedupeKey(category, key, value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : JSON.stringify(value);
  return `${category}|${key}|${v}`;
}
