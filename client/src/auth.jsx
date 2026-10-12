import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = carregando, null = sem sessão

  useEffect(() => {
    api('/auth/me').then(setSession).catch(() => setSession(null));
  }, []);

  const login = useCallback(async (mode, body) => setSession(await api(`/auth/${mode}`, { method: 'POST', body })), []);
  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setSession(null);
  }, []);
  const setPerson = useCallback((person) => setSession((s) => ({ ...s, person })), []);

  return <AuthContext.Provider value={{ session, login, logout, setPerson }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
