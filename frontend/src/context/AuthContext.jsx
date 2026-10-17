import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const stored = localStorage.getItem('anitrack_user');
    return stored && localStorage.getItem('anitrack_token') ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const persist = (token, userObj) => {
    localStorage.setItem('anitrack_token', token);
    localStorage.setItem('anitrack_user', JSON.stringify(userObj));
    setUser(userObj);
  };

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    persist(data.token, data.user);
  }, []);

  const register = useCallback(async (username, email, password) => {
    const data = await api.register({ username, email, password });
    persist(data.token, data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('anitrack_token');
    localStorage.removeItem('anitrack_user');
    setUser(null);
  }, []);

  // The API client fires this when the server says our token is no longer valid
  useEffect(() => {
    window.addEventListener('anitrack:unauthorized', logout);
    return () => window.removeEventListener('anitrack:unauthorized', logout);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
