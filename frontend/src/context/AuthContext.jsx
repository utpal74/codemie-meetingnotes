import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(null); // null = checking
  const [role, setRole] = useState(null);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => {
        setAuthenticated(res.data.authenticated);
        setRole(res.data.role || null);
      })
      .catch(() => {
        setAuthenticated(false);
        setRole(null);
      });
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    setAuthenticated(true);
    setRole(res.data.role || null);
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setAuthenticated(false);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ authenticated, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
