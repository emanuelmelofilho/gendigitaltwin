import { useState } from 'react';
import { ACTIVITY_AREAS, hours } from '../catalog.js';
import { ErrorMsg, SavedField, useAction } from '../components/ui.jsx';
import { useDeclared } from '../hooks.js';

const ROUTINE_FIELDS = [
  ['sono_horas_dia', 'Sono por dia (h)', 'Se não informar, consideramos 8 h.'],
  ['trabalho_horas_semana', 'Trabalho por semana (h)'],
  ['deslocamento_horas_semana', 'Deslocamento por semana (h)'],
  ['estudo_horas_semana_desejadas', 'Quanto quer estudar por semana (h)'],
  ['familia_horas_semana_desejadas', 'Quanto quer dedicar à família por semana (h)'],
];
const EMPTY = { titulo: '', area: 'saude', horasSemana: '' };

export default function StepRoutine() {
  const d = useDeclared();
  const [commitment, setCommitment] = useState(EMPTY);
  const { busy, error, run } = useAction();
  if (!d.loaded) return <p className="muted">Carregando…</p>;

  const addCommitment = (e) => {
    e.preventDefault();
    run(async () => {
      await d.addItem('compromisso', 'compromisso', { ...commitment, horasSemana: Number(String(commitment.horasSemana).replace(',', '.')) });
      setCommitment(EMPTY);
    });
  };

  return (
    <div className="stack">
      <div className="card">
        <h2>Horários</h2>
        <div className="grid-2">
          {ROUTINE_FIELDS.map(([key, label, hint]) => (
            <SavedField key={key} type="number" label={label} hint={hint} value={d.single('rotina', key)?.value}
              onSave={(v) => d.saveSingle('rotina', key, v)} />
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Compromissos fixos</h2>
        <p className="muted">Atividades que já ocupam sua semana. Compromissos de estudo ou família contam para as metas dessas áreas.</p>
        <ul className="list">
          {d.items('compromisso').map((c) => (
            <li key={c.id}>
              <span>{c.value.titulo} <span className="muted">· {ACTIVITY_AREAS[c.value.area]} · {hours(c.value.horasSemana)}/semana</span></span>
              <button className="link" onClick={() => run(() => d.removeItem(c.id))}>Remover</button>
            </li>
          ))}
        </ul>
        <form className="grid-form" onSubmit={addCommitment}>
          <label className="field wide"><span>Compromisso</span>
            <input value={commitment.titulo} onChange={(e) => setCommitment({ ...commitment, titulo: e.target.value })} required placeholder="Ex.: Academia" />
          </label>
          <label className="field"><span>Área</span>
            <select value={commitment.area} onChange={(e) => setCommitment({ ...commitment, area: e.target.value })}>
              {Object.entries(ACTIVITY_AREAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field"><span>Horas/semana</span>
            <input inputMode="decimal" value={commitment.horasSemana} onChange={(e) => setCommitment({ ...commitment, horasSemana: e.target.value })} required />
          </label>
          <button type="submit" disabled={busy}>Adicionar</button>
        </form>
      </div>

      <div className="card">
        <h2>Finanças <small className="muted">(opcional)</small></h2>
        <p className="muted">Usadas só para estimar o impacto dos cenários. Valores mensais em reais.</p>
        <div className="grid-2">
          <SavedField type="number" label="Renda mensal (R$)" value={d.single('financas', 'renda_mensal')?.value}
            onSave={(v) => d.saveSingle('financas', 'renda_mensal', v)} />
          <SavedField type="number" label="Despesas mensais (R$)" value={d.single('financas', 'despesas_mensais')?.value}
            onSave={(v) => d.saveSingle('financas', 'despesas_mensais', v)} />
        </div>
      </div>
      <ErrorMsg>{error ?? d.error}</ErrorMsg>
    </div>
  );
}
