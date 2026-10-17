import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { STATUS_LABEL } from '../constants.js';
import { useReveal } from '../lib/useReveal.js';

const POPULAR_AT = 8000; // AniList "popularity" = how many users list the title

function dayLabel(date) {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const base = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  if (date.toDateString() === today.toDateString()) return `Today · ${base}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${base}`;
  return base;
}

export default function Schedule() {
  const { user } = useAuth();
  const { byMalId } = useList();
  const root = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('popular');

  function load() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const from = Math.floor(start.getTime() / 1000);
    setLoading(true);
    setError('');
    api
      .schedule(from, from + 7 * 86400)
      .then((res) => setItems(res.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const shown = useMemo(
    () =>
      items.filter((it) => {
        const mine = byMalId.has(it.anime.mal_id);
        if (filter === 'mine') return mine;
        if (filter === 'popular') return mine || (it.anime.popularity ?? 0) >= POPULAR_AT;
        return true;
      }),
    [items, filter, byMalId]
  );

  const days = useMemo(() => {
    const map = new Map();
    for (const it of shown) {
      const d = new Date(it.airing_at * 1000);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, { date: d, rows: [] });
      map.get(key).rows.push(it);
    }
    return [...map.values()];
  }, [shown]);

  useReveal(root, '.sch-day', [days.length, filter]);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = Date.now();
  const filters = [['popular', 'Popular'], ['all', 'Everything'], ...(user ? [['mine', 'My list']] : [])];

  return (
    <div className="wrap page-pad" ref={root}>
      <div className="page-title">
        <p className="kicker">Next 7 days · {tz}</p>
        <h1 className="h1">Schedule</h1>
      </div>

      <div className="genre-row" role="group" aria-label="Filter the schedule">
        {filters.map(([key, label]) => (
          <button key={key} className={`chip ${filter === key ? 'on' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Loading the week…</p>}
      {!loading && error && (
        <div className="empty-state">
          <p>{error}</p>
          <button className="btn btn-line" onClick={load}>Try again</button>
        </div>
      )}
      {!loading && !error && days.length === 0 && (
        <div className="empty-state">
          {filter === 'mine' ? 'None of the titles on your list air this week.' : 'Nothing found for this filter.'}
        </div>
      )}

      {days.map(({ date, rows }) => (
        <section className="sch-day" key={date.toDateString()}>
          <h2 className="sch-head">{dayLabel(date)}</h2>
          {rows.map((it) => {
            const entry = byMalId.get(it.anime.mal_id);
            const past = it.airing_at * 1000 < now;
            return (
              <Link to={`/anime/${it.anime.mal_id}`} className={`sch-row ${past ? 'is-past' : ''}`} key={`${it.anime.mal_id}-${it.episode}`}>
                <span className="sch-time">
                  {new Date(it.airing_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {it.anime.images?.jpg?.image_url && <img src={it.anime.images.jpg.image_url} alt="" loading="lazy" />}
                <span className="sch-main">
                  <strong>{it.anime.title}</strong>
                  <em>Episode {it.episode}{it.anime.type ? ` · ${it.anime.type}` : ''}</em>
                </span>
                {entry && <span className="sch-tag">{STATUS_LABEL[entry.status]}</span>}
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
