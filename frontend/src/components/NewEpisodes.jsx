import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';

const SEEN_KEY = 'anitrack:eps-seen';

// Bell in the top bar: shows currently airing shows on your list that have episodes you have not watched yet
export default function NewEpisodes() {
  const { user } = useAuth();
  const { entries } = useList();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } });
  const box = useRef(null);

  // refetch on login and whenever the list changes (watching an episode lowers the count)
  const sig = entries.map((e) => `${e.mal_id}:${e.episodes_watched}:${e.status}`).join('|');
  useEffect(() => {
    if (!user) { setRows([]); return undefined; }
    let off = false;
    const t = setTimeout(() => {
      api.airing().then((r) => !off && setRows((r.data || []).filter((x) => x.behind > 0))).catch(() => {});
    }, 600);
    return () => { off = true; clearTimeout(t); };
  }, [user, sig]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!user) return null;
  const signature = rows.map((r) => `${r.mal_id}:${r.behind}`).join(',');
  const unread = rows.length > 0 && signature !== seen;
  const toggle = () => {
    setOpen((v) => !v);
    if (!open && signature) {
      setSeen(signature);
      try { localStorage.setItem(SEEN_KEY, signature); } catch { /* ignore */ }
    }
  };

  return (
    <div className="bell" ref={box}>
      <button type="button" className="theme-btn" onClick={toggle} aria-expanded={open} aria-label={rows.length ? `${rows.length} shows with new episodes` : 'New episodes'}>
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d="M5 8a5 5 0 0 1 10 0c0 5 2 6 2 6H3s2-1 2-6zM8.5 17h3" /></svg>
        {unread && <i className="bell-dot" />}
      </button>
      {open && (
        <div className="theme-pop bell-pop" role="dialog" aria-label="New episodes">
          <p className="mini-h">New episodes</p>
          {rows.length === 0 ? (
            <p className="muted">You are all caught up.</p>
          ) : (
            <ul>
              {rows.slice(0, 6).map((r) => (
                <li key={r.mal_id}>
                  <Link to={`/anime/${r.mal_id}`} onClick={() => setOpen(false)}>
                    <strong>{r.title}</strong>
                    <span>{r.behind} new episode{r.behind === 1 ? '' : 's'} to watch</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {rows.length > 0 && <Link to="/my-list" className="bell-all" onClick={() => setOpen(false)}>Open My List</Link>}
        </div>
      )}
    </div>
  );
}
