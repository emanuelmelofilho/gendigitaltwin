import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import History from './pages/History.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Profile from './pages/Profile.jsx';
import Review from './pages/Review.jsx';
import Scenarios from './pages/Scenarios.jsx';

function Layout() {
  const { session, logout } = useAuth();
  if (session === undefined) return <p className="center muted">Carregando…</p>;
  if (session === null) return <Navigate to="/entrar" replace />;
  return (
    <>
      <header className="topbar">
        <span className="brand">Gêmeo Digital</span>
        <nav>
          <NavLink to="/cadastro">Cadastro</NavLink>
          <NavLink to="/revisao">Revisão</NavLink>
          <NavLink to="/perfil">Perfil</NavLink>
          <NavLink to="/cenarios">Cenários</NavLink>
          <NavLink to="/historico">Histórico</NavLink>
        </nav>
        <button className="link" onClick={logout}>Sair</button>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

function FirstStep() {
  const { session } = useAuth();
  const step = Math.min(session?.person?.onboardingStep ?? 1, 4);
  return <Navigate to={`/cadastro/${step}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/entrar" element={<Login />} />
        <Route element={<Layout />}>
          <Route index element={<FirstStep />} />
          <Route path="/cadastro" element={<FirstStep />} />
          <Route path="/cadastro/:step" element={<Onboarding />} />
          <Route path="/revisao" element={<Review />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/cenarios" element={<Scenarios />} />
          <Route path="/historico" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
