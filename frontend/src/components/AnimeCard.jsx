import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { gsap, prefersReducedMotion } from '../lib/gsap.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { useMangaList } from '../context/MangaListContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { STATUS_LABEL, KINDS } from '../constants.js';

// Works for anime and manga: pass kind="manga" for manga items
export default function AnimeCard({ anime, rank, kind = 'anime' }) {
  const { user } = useAuth();
  const animeList = useList();
  const mangaList = useMangaList();
  const { byMalId, addToList } = kind === 'manga' ? mangaList : animeList;
  const cfg = KINDS[kind];
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const poster = useRef(null);

  // Poster tilts towards the pointer with a soft light that follows it. Mouse only, and not with reduced motion.
  useEffect(() => {
    const el = poster.current;
    if (!el || prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3.out' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3.out' });
    gsap.set(el, { transformPerspective: 800 });
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      ry((x - 0.5) * 14);
      rx((0.5 - y) * 14);
      el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      el.classList.add('is-tilting');
    };
    const leave = () => {
      rx(0);
      ry(0);
      el.classList.remove('is-tilting');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: 'transform' });
    };
  }, []);
  const image = anime.images?.jpg?.image_url;
  const entry = byMalId.get(anime.mal_id);

  async function quickAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (saving || entry) return;
    setSaving(true);
    setFailed(false);
    try {
      await addToList(anime, cfg.defaultStatus, { keepExisting: true });
      toast(`Added “${anime.title}” to ${cfg.planLabel}`);
    } catch (err) {
      setFailed(true);
      toast(err.message || 'Could not add that title', 'error');
    } finally {
      setSaving(false);
    }
  }

  const count = anime[cfg.totalProp];

  return (
    <Link to={`${cfg.path}/${anime.mal_id}`} className="anime-card">
      <div className="poster" ref={poster}>
        {image ? <img src={image} alt="" loading="lazy" draggable="false" /> : <div className="img-fallback">No image</div>}
        <span className="glare" aria-hidden="true" />
        {rank != null && <span className="rank" aria-label={`Rank ${rank}`}>{rank}</span>}
        {entry && (
          <span className={`tag tag-${entry.status}`}>
            <i />{STATUS_LABEL[entry.status]}
          </span>
        )}
        {user && !entry && (
          <button
            className={`quick-add ${failed ? 'failed' : ''}`}
            onClick={quickAdd}
            disabled={saving}
            aria-label={`Add ${anime.title} to ${cfg.planLabel}`}
            title={failed ? 'Could not add. Click to retry' : `Add to ${cfg.planLabel}`}
          >
            {saving ? '…' : failed ? '!' : '+'}
          </button>
        )}
      </div>
      <div className="card-meta">
        <h3>{anime.title}</h3>
        <p>
          {anime.type || (kind === 'manga' ? 'MANGA' : 'TV')} · {count ?? '?'} {cfg.unitShort}
          {anime.score != null && <b> · ★ {Number(anime.score).toFixed(1)}</b>}
        </p>
      </div>
    </Link>
  );
}
