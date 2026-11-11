// In dev, Vite proxies /api to the backend. In production the backend serves the app,
// so /api is same-origin. Set VITE_API_URL only if the API lives on a different host.
import { todayLocal } from '../lib/dates.js';
import { createWakeTracker, isRead, looksAsleep, sleep, RETRY_DELAYS } from '../lib/wake.js';

const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;

function authHeaders() {
  const token = localStorage.getItem('anitrack_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const track = createWakeTracker((name) => window.dispatchEvent(new Event(name)));

async function request(path, options = {}) {
  const done = track();
  try {
    const canRetry = isRead(options);
    for (let attempt = 0; ; attempt += 1) {
      const mayRetry = canRetry && attempt < RETRY_DELAYS.length;
      let res;
      try {
        res = await fetch(`${BASE}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
            ...(options.headers || {})
          }
        });
      } catch {
        if (mayRetry && navigator.onLine !== false) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        throw new Error('Could not reach the server. Check your connection and try again.');
      }

      if (res.status === 204) return null;
      const data = await res.json().catch(() => ({}));

      if (mayRetry && looksAsleep(res.status, data)) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }

      if (res.status === 401 && !path.startsWith('/auth') && localStorage.getItem('anitrack_token')) {
        window.dispatchEvent(new Event('anitrack:unauthorized'));
      }
      if (!res.ok) {
        if (data.detail) console.warn(`API detail (${path}):`, data.detail);
        throw new Error(data.error || (looksAsleep(res.status, data) ? 'The server is still waking up. Please try again in a moment.' : 'Request failed'));
      }
      if (data && data.source === 'backup') window.dispatchEvent(new Event('anitrack:backup'));
      return data;
    }
  } finally {
    done();
  }
}

// Cover pictures for the share card go through our own server so the browser lets us export the canvas
export const imgSrc = (url) => (/^https?:\/\//.test(url || '') ? `${BASE}/img?url=${encodeURIComponent(url)}` : url || null);

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  searchAnime: (q, page = 1, genre = '') => {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (genre) params.set('genre', genre);
    return request(`/anime/search?${params}`);
  },
  schedule: (from, to) => request(`/anime/schedule?from=${from}&to=${to}`),
  topAnime: (page = 1) => request(`/anime/top?page=${page}`),
  seasonalAnime: () => request('/anime/season/now'),
  animeDetail: (id) => request(`/anime/${id}`),

  getList: () => request('/list'),
  addToList: (body) => request('/list', { method: 'POST', body: JSON.stringify(body) }),
  updateEntry: (id, body) => request(`/list/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  removeEntry: (id) => request(`/list/${id}`, { method: 'DELETE' }),
  importList: (entries) => request('/list/import', { method: 'POST', body: JSON.stringify({ entries }) }),

  me: () => request('/profile'),
  updateProfile: (body) => request('/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (body) => request('/profile/password', { method: 'PATCH', body: JSON.stringify(body) }),
  logoutAll: () => request('/profile/logout-all', { method: 'POST' }),
  publicProfile: (username) => request(`/users/${encodeURIComponent(username)}`),
  tasteMatch: (username) => request(`/users/${encodeURIComponent(username)}/match`),
  followInfo: (username) => request(`/users/${encodeURIComponent(username)}/follow`),
  follow: (username) => request(`/users/${encodeURIComponent(username)}/follow`, { method: 'POST' }),
  unfollow: (username) => request(`/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' }),
  network: (username, type) => request(`/users/${encodeURIComponent(username)}/network?type=${type}`),
  followMatches: () => request('/follows/matches'),
  recommendFriends: () => request('/recommendations/friends'),
  inboxCount: () => request('/recommendations/unread-count'),
  recommendations: (box) => request(`/recommendations?box=${box === 'sent' ? 'sent' : 'inbox'}`),
  markInboxRead: () => request('/recommendations/read', { method: 'POST' }),
  sendRecommendation: (body) => request('/recommendations', { method: 'POST', body: JSON.stringify(body) }),
  removeRecommendation: (id) => request(`/recommendations/${id}`, { method: 'DELETE' }),
  characterInfo: (id) => request(`/characters/${id}`),
  myBanner: () => request('/profile/banner'),
  saveBanner: (body) => request('/profile/banner', { method: 'PUT', body: JSON.stringify(body) }),
  bannerOptions: () => request('/profile/banner-options'),
  airing: () => request('/anime/airing'),
  activity: () => request('/activity'),
  forYou: () => request('/anime/for-you'),

  favorites: () => request('/favorites'),
  saveFavorites: (kind, list, items) => request(`/favorites/${kind}/${list}`, { method: 'PUT', body: JSON.stringify({ items }) }),
  searchCharacters: (q) => request(`/characters/search?q=${encodeURIComponent(q)}`),

  searchManga: (q, page = 1, genre = '') => {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (genre) params.set('genre', genre);
    return request(`/manga/search?${params}`);
  },
  topManga: (page = 1) => request(`/manga/top?page=${page}`),
  trendingManga: () => request('/manga/trending'),
  mangaDetail: (id) => request(`/manga/${id}`),

  customLists: {
    mine: () => request('/custom-lists'),
    forUser: (username) => request(`/custom-lists/user/${encodeURIComponent(username)}`),
    get: (id) => request(`/custom-lists/${id}`),
    create: (body) => request('/custom-lists', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/custom-lists/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    discover: (page = 1) => request(`/custom-lists/discover?page=${page}`),
    copy: (id) => request(`/custom-lists/${id}/copy`, { method: 'POST' }),
    addItem: (id, item) => request(`/custom-lists/${id}/items`, { method: 'POST', body: JSON.stringify(item) }),
    remove: (id) => request(`/custom-lists/${id}`, { method: 'DELETE' })
  },

  importAniList: (username, kind) => request(`/import/anilist?username=${encodeURIComponent(username)}&kind=${kind}`),

  list: (kind) => {
    const base = kind === 'manga' ? '/manga-list' : '/list';
    return {
      get: () => request(base),
      add: (body) => request(base, { method: 'POST', body: JSON.stringify({ ...body, today: todayLocal() }) }),
      update: (id, body) => request(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify({ ...body, today: todayLocal() }) }),
      remove: (id) => request(`${base}/${id}`, { method: 'DELETE' }),
      import: (entries) => request(`${base}/import`, { method: 'POST', body: JSON.stringify({ entries }) }),
      resolve: (titles) => request(`${base}/resolve`, { method: 'POST', body: JSON.stringify({ titles }) }),
      batch: (ids) => request(`${kind === 'manga' ? '/manga' : '/anime'}/batch?ids=${ids.join(',')}`)
    };
  }
};
