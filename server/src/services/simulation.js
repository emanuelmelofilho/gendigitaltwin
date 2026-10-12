export const HOURS_PER_WEEK = 168;
export const WEEKS_PER_MONTH = 52 / 12;
// Abaixo disso o cenário é sinalizado como apertado: menos de 1 h livre por dia.
const TIGHT_FREE_HOURS = 7;

const round = (n) => Math.round(n * 10) / 10;
const sum = (items, field) => items.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
const fmt = (n) => round(n).toLocaleString('pt-BR');

/**
 * @typedef {{ nome: string, area: string, horasSemana: number, rendaMensal?: number, custoMensal?: number }} Atividade
 * @typedef {{
 *   sonoHorasDia: number, trabalhoHorasSemana: number, deslocamentoHorasSemana: number,
 *   compromissos: { titulo: string, area: string, horasSemana: number }[],
 *   metas: { estudo: number, familia: number },
 *   rendaMensal: number | null, despesasMensais: number | null,
 * }} Baseline
 */

/**
 * Estima a semana e o mês de uma pessoa ao adicionar atividades à rotina atual.
 * @param {Baseline} baseline
 * @param {{ nome: string, atividades?: Atividade[] }} [scenario]
 */
export function simulate(baseline, scenario = { nome: 'Situação atual', atividades: [] }) {
  const atividades = scenario.atividades ?? [];
  const scheduled = [...baseline.compromissos, ...atividades];

  const horas = {
    total: HOURS_PER_WEEK,
    sono: baseline.sonoHorasDia * 7,
    trabalho: baseline.trabalhoHorasSemana,
    deslocamento: baseline.deslocamentoHorasSemana,
    compromissos: sum(baseline.compromissos, 'horasSemana'),
    atividades: sum(atividades, 'horasSemana'),
  };
  horas.livre = HOURS_PER_WEEK - horas.sono - horas.trabalho - horas.deslocamento - horas.compromissos - horas.atividades;

  // Compromissos e atividades da própria área contam para a meta; o que faltar sai do tempo livre.
  const metas = ['estudo', 'familia'].map((area) => {
    const desejado = baseline.metas[area] ?? 0;
    const agendado = sum(scheduled.filter((s) => s.area === area), 'horasSemana');
    return { area, desejado, agendado: round(agendado), faltando: round(Math.max(0, desejado - agendado)) };
  });
  const livreAposMetas = horas.livre - sum(metas, 'faltando');

  const hasMoney = baseline.rendaMensal !== null || baseline.despesasMensais !== null
    || atividades.some((a) => a.rendaMensal || a.custoMensal);
  let financas = null;
  if (hasMoney) {
    const renda = (baseline.rendaMensal ?? 0) + sum(atividades, 'rendaMensal');
    const despesas = (baseline.despesasMensais ?? 0) + sum(atividades, 'custoMensal');
    financas = {
      renda: round(renda),
      despesas: round(despesas),
      saldo: round(renda - despesas),
      porAtividade: atividades
        .filter((a) => a.rendaMensal || a.custoMensal)
        .map((a) => {
          const horasMes = a.horasSemana * WEEKS_PER_MONTH;
          const liquido = (a.rendaMensal ?? 0) - (a.custoMensal ?? 0);
          return { nome: a.nome, liquidoMensal: round(liquido), liquidoPorHora: horasMes > 0 ? round(liquido / horasMes) : null };
        }),
    };
  }

  const alertas = [];
  if (horas.livre < 0) {
    alertas.push(`A semana não fecha: faltam ${fmt(-horas.livre)} h.`);
  } else if (livreAposMetas < 0) {
    alertas.push(`Não sobra tempo para as metas de estudo e família: faltam ${fmt(-livreAposMetas)} h por semana.`);
  } else if (livreAposMetas < TIGHT_FREE_HOURS) {
    alertas.push('Depois das metas, sobra menos de 1 h livre por dia.');
  }
  if (financas && financas.saldo < 0) alertas.push('As despesas superam a renda no mês.');

  return {
    nome: scenario.nome,
    atividades,
    horas: Object.fromEntries(Object.entries(horas).map(([k, v]) => [k, round(v)])),
    metas,
    livreAposMetas: round(livreAposMetas),
    financas,
    alertas,
  };
}

/** Compara a situação atual com cada cenário, incluindo a diferença em relação a ela. */
export function compare(baseline, scenarios) {
  const atual = simulate(baseline);
  return [
    atual,
    ...scenarios.map((s) => {
      const r = simulate(baseline, s);
      return {
        ...r,
        diferenca: {
          livre: round(r.horas.livre - atual.horas.livre),
          livreAposMetas: round(r.livreAposMetas - atual.livreAposMetas),
          saldo: r.financas && atual.financas ? round(r.financas.saldo - atual.financas.saldo) : r.financas?.saldo ?? null,
        },
      };
    }),
  ];
}
