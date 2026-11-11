// Loads the next-episode times for your airing shows once per page and shares them with whoever asks.
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// One request shared by everything on the page that needs "what airs next" (the week strip and the row badges)
let cache = null;
export function loadAiring(maxAgeMs = 60000) {
  if (cache && Date.now() - cache.at < maxAgeMs) return cache.promise;
  const promise = api.airing().then((r) => r.data || []);
  cache = { at: Date.now(), promise };
  promise.catch(() => { if (cache && cache.promise === promise) cache = null; });
  return promise;
}

// mal_id -> { next_episode, airing_at, ... } for the titles on your list that are still airing
export function useAiringMap(enabled) {
  const [map, setMap] = useState(() => new Map());
  useEffect(() => {
    if (!enabled) return undefined;
    let off = false;
    loadAiring().then((items) => !off && setMap(new Map(items.map((i) => [i.mal_id, i])))).catch(() => {});
    return () => { off = true; };
  }, [enabled]);
  return map;
}
