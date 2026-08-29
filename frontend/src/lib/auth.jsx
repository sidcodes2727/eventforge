import { createContext, useContext, useState, useEffect } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ieps_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ieps_token');
    if (token && !user) {
      api.getProfile()
        .then((res) => {
          setUser(res.data.user);
          localStorage.setItem('ieps_user', JSON.stringify(res.data.user));
        })
        .catch(() => {
          localStorage.removeItem('ieps_token');
          localStorage.removeItem('ieps_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.login(email, password);
    const { user: userData, token } = res.data;
    localStorage.setItem('ieps_token', token);
    localStorage.setItem('ieps_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (email, password, name) => {
    const res = await api.register(email, password, name);
    const { user: userData, token } = res.data;
    localStorage.setItem('ieps_token', token);
    localStorage.setItem('ieps_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('ieps_token');
    localStorage.removeItem('ieps_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
