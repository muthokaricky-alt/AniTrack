import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useList } from '../context/ListContext.jsx';
import { STATUSES } from '../constants.js';

const TABS = [{ key: 'all', label: 'All' }, ...STATUSES];

export default function MyList() {
  const { entries, stats, loading, error, reload, updateEntry, removeEntry } = useList();
  const [tab, setTab] = useState('all');
  const [rowError, setRowError] = useState('');

  const visible = useMemo(
    () => (tab === 'all' ? entries : entries.filter((e) => e.status === tab)),
    [entries, tab]
  );

  async function save(id, patch) {
    setRowError('');
    try {
      await updateEntry(id, patch);
    } catch (e) {
      setRowError(e.message);
    }
  }

  function changeStatus(entry, status) {
    const patch = { status };
    if (status === 'completed' && entry.total_episodes) patch.episodes_watched = entry.total_episodes;
    save(entry.id, patch);
  }

  async function remove(entry) {
    if (!window.confirm(`Remove “${entry.title}” from your list?`)) return;
    try {
      await removeEntry(entry.id);
    } catch (e) {
      setRowError(e.message);
    }
  }

  if (loading && entries.length === 0) return <p className="muted">Loading your list…</p>;
  if (error && entries.length === 0) {
    return (
      <div className="empty-state">
        <p>{error}</p>
        <button className="btn btn-ghost" onClick={reload}>Try again</button>
      </div>
    );
  }

  return (
    <>
      <div className="page-title">
        <h1>My list</h1>
        <p>Everything you're tracking, in one place.</p>
      </div>

      <div className="stats-strip">
        <div className="stat"><strong>{stats.total}</strong><span>Titles</span></div>
        <div className="stat"><strong>{stats.episodes}</strong><span>Episodes</span></div>
        <div className="stat"><strong>{stats.mean ?? '—'}</strong><span>Mean score</span></div>
      </div>

      <div className="status-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
            <span className="count">{t.key === 'all' ? stats.total : stats.counts[t.key] || 0}</span>
          </button>
        ))}
      </div>

      {rowError && <p className="error-text">{rowError}</p>}

      {visible.length === 0 && (
        <div className="empty-state">
          Nothing here yet. <Link to="/search">Search for something to add</Link>.
        </div>
      )}

      <div className="list-rows">
        {visible.map((entry) => {
          const total = entry.total_episodes;
          const watched = entry.episodes_watched ?? 0;
          const pct = total ? Math.min(100, Math.round((watched / total) * 100)) : 0;
          return (
            <div className="list-row" key={entry.id}>
              <Link to={`/anime/${entry.mal_id}`} className="list-cover">
                {entry.image_url ? <img src={entry.image_url} alt="" loading="lazy" /> : <div className="img-fallback" />}
              </Link>
              <div className="list-main">
                <Link to={`/anime/${entry.mal_id}`}><h3>{entry.title}</h3></Link>
                <div className="progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
                <div className="meta">
                  {watched} {total ? `of ${total}` : ''} episodes{total ? ` · ${pct}%` : ''}
                </div>
              </div>
              <div className="list-controls">
                <button
                  className="icon-btn small"
                  title="Watched one more episode"
                  aria-label="Add one watched episode"
                  disabled={total ? watched >= total : false}
                  onClick={() => save(entry.id, { episodes_watched: watched + 1 })}
                >+1</button>
                <select value={entry.status} onChange={(e) => changeStatus(entry, e.target.value)} aria-label="Status">
                  {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <select
                  value={entry.score ?? ''}
                  onChange={(e) => save(entry.id, { score: e.target.value === '' ? null : Number(e.target.value) })}
                  aria-label="Your score"
                >
                  <option value="">Score</option>
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                </select>
                <button className="btn btn-danger-ghost btn-sm" onClick={() => remove(entry)}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
