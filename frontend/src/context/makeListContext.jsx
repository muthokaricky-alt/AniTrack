import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '../api/client.js';
import { KINDS } from '../constants.js';
import { useAuth } from './AuthContext.jsx';

// Builds a list provider + hook for one kind of media ('anime' or 'manga').
export function makeListContext(kind) {
  const cfg = KINDS[kind];
  const ops = api.list(kind);
  const Ctx = createContext(null);

  function Provider({ children }) {
    const { user } = useAuth();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [savedAt, setSavedAt] = useState(null); // set when the list on screen is an offline copy
    const entriesRef = useRef(entries);
    entriesRef.current = entries;

    const cacheKey = user ? `anitrack:list:${kind}:${user.username}` : null;
    const load = useCallback(async () => {
      setLoading(true);
      setError('');
      try {
        const fresh = await ops.get();
        setEntries(fresh);
        setSavedAt(null);
        if (cacheKey) {
          try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), entries: fresh })); } catch { /* storage full or blocked */ }
        }
      } catch (e) {
        // server asleep or catalogue down: fall back to the last copy this browser saw
        let copy = null;
        try { copy = cacheKey ? JSON.parse(localStorage.getItem(cacheKey) || 'null') : null; } catch { /* ignore */ }
        if (copy?.entries?.length) {
          setEntries(copy.entries);
          setSavedAt(copy.at);
        } else {
          setError(e.message);
        }
      } finally {
        setLoading(false);
      }
    }, [cacheKey]);

    useEffect(() => {
      if (user) load();
      else { setEntries([]); setSavedAt(null); }
    }, [user, load]);

    const upsert = useCallback((entry) => {
      setEntries((prev) =>
        prev.some((e) => e.id === entry.id) ? prev.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...prev]
      );
    }, []);

    // keepExisting: add only if missing (quick-add), never overwrite an existing status
    const addToList = useCallback(
      async (item, status = cfg.defaultStatus, { keepExisting = false } = {}) => {
        const entry = await ops.add({
          mal_id: item.mal_id,
          title: item.title,
          image_url: item.images?.jpg?.image_url || null,
          status,
          [cfg.total]: item[cfg.totalProp] ?? null,
          genres: item.genres || [],
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
          const saved = await ops.update(id, patch);
          upsert(saved);
          return saved;
        } catch (e) {
          if (previous) upsert(previous);
          throw e;
        }
      },
      [upsert]
    );

    // put back titles that were just removed (the Undo button), with their old status, score, notes and tags
    const restoreEntries = useCallback(async (list) => {
      await ops.import(list);
      await load();
    }, [load]);

    const removeEntry = useCallback(async (id) => {
      await ops.remove(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const byMalId = useMemo(() => new Map(entries.map((e) => [e.mal_id, e])), [entries]);

    const stats = useMemo(() => {
      const scored = entries.filter((e) => e.score != null);
      return {
        total: entries.length,
        progress: entries.reduce((s, e) => s + (e[cfg.progress] || 0), 0),
        mean: scored.length ? (scored.reduce((s, e) => s + e.score, 0) / scored.length).toFixed(1) : null,
        counts: entries.reduce((acc, e) => ({ ...acc, [e.status]: (acc[e.status] || 0) + 1 }), {})
      };
    }, [entries]);

    const value = { entries, byMalId, stats, loading, error, savedAt, reload: load, addToList, updateEntry, removeEntry, restoreEntries };
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  return { Provider, useKindList: () => useContext(Ctx) };
}
