import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { ACTIVITY_AREAS, brl, hostOf, hours } from '../catalog.js';
import { ErrorMsg, useAction } from '../components/ui.jsx';
import { useResource } from '../hooks.js';

const newActivity = () => ({ nome: '', area: 'renda_extra', horasSemana: 4, rendaMensal: 0, custoMensal: 0 });
const INITIAL = [{ nome: 'Renda extra', atividades: [{ ...newActivity(), nome: 'Trabalho extra' }] }];
const ORIGIN = { declarada: 'informada por você', extraida: 'fonte externa', padrao: 'padrão' };

const SEGMENTS = [
  ['sono', 'Sono'], ['trabalho', 'Trabalho'], ['deslocamento', 'Deslocamento'],
  ['compromissos', 'Compromissos'], ['atividades', 'Cenário'], ['livre', 'Livre'],
];

function WeekBar({ horas }) {
  return (
    <div className="weekbar" role="img" aria-label="Distribuição das 168 horas da semana">
      {SEGMENTS.map(([k, label]) => horas[k] > 0 && (
        <span key={k} className={`seg ${k}`} style={{ flexGrow: horas[k] }} title={`${label}: ${hours(horas[k])}`} />
      ))}
    </div>
  );
}

const signed = (n, fmt) => (n === null || n === undefined || n === 0 ? '' : ` (${n > 0 ? '+' : '−'}${fmt(Math.abs(n))})`);

function Results({ resultados }) {
  const cols = resultados;
  const row = (label, render) => (
    <tr><th scope="row">{label}</th>{cols.map((r) => <td key={r.nome}>{render(r)}</td>)}</tr>
  );
  const meta = (area) => (r) => {
    const m = r.metas.find((x) => x.area === area);
    if (!m.desejado) return <span className="muted">sem meta</span>;
    return m.faltando > 0 ? `${hours(m.agendado)} agendadas, faltam ${hours(m.faltando)}` : `${hours(m.agendado)} agendadas ✓`;
  };
  return (
    <div className="table-wrap">
      <table className="compare">
        <thead><tr><th />{cols.map((r) => <th key={r.nome} scope="col">{r.nome}</th>)}</tr></thead>
        <tbody>
          {row('Semana', (r) => <WeekBar horas={r.horas} />)}
          {row('Horas livres', (r) => <strong>{hours(r.horas.livre)}{signed(r.diferenca?.livre, hours)}</strong>)}
          {row('Meta de estudo', meta('estudo'))}
          {row('Meta de família', meta('familia'))}
          {row('Livre após as metas', (r) => <strong className={r.livreAposMetas < 0 ? 'neg' : ''}>{hours(r.livreAposMetas)}{signed(r.diferenca?.livreAposMetas, hours)}</strong>)}
          {row('Renda mensal', (r) => (r.financas ? brl(r.financas.renda) : <span className="muted">não informada</span>))}
          {row('Despesas mensais', (r) => (r.financas ? brl(r.financas.despesas) : '—'))}
          {row('Saldo mensal', (r) => (r.financas ? <strong className={r.financas.saldo < 0 ? 'neg' : ''}>{brl(r.financas.saldo)}{signed(r.diferenca?.saldo, brl)}</strong> : '—'))}
          {row('Ganho por hora', (r) => r.financas?.porAtividade.map((a) => <div key={a.nome}>{a.nome}: {a.liquidoPorHora === null ? '—' : brl(a.liquidoPorHora)}</div>) ?? '—')}
          {row('Alertas', (r) => (r.alertas.length ? r.alertas.map((a) => <div key={a} className="warn">{a}</div>) : <span className="muted">nenhum</span>))}
        </tbody>
      </table>
      <div className="legend">{SEGMENTS.map(([k, l]) => <span key={k}><i className={`seg ${k}`} />{l}</span>)}</div>
    </div>
  );
}

function DecisionForm({ result, cenarios }) {
  const names = result.resultados.map((r) => r.nome);
  const [form, setForm] = useState({ title: '', chosen: names[1] ?? names[0], rationale: '' });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      await api('/decisions', {
        method: 'POST',
        body: { ...form, alternatives: names, simulation: { premissas: result.premissas, resultados: result.resultados, cenarios } },
      });
      setSaved(true);
    });
  };
  if (saved) return <p className="ok">Decisão registrada. Acompanhe os resultados no <Link to="/historico">histórico</Link>.</p>;
  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Registrar decisão</h2>
      <label className="field"><span>Decisão</span>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ex.: Aceitar freelance de 4 h por semana" />
      </label>
      <label className="field"><span>Alternativa escolhida</span>
        <select value={form.chosen} onChange={(e) => setForm({ ...form, chosen: e.target.value })}>
          {names.map((n) => <option key={n}>{n}</option>)}
        </select>
      </label>
      <label className="field"><span>Justificativa</span>
        <textarea rows={3} value={form.rationale} onChange={(e) => setForm({ ...form, rationale: e.target.value })} />
      </label>
      <ErrorMsg>{error}</ErrorMsg>
      <button type="submit" className="primary" disabled={busy}>Registrar</button>
    </form>
  );
}

