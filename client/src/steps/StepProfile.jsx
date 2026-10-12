import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ChipList, ErrorMsg, SavedField } from '../components/ui.jsx';
import { useDeclared } from '../hooks.js';

export default function StepProfile() {
  const { session, setPerson } = useAuth();
  const d = useDeclared();
  if (!d.loaded) return <p className="muted">Carregando…</p>;

  const list = (category) => (
    <ChipList
      items={d.items(category).map((i) => ({ id: i.id, label: i.value }))}
      placeholder={category === 'habilidade' ? 'Ex.: Excel, React, inglês' : 'Ex.: finanças pessoais, música'}
      onAdd={(v) => d.addItem(category, category, v)}
      onRemove={(item) => d.removeItem(item.id)}
    />
  );

  return (
    <div className="stack">
      <div className="card stack">
        <SavedField label="Nome" value={session.person.name}
          onSave={async (name) => name && setPerson(await api('/person', { method: 'PATCH', body: { name } }))} />
        <SavedField label="Profissão" value={d.single('perfil', 'profissao')?.value}
          onSave={(v) => d.saveSingle('perfil', 'profissao', v)} />
        <SavedField label="Contexto pessoal" multiline value={d.single('contexto', 'situacao')?.value}
          hint="Ex.: moro com a família, tenho dois filhos, faço faculdade à noite."
          onSave={(v) => d.saveSingle('contexto', 'situacao', v)} />
      </div>
      <div className="card"><h2>Habilidades</h2>{list('habilidade')}</div>
      <div className="card"><h2>Interesses</h2>{list('interesse')}</div>
      <ErrorMsg>{d.error}</ErrorMsg>
    </div>
  );
}
