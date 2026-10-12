import { WEEKS_PER_MONTH } from './simulation.js';

const latest = (infos, category, key) => infos
  .filter((i) => i.category === category && i.key === key)
  .sort((a, b) => b.updatedAt - a.updatedAt)[0];

/**
 * Monta a linha de base da simulação a partir das informações validadas e
 * registra cada premissa com a sua origem, para que fique visível na tela.
 */
export function buildBaseline(infos) {
  const premissas = [];

  const value = (category, key, descricao, unidade, fallback) => {
    const info = latest(infos, category, key);
    if (info) {
      premissas.push({ descricao, valor: info.value, unidade, origem: info.origin, informacaoId: info.id, fonte: info.sourceUrl ?? null });
      return Number(info.value);
    }
    premissas.push({
      descricao, valor: fallback, unidade, origem: 'padrao',
      observacao: fallback === null ? 'Não informado' : 'Não informado — valor padrão usado',
    });
    return fallback;
  };

  const sonoHorasDia = value('rotina', 'sono_horas_dia', 'Sono por dia', 'h', 8);
  const trabalhoHorasSemana = value('rotina', 'trabalho_horas_semana', 'Trabalho por semana', 'h', 0);
  const deslocamentoHorasSemana = value('rotina', 'deslocamento_horas_semana', 'Deslocamento por semana', 'h', 0);
  const estudo = value('rotina', 'estudo_horas_semana_desejadas', 'Estudo desejado por semana', 'h', 0);
  const familia = value('rotina', 'familia_horas_semana_desejadas', 'Família desejada por semana', 'h', 0);

  const compromissos = infos
    .filter((i) => i.category === 'compromisso')
    .map((i) => ({ ...i.value, informacaoId: i.id }));
  for (const c of compromissos) {
    premissas.push({ descricao: `Compromisso: ${c.titulo}`, valor: c.horasSemana, unidade: 'h/semana', origem: 'declarada', informacaoId: c.informacaoId });
  }

  const rendaMensal = value('financas', 'renda_mensal', 'Renda mensal', 'R$', null);
  const despesasMensais = value('financas', 'despesas_mensais', 'Despesas mensais', 'R$', null);

  premissas.push(
    { descricao: 'Semana considerada', valor: 168, unidade: 'h', origem: 'padrao' },
    { descricao: 'Semanas por mês', valor: Math.round(WEEKS_PER_MONTH * 100) / 100, unidade: '', origem: 'padrao' },
    { descricao: 'Compromissos e atividades de estudo ou família contam para as metas dessas áreas', valor: null, unidade: '', origem: 'padrao' },
  );

  return {
    baseline: {
      sonoHorasDia, trabalhoHorasSemana, deslocamentoHorasSemana, compromissos,
      metas: { estudo, familia }, rendaMensal, despesasMensais,
    },
    premissas,
  };
}
