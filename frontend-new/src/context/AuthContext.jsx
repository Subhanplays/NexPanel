import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (api.token) {
      api.get('/auth/me').then(u => {
        setUser(u);
        setLoading(false);
      }).catch(() => {
        api.setToken(null);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const data = await api.post('/auth/login', { username, password });
    api.setToken(data.access_token);
    const me = await api.get('/auth/me');
    setUser(me);
    return me;
  };

  const register = async (username, email, password) => {
    await api.post('/auth/register', { username, email, password });
    return await login(username, password);
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
