const BASE = '/api';

function authHeaders() {
  const token = localStorage.getItem('anitrack_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {})
    }
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  searchAnime: (q, page = 1) => request(`/anime/search?q=${encodeURIComponent(q)}&page=${page}`),
  topAnime: (page = 1) => request(`/anime/top?page=${page}`),
  seasonalAnime: () => request('/anime/season/now'),
  animeDetail: (id) => request(`/anime/${id}`),

  getList: () => request('/list'),
  getStats: () => request('/list/stats'),
  addToList: (body) => request('/list', { method: 'POST', body: JSON.stringify(body) }),
  updateEntry: (id, body) => request(`/list/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  removeEntry: (id) => request(`/list/${id}`, { method: 'DELETE' })
};
