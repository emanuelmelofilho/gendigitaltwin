import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ErrorMsg, useAction } from '../components/ui.jsx';

export default function Login() {
  const { session, login } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { busy, error, run } = useAction();

  if (session) return <Navigate to="/" replace />;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const { name, ...creds } = form;
    run(() => login(mode, mode === 'register' ? { ...creds, name } : creds));
  };

  return (
    <main className="narrow">
      <h1>Gêmeo Digital</h1>
      <p className="muted">
        Um perfil que evolui com você: informe seus dados, revise o que encontrarmos nas fontes que você escolher e
        simule decisões sobre trabalho, estudo, vida pessoal e finanças.
      </p>
      <form className="card stack" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
        {mode === 'register' && (
          <label className="field"><span>Nome</span><input value={form.name} onChange={set('name')} required autoComplete="name" /></label>
        )}
        <label className="field"><span>E-mail</span><input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
        <label className="field">
          <span>Senha</span>
          <input type="password" value={form.password} onChange={set('password')} required minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        <ErrorMsg>{error}</ErrorMsg>
        <button type="submit" className="primary" disabled={busy}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho conta'}
        </button>
      </form>
    </main>
  );
}
