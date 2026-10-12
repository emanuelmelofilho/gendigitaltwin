import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { CATEGORY_LABELS, GOAL_AREAS, STATUS_LABELS, formatDate, formatValue, keyLabel } from '../catalog.js';
import { ErrorMsg, OriginBadge, useAction } from '../components/ui.jsx';
import { useResource } from '../hooks.js';

function History({ id }) {
  const { data, error } = useResource(`/informations/${id}/history`);
  if (error) return <ErrorMsg>{error}</ErrorMsg>;
  if (!data) return <p className="muted">Carregando…</p>;
  return (
    <ol className="history">
      {data.versions.map((v) => (
        <li key={v.id}>
          <span className="muted">{formatDate(v.createdAt)}</span> · {STATUS_LABELS[v.status]} ·{' '}
          <code>{typeof v.value === 'object' ? JSON.stringify(v.value) : String(v.value)}</code>
          {v.note && <span className="muted"> — {v.note}</span>}
        </li>
      ))}
    </ol>
  );
}

function InfoRow({ info, onChange }) {
  const editable = typeof info.value !== 'object';
  const [mode, setMode] = useState(null); // 'edit' | 'history'
  const [value, setValue] = useState(String(info.value));
  const [note, setNote] = useState('');
  const { busy, error, run } = useAction();

  const save = (e) => {
    e.preventDefault();
    const parsed = typeof info.value === 'number' ? Number(value.replace(',', '.')) : value.trim();
    run(async () => {
      await api(`/informations/${info.id}`, { method: 'PATCH', body: { value: parsed, note: note || undefined } });
      setMode(null);
      onChange();
    });
  };

  return (
    <li className="info-row">
      <div className="info-main">
        <div>
          <span className="muted">{keyLabel(info)}</span>
          <div>{formatValue(info)}</div>
        </div>
        <OriginBadge info={info} />
        <div className="row-actions">
          {editable && <button className="link" onClick={() => setMode(mode === 'edit' ? null : 'edit')}>Alterar</button>}
          <button className="link" onClick={() => setMode(mode === 'history' ? null : 'history')}>Histórico</button>
          <button className="link danger" disabled={busy} onClick={() => run(async () => { await api(`/informations/${info.id}`, { method: 'DELETE' }); onChange(); })}>Remover</button>
        </div>
      </div>
      {mode === 'edit' && (
        <form className="inline" onSubmit={save}>
          <input value={value} onChange={(e) => setValue(e.target.value)} required />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que mudou? (opcional)" />
          <button type="submit" className="primary" disabled={busy}>Salvar</button>
        </form>
      )}
      {mode === 'history' && <History id={info.id} />}
      <ErrorMsg>{error}</ErrorMsg>
    </li>
  );
}

export default function Profile() {
  const { session } = useAuth();
  const infos = useResource('/informations?status=confirmada,corrigida');
  const goals = useResource('/goals');
  const purpose = session.person.purpose ?? {};

  const groups = Object.keys(CATEGORY_LABELS)
    .map((category) => ({ category, items: (infos.data ?? []).filter((i) => i.category === category) }))
    .filter((g) => g.items.length);

  return (
    <section className="step">
      <h1>{session.person.name}</h1>
      <p className="muted">Base validada do seu gêmeo. Cada informação mostra a origem; alterações ficam no histórico.</p>

      <div className="card">
        <h2>Finalidade</h2>
        <p>Áreas: {purpose.areas?.length ? purpose.areas.map((a) => GOAL_AREAS[a]).join(', ') : <span className="muted">não definidas</span>}</p>
        {purpose.decisoes?.length > 0 && <ul>{purpose.decisoes.map((d) => <li key={d}>{d}</li>)}</ul>}
        {goals.data?.length > 0 && (
          <>
            <h3>Metas</h3>
            <ul>{goals.data.map((g) => <li key={g.id}>{g.title} <span className="muted">· {GOAL_AREAS[g.area]}{g.deadline && ` · até ${new Date(`${g.deadline}T12:00`).toLocaleDateString('pt-BR')}`}</span></li>)}</ul>
          </>
        )}
      </div>

      <ErrorMsg>{infos.error}</ErrorMsg>
      {groups.map((g) => (
        <div className="card" key={g.category}>
          <h2>{CATEGORY_LABELS[g.category]}</h2>
          <ul className="info-list">
            {g.items.map((info) => <InfoRow key={`${info.id}-${info.updatedAt}`} info={info} onChange={infos.reload} />)}
          </ul>
        </div>
      ))}
      {infos.data?.length === 0 && <p className="muted">Nenhuma informação validada ainda. Comece pelo cadastro.</p>}
    </section>
  );
}
