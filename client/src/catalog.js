export const GOAL_AREAS = { trabalho: 'Trabalho', estudo: 'Estudo', pessoal: 'Vida pessoal', financas: 'Finanças' };

export const ACTIVITY_AREAS = {
  trabalho: 'Trabalho', estudo: 'Estudo', familia: 'Família', saude: 'Saúde', pessoal: 'Pessoal', renda_extra: 'Renda extra',
};

export const CATEGORY_LABELS = {
  perfil: 'Perfil', contexto: 'Contexto', habilidade: 'Habilidades', interesse: 'Interesses',
  rotina: 'Rotina', compromisso: 'Compromissos', financas: 'Finanças',
};

export const KEY_LABELS = {
  'perfil.profissao': 'Profissão',
  'contexto.situacao': 'Contexto pessoal',
  'contexto.bio': 'Bio',
  'contexto.empresa': 'Empresa',
  'contexto.localizacao': 'Localização',
  'habilidade.habilidade': 'Habilidade',
  'interesse.interesse': 'Interesse',
  'rotina.sono_horas_dia': 'Sono (h/dia)',
  'rotina.trabalho_horas_semana': 'Trabalho (h/semana)',
  'rotina.deslocamento_horas_semana': 'Deslocamento (h/semana)',
  'rotina.estudo_horas_semana_desejadas': 'Estudo desejado (h/semana)',
  'rotina.familia_horas_semana_desejadas': 'Família desejada (h/semana)',
  'compromisso.compromisso': 'Compromisso',
  'financas.renda_mensal': 'Renda mensal',
  'financas.despesas_mensais': 'Despesas mensais',
};

export const STATUS_LABELS = { pendente: 'Pendente', confirmada: 'Confirmada', corrigida: 'Corrigida', rejeitada: 'Rejeitada' };

export const keyLabel = (info) => KEY_LABELS[`${info.category}.${info.key}`] ?? info.key;

export const brl = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
export const hours = (n) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;

export function formatValue(info) {
  const v = info.value;
  if (info.category === 'compromisso') return `${v.titulo} · ${ACTIVITY_AREAS[v.area] ?? v.area} · ${hours(v.horasSemana)}/semana`;
  if (info.category === 'financas') return brl(v);
  return String(v);
}

export const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const formatDate = (d) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
