import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const ListContext = createContext(null);

export function ListProvider({ children }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEntries(await api.getList());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
    else setEntries([]);
  }, [user, load]);

  const upsert = useCallback((entry) => {
    setEntries((prev) =>
      prev.some((e) => e.id === entry.id) ? prev.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...prev]
    );
  }, []);

  // keepExisting: add only if missing (quick-add), never overwrite an existing status
  const addToList = useCallback(
    async (anime, status = 'plan_to_watch', { keepExisting = false } = {}) => {
      const entry = await api.addToList({
        mal_id: anime.mal_id,
        title: anime.title,
        image_url: anime.images?.jpg?.image_url || null,
        status,
        total_episodes: anime.episodes ?? null,
        keep_existing: keepExisting
      });
      upsert(entry);
      return entry;
    },
    [upsert]
  );

  // Optimistic update with rollback if the server rejects it
  const updateEntry = useCallback(
    async (id, patch) => {
      const previous = entriesRef.current.find((e) => e.id === id);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      try {
        const saved = await api.updateEntry(id, patch);
        upsert(saved);
        return saved;
      } catch (e) {
        if (previous) upsert(previous);
        throw e;
      }
    },
    [upsert]
  );

  const removeEntry = useCallback(async (id) => {
    await api.removeEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const byMalId = useMemo(() => new Map(entries.map((e) => [e.mal_id, e])), [entries]);

  const stats = useMemo(() => {
    const scored = entries.filter((e) => e.score != null);
    return {
      total: entries.length,
      episodes: entries.reduce((s, e) => s + (e.episodes_watched || 0), 0),
      mean: scored.length ? (scored.reduce((s, e) => s + e.score, 0) / scored.length).toFixed(1) : null,
      counts: entries.reduce((acc, e) => ({ ...acc, [e.status]: (acc[e.status] || 0) + 1 }), {})
    };
  }, [entries]);

  const value = { entries, byMalId, stats, loading, error, reload: load, addToList, updateEntry, removeEntry };
  return <ListContext.Provider value={value}>{children}</ListContext.Provider>;
}

export function useList() {
  return useContext(ListContext);
}
