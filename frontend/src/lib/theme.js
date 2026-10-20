const KEY = 'anitrack:theme';
export const ACCENTS = [
  { key: 'orange', label: 'Orange', color: '#ff4b1f' },
  { key: 'blue', label: 'Blue', color: '#3b82f6' },
  { key: 'green', label: 'Green', color: '#22c55e' },
  { key: 'pink', label: 'Pink', color: '#ec4899' },
  { key: 'gold', label: 'Gold', color: '#eab308' },
  { key: 'violet', label: 'Violet', color: '#8b5cf6' }
];
export const MODES = [{ key: 'dark', label: 'Dark' }, { key: 'light', label: 'Light' }, { key: 'auto', label: 'Match device' }];

export function readTheme() {
  try { return { mode: 'dark', accent: 'orange', ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { mode: 'dark', accent: 'orange' }; }
}

export function applyTheme({ mode, accent }) {
  const root = document.documentElement;
  const light = mode === 'light' || (mode === 'auto' && window.matchMedia?.('(prefers-color-scheme: light)').matches);
  root.dataset.theme = light ? 'light' : 'dark';
  root.dataset.accent = accent;
}

export function saveTheme(t) {
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* private mode */ }
  applyTheme(t);
}
