import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBaseline } from '../src/services/baseline.js';
import { compare, simulate } from '../src/services/simulation.js';

const baseline = {
  sonoHorasDia: 7,
  trabalhoHorasSemana: 40,
  deslocamentoHorasSemana: 5,
  compromissos: [{ titulo: 'Academia', area: 'saude', horasSemana: 3 }, { titulo: 'Inglês', area: 'estudo', horasSemana: 2 }],
  metas: { estudo: 6, familia: 14 },
  rendaMensal: 5000,
  despesasMensais: 4200,
};

test('situação atual: horas livres e metas', () => {
  const r = simulate(baseline);
  // 168 - 49 sono - 40 - 5 - 5 compromissos
  assert.equal(r.horas.livre, 69);
  assert.deepEqual(r.metas.map((m) => m.faltando), [4, 14]); // inglês já cobre 2 h de estudo
  assert.equal(r.livreAposMetas, 51);
  assert.equal(r.financas.saldo, 800);
  assert.deepEqual(r.alertas, []);
});

test('renda extra de 4 h semanais reduz o tempo livre e aumenta o saldo', () => {
  const [atual, extra] = compare(baseline, [{
    nome: 'Renda extra',
    atividades: [{ nome: 'Freelance', area: 'renda_extra', horasSemana: 4, rendaMensal: 1000, custoMensal: 0 }],
  }]);
  assert.equal(extra.horas.livre, atual.horas.livre - 4);
  assert.equal(extra.diferenca.livre, -4);
  assert.equal(extra.diferenca.saldo, 1000);
  assert.equal(extra.financas.porAtividade[0].liquidoPorHora, 57.7); // 1000 / (4 * 4,33)
});

test('atividade de estudo conta para a meta de estudo', () => {
  const r = simulate(baseline, { nome: 'Curso', atividades: [{ nome: 'Curso', area: 'estudo', horasSemana: 4 }] });
  assert.equal(r.metas[0].faltando, 0);
  assert.equal(r.livreAposMetas, 51); // as 4 h substituem o que faltava da meta
});

test('alerta quando a semana não fecha', () => {
  const r = simulate({ ...baseline, trabalhoHorasSemana: 100 }, { nome: 'X', atividades: [{ nome: 'Bico', area: 'renda_extra', horasSemana: 10 }] });
  assert.ok(r.horas.livre < 0);
  assert.match(r.alertas[0], /não fecha/);
});

test('sem dados financeiros, finanças fica nula', () => {
  assert.equal(simulate({ ...baseline, rendaMensal: null, despesasMensais: null }).financas, null);
});

test('linha de base usa o valor validado mais recente e registra premissas padrão', () => {
  const infos = [
    { id: 'a', category: 'rotina', key: 'sono_horas_dia', value: 6, origin: 'declarada', updatedAt: new Date('2026-01-01') },
    { id: 'b', category: 'rotina', key: 'sono_horas_dia', value: 7.5, origin: 'declarada', updatedAt: new Date('2026-02-01') },
    { id: 'c', category: 'compromisso', key: 'compromisso', value: { titulo: 'Igreja', area: 'pessoal', horasSemana: 2 }, origin: 'declarada', updatedAt: new Date() },
  ];
  const { baseline: b, premissas } = buildBaseline(infos);
  assert.equal(b.sonoHorasDia, 7.5);
  assert.equal(b.compromissos[0].titulo, 'Igreja');
  assert.equal(b.rendaMensal, null);
  assert.equal(premissas.find((p) => p.descricao === 'Sono por dia').informacaoId, 'b');
  assert.equal(premissas.find((p) => p.descricao === 'Trabalho por semana').origem, 'padrao');
});
