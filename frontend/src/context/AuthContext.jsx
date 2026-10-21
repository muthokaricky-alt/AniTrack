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

// Everything the app saves in this browser that belongs to the signed-in person: offline copies of their lists,
// weekly goal, seen episodes, list filters. Wiped on logout so whoever uses this browser next never sees it.
// Theme, music and layout preferences stay.
function clearPersonalData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('anitrack:list:') || key === 'anitrack:weekgoal' || key === 'anitrack:eps-seen') localStorage.removeItem(key);
    }
    sessionStorage.removeItem('anitrack:listfilters');
  } catch {
    /* storage blocked: nothing to clear */
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

  const register = useCallback(async (username, email, password, avatar = null) => {
    const data = await api.register({ username, email, password, ...(avatar ? { avatar } : {}) });
    persist(data.token, data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('anitrack_token');
    localStorage.removeItem('anitrack_user');
    clearPersonalData();
    setUser(null);
  }, []);

  // Merge fresh profile fields (after an edit, or a refresh from the server) into state and storage
  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem('anitrack_user', JSON.stringify(next));
      } catch {
        /* storage full or blocked: the in-memory copy still works */
      }
      return next;
    });
  }, []);

  // Pick up changes made on another device (new photo, new username) once per page load
  useEffect(() => {
    if (!localStorage.getItem('anitrack_token')) return;
    api.me().then((res) => updateUser(res.user)).catch(() => {});
  }, [updateUser]);

  // The API client fires this when the server says our token is no longer valid
  useEffect(() => {
    window.addEventListener('anitrack:unauthorized', logout);
    return () => window.removeEventListener('anitrack:unauthorized', logout);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
