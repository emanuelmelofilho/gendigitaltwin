import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { GOAL_AREAS } from '../catalog.js';
import { ChipList, ErrorMsg, useAction } from '../components/ui.jsx';
import { useResource } from '../hooks.js';

const PRIORITY = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };
const EMPTY_GOAL = { title: '', area: 'trabalho', priority: 2, deadline: '' };

export default function StepGoal() {
  const { session, setPerson } = useAuth();
  const purpose = { areas: [], decisoes: [], ...session.person.purpose };
  const goals = useResource('/goals');
  const [goal, setGoal] = useState(EMPTY_GOAL);
  const { busy, error, run } = useAction();

  const savePurpose = async (patch) => {
    setPerson(await api('/person', { method: 'PATCH', body: { purpose: { ...purpose, ...patch } } }));
  };
  const toggleArea = (area) => run(() => savePurpose({
    areas: purpose.areas.includes(area) ? purpose.areas.filter((a) => a !== area) : [...purpose.areas, area],
  }));

  const addGoal = (e) => {
    e.preventDefault();
    run(async () => {
      await api('/goals', { method: 'POST', body: { ...goal, deadline: goal.deadline || null } });
      setGoal(EMPTY_GOAL);
      await goals.reload();
    });
  };
  const removeGoal = (id) => run(async () => {
    await api(`/goals/${id}`, { method: 'DELETE' });
    await goals.reload();
  });

  return (
    <div className="stack">
      <div className="card">
        <h2>O que você quer melhorar?</h2>
        <div className="checks">
          {Object.entries(GOAL_AREAS).map(([area, label]) => (
            <label key={area} className="check">
              <input type="checkbox" checked={purpose.areas.includes(area)} onChange={() => toggleArea(area)} disabled={busy} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Quais decisões você quer simular?</h2>
        <p className="muted">Ex.: “Se eu dedicar 4 h por semana a uma renda extra, quanto tempo sobra para estudo e família?”</p>
        <ChipList
          items={purpose.decisoes.map((d, i) => ({ id: i, label: d }))}
          placeholder="Descreva uma decisão"
          onAdd={(d) => savePurpose({ decisoes: [...purpose.decisoes, d] })}
          onRemove={(item) => savePurpose({ decisoes: purpose.decisoes.filter((_, i) => i !== item.id) })}
        />
      </div>

      <div className="card">
        <h2>Metas, prioridades e prazos</h2>
        <ul className="list">
          {goals.data?.map((g) => (
            <li key={g.id}>
              <div>
                <strong>{g.title}</strong>
                <div className="muted">{GOAL_AREAS[g.area]} · prioridade {PRIORITY[g.priority].toLowerCase()}{g.deadline && ` · até ${new Date(`${g.deadline}T12:00`).toLocaleDateString('pt-BR')}`}</div>
              </div>
              <button className="link" onClick={() => removeGoal(g.id)}>Remover</button>
            </li>
          ))}
          {goals.data?.length === 0 && <li className="muted">Nenhuma meta ainda.</li>}
        </ul>
        <form className="grid-form" onSubmit={addGoal}>
          <label className="field wide"><span>Meta</span>
            <input value={goal.title} onChange={(e) => setGoal({ ...goal, title: e.target.value })} required placeholder="Ex.: Juntar 6 meses de reserva" />
          </label>
          <label className="field"><span>Área</span>
            <select value={goal.area} onChange={(e) => setGoal({ ...goal, area: e.target.value })}>
              {Object.entries(GOAL_AREAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field"><span>Prioridade</span>
            <select value={goal.priority} onChange={(e) => setGoal({ ...goal, priority: Number(e.target.value) })}>
              {Object.entries(PRIORITY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field"><span>Prazo</span>
            <input type="date" value={goal.deadline} onChange={(e) => setGoal({ ...goal, deadline: e.target.value })} />
          </label>
          <button type="submit" disabled={busy}>Adicionar meta</button>
        </form>
      </div>
      <ErrorMsg>{error ?? goals.error}</ErrorMsg>
    </div>
  );
}
