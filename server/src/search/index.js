import { braveSearch } from './brave.js';

// Primeiro provedor configurado; null quando nenhum tem chave.
export function getSearchProvider() {
  return [braveSearch].find((p) => p.available()) ?? null;
}

/** Monta a consulta: nome entre aspas + termos que a pessoa escolheu para separar homônimos. */
export function buildQuery(name, terms) {
  return [`"${name.replace(/"/g, '')}"`, terms?.trim()].filter(Boolean).join(' ');
}
