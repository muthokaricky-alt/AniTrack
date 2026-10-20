import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useList } from '../context/ListContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const WEEK = 7 * 86400;
const SHOWN = 6;

function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function until(secs) {
  if (secs <= 0) return 'airing now';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function dayLabel(ts, now) {
  const day = (t) => new Date(t * 1000).setHours(0, 0, 0, 0);
  const diff = Math.round((day(ts) - day(now)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return new Date(ts * 1000).toLocaleDateString(undefined, { weekday: 'long' });
}

// Episodes from your Watching and Plan to watch lists that air in the next seven days, with live countdowns.
export default function AiringWeek() {
  const { entries, byMalId, updateEntry } = useList();
  const toast = useToast();
  const now = useNow();
  const [items, setItems] = useState(null);
  const [all, setAll] = useState(false);
  const key = useMemo(
    () => entries.filter((e) => e.status === 'watching' || e.status === 'plan_to_watch').map((e) => e.mal_id).sort((a, b) => a - b).join(','),
    [entries]
  );

  useEffect(() => {
    if (!key) {
      setItems([]);
      return undefined;
    }
    let off = false;
    api.airing().then((r) => !off && setItems(r.data || [])).catch(() => !off && setItems([]));
    return () => { off = true; };
  }, [key]);

  const week = useMemo(() => (items || []).filter((i) => i.airing_at < now + WEEK), [items, now]);
  if (!week.length) return null;

  const list = all ? week : week.slice(0, SHOWN);
  let lastDay = '';

  async function bump(entry, item) {
    try {
      await updateEntry(entry.id, { episodes_watched: (entry.episodes_watched || 0) + 1 });
    } catch (e) {
      toast(e.message, 'error');
    }
    return item;
  }

  return (
    <section className="air" aria-labelledby="air-title">
      <div className="air-head">
        <h2 id="air-title" className="air-title">Airing this week</h2>
        <p className="muted">From your Watching and Plan to watch lists, in your local time.</p>
      </div>
      <ol className="air-list">
        {list.map((it) => {
          const entry = byMalId.get(it.mal_id);
          const watched = entry?.episodes_watched ?? it.watched;
          const behind = Math.max(0, it.next_episode - 1 - watched);
          const label = dayLabel(it.airing_at, now);
          const head = label !== lastDay;
          lastDay = label;
          const time = new Date(it.airing_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <li key={it.mal_id} className={`air-item ${head ? 'is-first' : ''}`} style={it.color ? { '--c': it.color } : undefined}>
              <span className="air-day">{head ? label : ''}</span>
              <Link to={`/anime/${it.mal_id}`} className="air-cover" aria-hidden="true" tabIndex={-1}>
                {it.image_url && <img src={it.image_url} alt="" loading="lazy" />}
              </Link>
              <div className="air-main">
                <Link to={`/anime/${it.mal_id}`}><h3>{it.title}</h3></Link>
                <p>
                  Episode {it.next_episode}{it.total ? ` of ${it.total}` : ''} at {time}
                  {it.status === 'plan_to_watch' && <span className="air-tag">Plan to watch</span>}
                  {behind > 0 && it.status === 'watching' && <span className="air-tag air-behind">{behind} episode{behind === 1 ? '' : 's'} behind</span>}
                </p>
              </div>
              <span className="air-when">{until(it.airing_at - now)}</span>
              {it.status === 'watching' && entry && behind > 0 ? (
                <button className="btn btn-line btn-sm" onClick={() => bump(entry, it)}>Watched ep {watched + 1}</button>
              ) : (
                <span className="air-spacer" />
              )}
            </li>
          );
        })}
      </ol>
      {week.length > SHOWN && (
        <button className="text-link" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${week.length}`}</button>
      )}
    </section>
  );
}
