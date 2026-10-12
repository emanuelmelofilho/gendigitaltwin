import { useState } from 'react';
import { hostOf } from '../catalog.js';

export function ErrorMsg({ children }) {
  return children ? <p className="error" role="alert">{children}</p> : null;
}

/** Executa uma ação assíncrona controlando "ocupado" e mensagem de erro. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

export function OriginBadge({ info }) {
  if (info.origin === 'declarada') return <span className="badge declared">Informada por você</span>;
  return (
    <span className="badge extracted" title={info.sourceUrl}>
      {info.status === 'corrigida' ? 'Corrigida · ' : ''}Encontrada em {hostOf(info.sourceUrl)}
    </span>
  );
}

/** Lista de itens com inclusão e remoção (habilidades, interesses, decisões...). */
export function ChipList({ items, onAdd, onRemove, placeholder }) {
  const [text, setText] = useState('');
  const { busy, error, run } = useAction();
  const add = (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    run(async () => {
      await onAdd(value);
      setText('');
    });
  };
  return (
    <div>
      <ul className="chips">
        {items.map((item) => (
          <li key={item.id} className="chip">
            {item.label}
            <button type="button" aria-label={`Remover ${item.label}`} onClick={() => run(() => onRemove(item))}>×</button>
          </li>
        ))}
      </ul>
      <form className="inline" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        <button type="submit" disabled={busy}>Adicionar</button>
      </form>
      <ErrorMsg>{error}</ErrorMsg>
    </div>
  );
}

/** Campo salvo ao sair do foco; vazio remove o valor declarado. */
export function SavedField({ label, type = 'text', value, onSave, hint, multiline, step }) {
  const [draft, setDraft] = useState(value ?? '');
  const [prev, setPrev] = useState(value);
  const { busy, error, run } = useAction();
  const [saved, setSaved] = useState(false);
  if (value !== prev) {
    setPrev(value);
    setDraft(value ?? '');
  }
  const commit = () => {
    const raw = String(draft).trim();
    if (raw === String(value ?? '')) return;
    const parsed = raw === '' ? null : type === 'number' ? Number(raw.replace(',', '.')) : raw;
    run(async () => {
      await onSave(parsed);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  };
  const Input = multiline ? 'textarea' : 'input';
  return (
    <label className="field">
      <span>{label} {busy && <small className="muted">salvando…</small>}{saved && <small className="ok">salvo</small>}</span>
      <Input
        type={multiline ? undefined : type === 'number' ? 'text' : type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        step={step}
        rows={multiline ? 3 : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
      {hint && <small className="muted">{hint}</small>}
      <ErrorMsg>{error}</ErrorMsg>
    </label>
  );
}
