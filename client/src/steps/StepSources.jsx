import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { formatDate, hostOf } from '../catalog.js';
import { ErrorMsg, useAction } from '../components/ui.jsx';
import { useDeclared, useResource } from '../hooks.js';

const STATUS = { pendente: 'Na fila', coletando: 'Coletando…', coletada: 'Coletada', erro: 'Erro' };
const SEARCH_STATUS = { pendente: 'Na fila', executando: 'Buscando…', concluida: 'Concluída', erro: 'Erro' };

function AddSource({ onAdded }) {
  const [url, setUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const { busy, error, run } = useAction();
  const add = (e) => {
    e.preventDefault();
    run(async () => {
      await api('/sources', { method: 'POST', body: { url, consent } });
      setUrl('');
      setConsent(false);
      await onAdded();
    });
  };
  return (
    <div className="card">
      <h2>Seus links</h2>
      <p>
        Portfólio, currículo online, GitHub ou outras páginas <strong>sobre você</strong>. O robô lê a página, até 4 páginas
        do mesmo site (sobre, projetos, currículo) e sugere outros perfis seus que ela aponta.
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
      <ErrorMsg>{error}</ErrorMsg>
    </div>
  );
}

function NameSearch({ data, onStarted }) {
  const { session } = useAuth();
  const declared = useDeclared();
  const profession = declared.single('perfil', 'profissao')?.value;
  const [terms, setTerms] = useState(null);
  const [consent, setConsent] = useState(false);
  const { busy, error, run } = useAction();
  if (!data) return null;

  const termsValue = terms ?? profession ?? '';
  const start = (e) => {
    e.preventDefault();
    run(async () => {
      await api('/searches', { method: 'POST', body: { terms: termsValue || undefined, consent } });
      setConsent(false);
      await onStarted();
    });
  };

  return (
    <div className="card">
      <h2>Buscar pelo meu nome</h2>
      {!data.available ? (
        <p className="muted">
          Desativada. Para ativar, crie uma chave gratuita da <a href="https://brave.com/search/api/" target="_blank" rel="noreferrer">Brave Search API</a>,
          coloque em <code>BRAVE_SEARCH_API_KEY</code> no arquivo <code>.env</code> e reinicie o servidor.
        </p>
      ) : (
        <>
          <p>
            Pesquisamos <strong>“{session.person.name}”</strong> na internet. Pessoas com o mesmo nome são comuns, então os
            resultados viram <strong>sugestões</strong>: nada é coletado antes de você confirmar que o link é sobre você.
          </p>
          <form className="stack" onSubmit={start}>
            <label className="field"><span>Termos para diferenciar de homônimos</span>
              <input value={termsValue} onChange={(e) => setTerms(e.target.value)} placeholder="Ex.: cidade, profissão, empresa" maxLength={200} />
            </label>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
              Autorizo a busca pelo meu nome.
            </label>
            <button type="submit" disabled={busy || !consent}>Buscar</button>
          </form>
          <ErrorMsg>{error}</ErrorMsg>
          {data.searches.length > 0 && (
            <ul className="list">
              {data.searches.slice(0, 3).map((s) => (
                <li key={s.id}>
                  <span><code>{s.query}</code> <span className="muted">· {formatDate(s.createdAt)}</span></span>
                  <span className={`status ${s.status}`}>
                    {SEARCH_STATUS[s.status]}{s.status === 'concluida' && ` · ${s.resultsCount} sugestão(ões) nova(s)`}
                    {s.error && ` · ${s.error}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Suggestions({ items, onChange }) {
  const { busy, error, run } = useAction();
  if (!items.length) return null;
  const act = (id, action) => run(async () => {
    await api(`/sources/${id}/${action}`, { method: 'POST', body: action === 'approve' ? { consent: true } : {} });
    await onChange();
  });
  return (
    <div className="card">
      <h2>Sugestões do robô <span className="muted">({items.length})</span></h2>
      <p className="muted">Confirme só os links que são realmente sobre você. Ao confirmar, você autoriza a coleta.</p>
      <ul className="findings">
        {items.map((s) => (
          <li key={s.id} className="finding">
            <div className="finding-head">
              <span className="muted">{s.discoveredVia === 'busca' ? 'Resultado da busca pelo nome' : 'Apontado por uma das suas fontes'}</span>
            </div>
            <p className="finding-value"><a href={s.url} target="_blank" rel="noreferrer">{s.title || hostOf(s.url)}</a></p>
            <div className="muted url">{s.url}</div>
            {s.snippet && <blockquote>{s.snippet}</blockquote>}
            <div className="actions left">
              <button className="primary" disabled={busy} onClick={() => act(s.id, 'approve')}>É sobre mim — coletar</button>
              <button disabled={busy} onClick={() => act(s.id, 'dismiss')}>Não sou eu / descartar</button>
            </div>
          </li>
        ))}
      </ul>
      <ErrorMsg>{error}</ErrorMsg>
    </div>
  );
}

export default function StepSources() {
  const sources = useResource('/sources');
  const searches = useResource('/searches');
  const { busy, error, run } = useAction();

  const suggested = sources.data?.filter((s) => s.status === 'sugerida') ?? [];
  const authorized = sources.data?.filter((s) => s.status !== 'sugerida') ?? [];

  // Acompanha coletas e buscas em segundo plano enquanto houver algo em andamento.
  const inProgress = authorized.some((s) => s.status === 'pendente' || s.status === 'coletando')
    || searches.data?.searches.some((s) => s.status === 'pendente' || s.status === 'executando');
  const reloadSources = sources.reload;
  const reloadSearches = searches.reload;
  useEffect(() => {
    if (!inProgress) return undefined;
    const t = setInterval(() => {
      reloadSources();
      reloadSearches();
    }, 2000);
    return () => clearInterval(t);
  }, [inProgress, reloadSources, reloadSearches]);

  const retry = (id) => run(async () => {
    await api(`/sources/${id}/retry`, { method: 'POST' });
    await reloadSources();
  });

  const pending = authorized.reduce((n, s) => n + s.pendingCount, 0);

  return (
    <div className="stack">
      <p className="muted">
        Tudo o que o robô encontrar fica pendente até você revisar. Ele respeita o robots.txt dos sites e não acessa
        páginas que exigem login (como LinkedIn e Instagram).
      </p>
      <AddSource onAdded={reloadSources} />
      <NameSearch data={searches.data} onStarted={reloadSearches} />
      <Suggestions items={suggested} onChange={reloadSources} />

      {authorized.length > 0 && (
        <div className="card">
          <h2>Fontes autorizadas</h2>
          <ul className="list">
            {authorized.map((s) => (
              <li key={s.id}>
                <div>
                  <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
                  <div className="muted">
                    <span className={`status ${s.status}`}>{STATUS[s.status]}</span>
                    {s.collectedAt && ` · coletada em ${formatDate(s.collectedAt)}`}
                    {s.status === 'coletada' && s.pages.length > 1 && ` · ${s.pages.length} páginas lidas`}
                    {s.status === 'coletada' && ` · ${s.findingsCount} achado(s), ${s.pendingCount} para revisar`}
                  </div>
                  {s.error && <div className="error">{s.error}</div>}
                </div>
                {(s.status === 'erro' || s.status === 'coletada') && <button className="link" disabled={busy} onClick={() => retry(s.id)}>Coletar de novo</button>}
              </li>
            ))}
          </ul>
          {pending > 0 && <p><Link to="/revisao">Revisar {pending} informação(ões) encontrada(s) →</Link></p>}
        </div>
      )}
      <ErrorMsg>{error ?? sources.error ?? searches.error}</ErrorMsg>
    </div>
  );
}
