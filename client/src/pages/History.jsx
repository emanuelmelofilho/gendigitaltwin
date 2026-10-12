import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { CATEGORY_LABELS, KEY_LABELS, STATUS_LABELS, brl, formatDate, hours } from '../catalog.js';
import Stepper from '../components/Stepper.jsx';
import { ErrorMsg, useAction } from '../components/ui.jsx';
import { useResource } from '../hooks.js';

const toNumber = (v) => (v === '' ? undefined : Number(String(v).replace(',', '.')));

function OutcomeForm({ decisionId, onSaved }) {
  const [form, setForm] = useState({ description: '', observedAt: '', horasLivresSemana: '', rendaExtraMensal: '', saldoMensal: '' });
  const { busy, error, run } = useAction();
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const metrics = Object.fromEntries(
      ['horasLivresSemana', 'rendaExtraMensal', 'saldoMensal'].map((k) => [k, toNumber(form[k])]).filter(([, v]) => v !== undefined),
    );
    run(async () => {
      await api(`/decisions/${decisionId}/outcomes`, {
        method: 'POST',
        body: { description: form.description, observedAt: form.observedAt || undefined, metrics },
      });
      onSaved();
    });
  };
  return (
    <form className="grid-form" onSubmit={submit}>
      <label className="field wide"><span>O que aconteceu?</span><input value={form.description} onChange={set('description')} required /></label>
      <label className="field"><span>Data</span><input type="date" value={form.observedAt} onChange={set('observedAt')} /></label>
      <label className="field"><span>Horas livres/semana</span><input inputMode="decimal" value={form.horasLivresSemana} onChange={set('horasLivresSemana')} /></label>
      <label className="field"><span>Renda extra/mês</span><input inputMode="decimal" value={form.rendaExtraMensal} onChange={set('rendaExtraMensal')} /></label>
      <label className="field"><span>Saldo/mês</span><input inputMode="decimal" value={form.saldoMensal} onChange={set('saldoMensal')} /></label>
      <button type="submit" disabled={busy}>Registrar resultado</button>
      <ErrorMsg>{error}</ErrorMsg>
    </form>
  );
}

/** Compara o que a simulação previu para a alternativa escolhida com o último resultado observado. */
function PredictedVsObserved({ decision }) {
  const predicted = decision.simulation?.resultados?.find((r) => r.nome === decision.chosen);
  const observed = [...decision.outcomes].reverse().find((o) => Object.keys(o.metrics).length)?.metrics;
  if (!predicted || !observed) return null;
  const extra = predicted.financas?.porAtividade.reduce((s, a) => s + a.liquidoMensal, 0);
  const rows = [
    ['Horas livres/semana', predicted.horas.livre, observed.horasLivresSemana, hours],
    ['Renda extra/mês', extra, observed.rendaExtraMensal, brl],
    ['Saldo/mês', predicted.financas?.saldo, observed.saldoMensal, brl],
  ].filter(([, p, o]) => p !== undefined && p !== null && o !== undefined);
  if (!rows.length) return null;
  return (
    <table className="compare small">
      <thead><tr><th /><th>Previsto</th><th>Observado</th></tr></thead>
      <tbody>{rows.map(([label, p, o, fmt]) => <tr key={label}><th scope="row">{label}</th><td>{fmt(p)}</td><td>{fmt(o)}</td></tr>)}</tbody>
    </table>
  );
}

function describe(event) {
  const d = event.data;
  if (event.type === 'decisao') return <>Decisão: <strong>{d.title}</strong> → {d.chosen}</>;
  if (event.type === 'resultado') return <>Resultado de “{d.decisionTitle}”: {d.description}</>;
  const label = KEY_LABELS[`${d.category}.${d.key}`] ?? CATEGORY_LABELS[d.category];
  const value = typeof d.value === 'object' ? d.value.titulo : String(d.value);
  return <>{label}: <strong>{value}</strong> <span className="muted">· {STATUS_LABELS[d.status]}{d.note && ` — ${d.note}`}</span></>;
}

export default function History() {
  const { session } = useAuth();
  const decisions = useResource('/decisions');
  const timeline = useResource('/timeline');
  const [openForm, setOpenForm] = useState(null);

  const refresh = () => {
    setOpenForm(null);
    decisions.reload();
    timeline.reload();
  };

  return (
    <>
      <Stepper reached={Math.max(session.person.onboardingStep, 6)} />
      <section className="step">
        <h1>6. Evolução</h1>
        <p className="muted">
          Registre o que aconteceu depois de cada decisão. Para registrar uma mudança na sua rotina ou no seu perfil,
          altere a informação no <Link to="/perfil">perfil</Link> — a versão anterior fica guardada.
        </p>

        <div className="card">
          <h2>Decisões</h2>
          <ErrorMsg>{decisions.error}</ErrorMsg>
          {decisions.data?.length === 0 && <p className="muted">Nenhuma decisão ainda. <Link to="/cenarios">Simule um cenário</Link> e registre a escolha.</p>}
          <ul className="decisions">
            {decisions.data?.map((d) => (
              <li key={d.id}>
                <div className="decision-head">
                  <strong>{d.title}</strong>
                  <span className="muted">{formatDate(d.decidedAt)}</span>
                </div>
                <div>Escolha: {d.chosen}{d.alternatives.length > 1 && <span className="muted"> (entre {d.alternatives.join(', ')})</span>}</div>
                {d.rationale && <p className="muted">{d.rationale}</p>}
                <PredictedVsObserved decision={d} />
                {d.outcomes.length > 0 && (
                  <ul className="outcomes">
                    {d.outcomes.map((o) => <li key={o.id}><span className="muted">{new Date(`${o.observedAt}T12:00`).toLocaleDateString('pt-BR')}</span> · {o.description}</li>)}
                  </ul>
                )}
                {openForm === d.id
                  ? <OutcomeForm decisionId={d.id} onSaved={refresh} />
                  : <button className="link" onClick={() => setOpenForm(d.id)}>+ Registrar resultado</button>}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Linha do tempo</h2>
          <ErrorMsg>{timeline.error}</ErrorMsg>
          <ol className="timeline">
            {timeline.data?.map((e, i) => (
              <li key={i} className={e.type}>
                <span className="muted">{formatDate(e.at)}</span>
                <div>{describe(e)}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
