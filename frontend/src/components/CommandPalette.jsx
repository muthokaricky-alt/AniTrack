import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { useMangaList } from '../context/MangaListContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { KINDS } from '../constants.js';
import { getLenis } from './SmoothScroll.jsx';

export const OPEN_EVENT = 'anitrack:palette';
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const PAGES = [
  { label: 'Browse', to: '/', hint: 'Home', words: 'home browse top season' },
  { label: 'Search', to: '/search', hint: 'Find anime', words: 'search find anime' },
  { label: 'Schedule', to: '/schedule', hint: 'This week\'s episodes', words: 'schedule airing calendar week' },
  { label: 'Manga', to: '/manga', hint: 'Browse manga', words: 'manga read' },
  { label: 'My list', to: '/my-list', hint: 'Your anime and manga', words: 'list my watchlist', auth: true },
  { label: 'Profile', to: '/profile', hint: 'Favourites, settings and share card', words: 'profile settings favourites share card account', auth: true },
  { label: 'Log in', to: '/login', hint: '', words: 'login sign in', guest: true },
  { label: 'Create account', to: '/register', hint: '', words: 'register sign up account', guest: true }
];

const norm = (s) => String(s).toLowerCase();

// Ctrl+K (or Cmd+K): jump to a page, open something on your list, or search the catalogue and add to your list without leaving the page.
export default function CommandPalette() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const lists = { anime: useList(), manga: useMangaList() };
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [found, setFound] = useState({ anime: [], manga: [], busy: false });
  const input = useRef(null);
  const listRef = useRef(null);
  const ticket = useRef(0);

  const close = useCallback(() => setOpen(false), []);

  // open / close shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // reset on open, freeze page scroll while open
  useEffect(() => {
    if (!open) return undefined;
    setQ('');
    setActive(0);
    setFound({ anime: [], manga: [], busy: false });
    getLenis()?.stop();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => input.current?.focus(), 0);
    return () => {
      clearTimeout(t);
      getLenis()?.start();
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  // catalogue search, a quarter second after typing stops
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) {
      setFound({ anime: [], manga: [], busy: false });
      return undefined;
    }
    const mine = ++ticket.current;
    setFound((f) => ({ ...f, busy: true }));
    const t = setTimeout(async () => {
      const [a, m] = await Promise.allSettled([api.searchAnime(term), api.searchManga(term)]);
      if (mine !== ticket.current) return; // a newer search has started
      setFound({
        anime: a.status === 'fulfilled' ? (a.value.data || []).slice(0, 5) : [],
        manga: m.status === 'fulfilled' ? (m.value.data || []).slice(0, 4) : [],
        busy: false
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  // everything that can be picked, in display order
  const groups = useMemo(() => {
    const term = norm(q.trim());
    const out = [];
    const pages = PAGES.filter((p) => (p.auth ? user : p.guest ? !user : true)).filter((p) => !term || norm(`${p.label} ${p.words}`).includes(term));
    if (pages.length) out.push({ title: term ? 'Pages' : 'Go to', items: pages.map((p) => ({ id: `p:${p.to}`, label: p.label, sub: p.hint, run: () => navigate(p.to) })) });

    if (user && term.length >= 2) {
      const mine = [];
      for (const kind of ['anime', 'manga']) {
        for (const e of lists[kind].entries) {
          if (norm(e.title).includes(term)) mine.push({ id: `l:${kind}:${e.mal_id}`, label: e.title, sub: `On your ${kind} list`, image: e.image_url, run: () => navigate(`${KINDS[kind].path}/${e.mal_id}`) });
        }
      }
      if (mine.length) out.push({ title: 'On your list', items: mine.slice(0, 5) });
    }

    for (const kind of ['anime', 'manga']) {
      const rows = found[kind];
      if (!rows.length) continue;
      const cfg = KINDS[kind];
      out.push({
        title: kind === 'anime' ? 'Anime' : 'Manga',
        items: rows.map((a) => ({
          id: `c:${kind}:${a.mal_id}`,
          label: a.title,
          sub: [a.type, a[cfg.totalProp] ? `${a[cfg.totalProp]} ${cfg.unitShort}` : null, a.year].filter(Boolean).join(' · '),
          image: a.images?.jpg?.image_url,
          add: user ? { kind, item: a } : null,
          run: () => navigate(`${cfg.path}/${a.mal_id}`)
        }))
      });
    }
    if (term.length >= 2) {
      out.push({ title: 'More', items: [{ id: 'search-all', label: `Search all results for “${q.trim()}”`, sub: 'Opens the search page', run: () => navigate(`/search?q=${encodeURIComponent(q.trim())}`) }] });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, user, found, lists.anime.entries, lists.manga.entries]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, flat.length - 1))); }, [flat.length]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active, flat]);

  async function addToPlan(item) {
    if (!item.add) return;
    const { kind, item: a } = item.add;
    try {
      await lists[kind].addToList(a, KINDS[kind].defaultStatus, { keepExisting: true });
      toast(`Added “${a.title}” to ${KINDS[kind].planLabel}`);
    } catch (err) {
      toast(err.message || 'Could not add that title', 'error');
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (flat.length ? (a + 1) % flat.length : 0)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (flat.length ? (a - 1 + flat.length) % flat.length : 0)); return; }
    if (e.key === 'Tab') { e.preventDefault(); return; }
    if (e.key === 'Enter') {
      const item = flat[active];
      if (!item) return;
      e.preventDefault();
      if (e.altKey && item.add) { addToPlan(item); return; }
      close();
      item.run();
    }
  }

  if (!open) return null;
  let index = -1;

  return (
    <div className="cp-back" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="cp" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={input}
          className="cp-input"
          role="combobox"
          aria-expanded="true"
          aria-controls="cp-list"
          aria-activedescendant={flat[active] ? `cp-${flat[active].id}` : undefined}
          aria-autocomplete="list"
          placeholder="Search anime and manga, or jump to a page"
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          spellCheck="false"
          autoComplete="off"
        />
        <div className="cp-list" id="cp-list" role="listbox" ref={listRef}>
          {groups.map((g) => (
            <div key={g.title} role="group" aria-label={g.title}>
              <p className="cp-group">{g.title}</p>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                return (
                  <div
                    key={item.id}
                    id={`cp-${item.id}`}
                    role="option"
                    aria-selected={i === active}
                    className={`cp-item ${i === active ? 'is-active' : ''}`}
                    onMouseMove={() => active !== i && setActive(i)}
                    onClick={() => { close(); item.run(); }}
                  >
                    {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="cp-dot" />}
                    <span className="cp-main">
                      <span className="cp-label">{item.label}</span>
                      {item.sub && <span className="cp-sub">{item.sub}</span>}
                    </span>
                    {item.add && (
                      <button
                        type="button"
                        className="cp-add"
                        tabIndex={-1}
                        onClick={(e) => { e.stopPropagation(); addToPlan(item); }}
                        aria-label={`Add ${item.label} to ${KINDS[item.add.kind].planLabel}`}
                      >
                        + {KINDS[item.add.kind].planLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {found.busy && <p className="cp-note">Searching…</p>}
          {!found.busy && q.trim().length >= 2 && flat.length <= 1 && <p className="cp-note">No titles found. Check the spelling or try a shorter name.</p>}
        </div>
        <p className="cp-keys">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          {user && <span><kbd>Alt</kbd><kbd>Enter</kbd> add to plan</span>}
          <span><kbd>Esc</kbd> close</span>
        </p>
      </div>
    </div>
  );
}
