import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useList } from '../context/ListContext.jsx';
import { useMangaList } from '../context/MangaListContext.jsx';

const KEY = 'anitrack:welcome-dismissed';

// A three-step checklist for new accounts. Ticks itself and goes away when done or dismissed.
export default function Welcome() {
  const anime = useList();
  const manga = useMangaList();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const [hasTop, setHasTop] = useState(false);

  useEffect(() => {
    if (hidden) return;
    api.favorites().then((f) => setHasTop(['anime', 'manga'].some((k) => (f[k]?.top3?.length || 0) > 0))).catch(() => {});
  }, [hidden]);

  const all = [...anime.entries, ...manga.entries];
  const steps = [
    { done: all.length > 0, text: 'Add a title', to: '/search', hint: 'Search, then use the + on a card' },
    { done: all.some((e) => (e.episodes_watched || e.chapters_read || 0) > 0), text: 'Log an episode with +1', to: '/my-list', hint: 'On any row in My List' },
    { done: hasTop, text: 'Pick your Top 3', to: '/profile', hint: 'Profile, then Favourites' }
  ];
  const finished = steps.every((s) => s.done);

  useEffect(() => {
    if (finished) { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } }
  }, [finished]);

  if (hidden || finished) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };

  return (
    <section className="wl" aria-label="Getting started">
      <div className="wl-head">
        <h2 className="wl-title">Getting started</h2>
        <button type="button" className="wl-x" onClick={dismiss} aria-label="Dismiss getting started">×</button>
      </div>
      <ol className="wl-steps">
        {steps.map((s) => (
          <li key={s.text} className={s.done ? 'is-done' : ''}>
            <span className="wl-check" aria-hidden="true">{s.done ? '✓' : ''}</span>
            <span><Link to={s.to}>{s.text}</Link><em>{s.hint}</em></span>
          </li>
        ))}
      </ol>
      <p className="muted wl-foot">More tips live in the <Link to="/guide">Guide</Link>.</p>
    </section>
  );
}
