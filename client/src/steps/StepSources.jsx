import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate } from '../catalog.js';
import { ErrorMsg, useAction } from '../components/ui.jsx';
import { useResource } from '../hooks.js';

const STATUS = { pendente: 'Na fila', coletando: 'Coletando…', coletada: 'Coletada', erro: 'Erro' };

export default function StepSources() {
  const sources = useResource('/sources');
  const [url, setUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const { busy, error, run } = useAction();

  // Acompanha a coleta em segundo plano enquanto houver fontes em andamento.
  const inProgress = sources.data?.some((s) => s.status === 'pendente' || s.status === 'coletando');
  const { reload } = sources;
  useEffect(() => {
    if (!inProgress) return undefined;
    const t = setInterval(reload, 2000);
    return () => clearInterval(t);
  }, [inProgress, reload]);

  const add = (e) => {
    e.preventDefault();
    run(async () => {
      await api('/sources', { method: 'POST', body: { url, consent } });
      setUrl('');
      setConsent(false);
      await reload();
    });
  };
  const retry = (id) => run(async () => {
    await api(`/sources/${id}/retry`, { method: 'POST' });
    await reload();
  });

  const pending = sources.data?.reduce((n, s) => n + s.pendingCount, 0) ?? 0;

  return (
    <div className="stack">
      <div className="card">
        <p>
          Informe links <strong>sobre você</strong>: portfólio, currículo online, GitHub ou outras páginas que você escolher.
          Não pesquisamos pelo seu nome — assim evitamos confundir você com homônimos. Tudo o que encontrarmos fica
          pendente até você revisar.
        </p>
        <form className="stack" onSubmit={add}>
          <label className="field"><span>Link</span>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://github.com/seu-usuario" />
          </label>
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            Autorizo a consulta deste link e confirmo que ele se refere a mim.
          </label>
          <button type="submit" disabled={busy || !consent}>Adicionar fonte</button>
        </form>
        <ErrorMsg>{error ?? sources.error}</ErrorMsg>
      </div>

      {sources.data?.length > 0 && (
        <div className="card">
          <h2>Suas fontes</h2>
          <ul className="list">
            {sources.data.map((s) => (
              <li key={s.id}>
                <div>
                  <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
                  <div className="muted">
                    <span className={`status ${s.status}`}>{STATUS[s.status]}</span>
                    {s.collectedAt && ` · coletada em ${formatDate(s.collectedAt)}`}
                    {s.status === 'coletada' && ` · ${s.findingsCount} achado(s), ${s.pendingCount} para revisar`}
                  </div>
                  {s.error && <div className="error">{s.error}</div>}
                </div>
                {(s.status === 'erro' || s.status === 'coletada') && <button className="link" onClick={() => retry(s.id)}>Coletar de novo</button>}
              </li>
            ))}
          </ul>
          {pending > 0 && <p><Link to="/revisao">Revisar {pending} informação(ões) encontrada(s) →</Link></p>}
        </div>
      )}
    </div>
  );
}
