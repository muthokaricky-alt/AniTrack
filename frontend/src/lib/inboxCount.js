import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// How many recommendations are waiting for the signed-in person. It is fetched once when the app opens (and again after
// someone logs in), never polled, so it costs the free database next to nothing.
let count = 0;
let loadedFor = null;
const listeners = new Set();

export function setInboxCount(n) {
  count = Math.max(0, Number(n) || 0);
  listeners.forEach((fn) => fn(count));
}

export function useInboxCount(user) {
  const [n, setN] = useState(count);
  useEffect(() => {
    listeners.add(setN);
    return () => { listeners.delete(setN); };
  }, []);
  const id = user?.id ?? null;
  useEffect(() => {
    if (id == null) {
      loadedFor = null;
      setInboxCount(0);
      return;
    }
    if (loadedFor === id) {
      setN(count);
      return;
    }
    loadedFor = id;
    api.inboxCount().then((r) => { if (loadedFor === id) setInboxCount(r.unread); }).catch(() => {});
  }, [id]);
  return n;
}
