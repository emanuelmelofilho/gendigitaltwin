import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORY_LABELS, formatValue, hostOf, keyLabel } from '../catalog.js';
import Stepper from '../components/Stepper.jsx';
import { ErrorMsg, useAction } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';
import { useResource } from '../hooks.js';

function Finding({ info, onDone }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(info.value));
  const { busy, error, run } = useAction();

  const review = (action, extra = {}) => run(async () => {
    await api(`/informations/${info.id}/review`, { method: 'POST', body: { action, ...extra } });
    onDone();
  });

  return (
    <li className="finding">
      <div className="finding-head">
        <span className="muted">{CATEGORY_LABELS[info.category]} · {keyLabel(info)}</span>
        <span className="muted" title="Confiança estimada pelo extrator">confiança {Math.round(info.confidence * 100)}%</span>
      </div>
      {editing ? (
        <form className="inline" onSubmit={(e) => { e.preventDefault(); review('corrigir', { value: value.trim() }); }}>
          <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus required />
          <button type="submit" className="primary" disabled={busy}>Salvar correção</button>
          <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
        </form>
      ) : (
        <p className="finding-value">{formatValue(info)}</p>
      )}
      {info.evidence && <blockquote>{info.evidence}</blockquote>}
      {!editing && (
        <div className="actions left">
          <button className="primary" disabled={busy} onClick={() => review('confirmar')}>Confirmar</button>
          <button disabled={busy} onClick={() => setEditing(true)}>Corrigir</button>
          <button className="danger" disabled={busy} onClick={() => review('rejeitar')}>Rejeitar</button>
        </div>
      )}
      <ErrorMsg>{error}</ErrorMsg>
    </li>
  );
}

export default function Review() {
  const { session } = useAuth();
  const { data, error, reload } = useResource('/informations?status=pendente');

  const bySource = Object.values((data ?? []).reduce((acc, info) => {
    (acc[info.sourceId] ??= { url: info.sourceUrl, items: [] }).items.push(info);
    return acc;
  }, {}));

  return (
    <>
      <Stepper reached={Math.max(session.person.onboardingStep, 5)} />
      <section className="step">
        <h1>5. Validação</h1>
        <p className="muted">
          Estas informações foram encontradas nas fontes que você indicou. Nada entra no seu perfil sem a sua confirmação.
          O que você rejeitar não será sugerido de novo.
        </p>
        <ErrorMsg>{error}</ErrorMsg>
        {data && bySource.length === 0 && (
          <div className="card">
            <p>Nada para revisar agora.</p>
            <p><Link to="/cadastro/4">Adicionar fontes</Link> · <Link to="/perfil">Ver perfil validado</Link></p>
          </div>
        )}
        {bySource.map((group) => (
          <div className="card" key={group.url}>
            <h2>Encontrado em <a href={group.url} target="_blank" rel="noreferrer">{hostOf(group.url)}</a></h2>
            <ul className="findings">
              {group.items.map((info) => <Finding key={info.id} info={info} onDone={reload} />)}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}