export default function Scenarios() {
  const base = useResource('/scenarios/baseline');
  const [cenarios, setCenarios] = useState(INITIAL);
  const [result, setResult] = useState(null);
  const { busy, error, run } = useAction();

  const update = (si, fn) => setCenarios((cs) => cs.map((c, i) => (i === si ? fn(c) : c)));
  const updateActivity = (si, ai, field, value) => update(si, (c) => ({
    ...c, atividades: c.atividades.map((a, j) => (j === ai ? { ...a, [field]: value } : a)),
  }));

  const simulate = (e) => {
    e.preventDefault();
    const toNumber = (v) => Number(String(v).replace(',', '.')) || 0;
    const body = cenarios.map((c) => ({
      ...c,
      atividades: c.atividades.map((a) => ({ ...a, horasSemana: toNumber(a.horasSemana), rendaMensal: toNumber(a.rendaMensal), custoMensal: toNumber(a.custoMensal) })),
    }));
    run(async () => setResult({ ...(await api('/scenarios/simulate', { method: 'POST', body: { cenarios: body } })), cenarios: body }));
  };

  const premissas = result?.premissas ?? base.data?.premissas;

  return (
    <section className="step">
      <h1>Cenários</h1>
      <p className="muted">
        Compare a sua semana e o seu mês atuais com alternativas. Os resultados são estimativas baseadas nas
        informações validadas e nas premissas abaixo.
      </p>

      <form onSubmit={simulate} className="stack">
        <div className="scenarios">
          {cenarios.map((c, si) => (
            <div className="card stack" key={si}>
              <div className="inline">
                <input aria-label="Nome do cenário" className="title-input" value={c.nome} required maxLength={60}
                  onChange={(e) => update(si, (s) => ({ ...s, nome: e.target.value }))} />
                <button type="button" className="link danger" onClick={() => setCenarios((cs) => cs.filter((_, i) => i !== si))}>Remover</button>
              </div>
              {c.atividades.map((a, ai) => (
                <fieldset key={ai} className="activity">
                  <label className="field wide"><span>Atividade</span>
                    <input value={a.nome} required onChange={(e) => updateActivity(si, ai, 'nome', e.target.value)} />
                  </label>
                  <label className="field"><span>Área</span>
                    <select value={a.area} onChange={(e) => updateActivity(si, ai, 'area', e.target.value)}>
                      {Object.entries(ACTIVITY_AREAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <label className="field"><span>h/semana</span>
                    <input inputMode="decimal" value={a.horasSemana} onChange={(e) => updateActivity(si, ai, 'horasSemana', e.target.value)} />
                  </label>
                  <label className="field"><span>Ganho/mês (R$)</span>
                    <input inputMode="decimal" value={a.rendaMensal} onChange={(e) => updateActivity(si, ai, 'rendaMensal', e.target.value)} />
                  </label>
                  <label className="field"><span>Custo/mês (R$)</span>
                    <input inputMode="decimal" value={a.custoMensal} onChange={(e) => updateActivity(si, ai, 'custoMensal', e.target.value)} />
                  </label>
                  <button type="button" className="link danger" aria-label="Remover atividade"
                    onClick={() => update(si, (s) => ({ ...s, atividades: s.atividades.filter((_, j) => j !== ai) }))}>×</button>
                </fieldset>
              ))}
              <button type="button" onClick={() => update(si, (s) => ({ ...s, atividades: [...s.atividades, newActivity()] }))}>+ Atividade</button>
            </div>
          ))}
        </div>
        <div className="actions left">
          {cenarios.length < 3 && (
            <button type="button" onClick={() => setCenarios((cs) => [...cs, { nome: `Cenário ${cs.length + 1}`, atividades: [newActivity()] }])}>+ Cenário</button>
          )}
          <button type="submit" className="primary" disabled={busy}>Simular</button>
        </div>
        <ErrorMsg>{error ?? base.error}</ErrorMsg>
      </form>

      {result && (
        <div className="card">
          <h2>Comparação</h2>
          <Results resultados={result.resultados} />
        </div>
      )}

      {premissas && (
        <details className="card" open={!result}>
          <summary><h2>Premissas</h2></summary>
          <ul className="premises">
            {premissas.map((p, i) => (
              <li key={i}>
                {p.descricao}
                {p.valor !== null && <>: <strong>{p.unidade === 'R$' ? brl(p.valor) : `${p.valor.toLocaleString('pt-BR')} ${p.unidade}`}</strong></>}
                <span className={`badge ${p.origem}`}>{ORIGIN[p.origem]}{p.fonte && ` · ${hostOf(p.fonte)}`}</span>
                {p.observacao && <span className="muted"> — {p.observacao}</span>}
              </li>
            ))}
          </ul>
          <p className="muted">Ajuste as premissas na etapa <Link to="/cadastro/3">Rotina e recursos</Link> ou no <Link to="/perfil">perfil</Link>.</p>
        </details>
      )}

      {result && result.resultados.length > 1 && <DecisionForm key={JSON.stringify(result.cenarios)} result={result} cenarios={result.cenarios} />}
    </section>
  );
}
