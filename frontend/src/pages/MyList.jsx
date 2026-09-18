import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'watching', label: 'Watching' },
  { key: 'completed', label: 'Completed' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'plan_to_watch', label: 'Plan to watch' }
];

export default function MyList() {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [list, statData] = await Promise.all([api.getList(), api.getStats()]);
    setEntries(list);
    setStats(statData);
    setLoading(false);
  }

  async function refreshStats() {
    const statData = await api.getStats();
    setStats(statData);
  }

  useEffect(() => { refresh(); }, []);

  function updateLocal(id, patch) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function persist(id, patch) {
    await api.updateEntry(id, patch);
    refreshStats();
  }

  function handleStatusChange(entry, status) {
    const patch = { status };
    if (status === 'completed' && entry.total_episodes) {
      patch.episodes_watched = entry.total_episodes;
    }
    updateLocal(entry.id, patch);
    persist(entry.id, patch);
  }

  async function removeEntry(id) {
    await api.removeEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    refreshStats();
  }

  const visible = tab === 'all' ? entries : entries.filter((e) => e.status === tab);

  if (loading) return <p>Loading your list…</p>;

  return (
    <>
      <div className="section-heading" style={{ border: 'none' }}>
        <h2>My list</h2>
      </div>

      {stats && (
        <div className="stats-strip">
          <div className="stat"><strong>{stats.totalEntries}</strong><span>Titles</span></div>
          <div className="stat"><strong>{stats.episodesWatched}</strong><span>Episodes</span></div>
          <div className="stat"><strong>{stats.meanScore ?? '—'}</strong><span>Mean score</span></div>
        </div>
      )}

      <div className="status-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="empty-state">
          Nothing here yet. <Link to="/search" style={{ borderBottom: '1px solid var(--accent)' }}>Search for something to add</Link>.
        </div>
      )}

      {visible.map((entry) => (
        <div className="list-row" key={entry.id}>
          {entry.image_url && <img src={entry.image_url} alt={entry.title} />}
          <div>
            <h3>{entry.title}</h3>
          </div>

          <div className="meta">
  {entry.total_episodes ? `of ${entry.total_episodes} episodes` : 'Episode count unknown'}
</div>

          <select
            value={entry.status}
            onChange={(e) => handleStatusChange(entry, e.target.value)}
          >
            {TABS.filter((t) => t.key !== 'all').map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            max={entry.total_episodes || undefined}
            value={entry.episodes_watched ?? 0}
            title="Episodes watched"
            style={{ width: 56 }}
            onChange={(e) => {
              const value = e.target.value;
              updateLocal(entry.id, { episodes_watched: value === '' ? 0 : Number(value) });
            }}
            onBlur={(e) => {
              const value = e.target.value;
              persist(entry.id, { episodes_watched: value === '' ? 0 : Number(value) });
            }}
          />
          <input
            type="number"
            min="0"
            max="10"
            value={entry.score ?? ''}
            placeholder="Score"
            title="Your score"
            style={{ width: 56 }}
            onChange={(e) => {
              const value = e.target.value;
              updateLocal(entry.id, { score: value === '' ? null : Number(value) });
            }}
            onBlur={(e) => {
              const value = e.target.value;
              persist(entry.id, { score: value === '' ? null : Number(value) });
            }}
          />
          <button className="nav-user-btn" onClick={() => removeEntry(entry.id)}>Remove</button>
        </div>
      ))}
    </>
  );
}