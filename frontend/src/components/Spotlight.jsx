import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { gsap, useGSAP, prefersReducedMotion } from '../lib/gsap.js';

const INTERVAL = 7000;

// Full-bleed key-art slideshow (the Crunchyroll-style feature banner). Pauses on hover, static for reduced motion.
export default function Spotlight({ items }) {
  const { user } = useAuth();
  const { byMalId, addToList } = useList();
  const root = useRef(null);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const reduced = prefersReducedMotion();
  const live = !reduced && !paused && items.length > 1;

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setI((n) => (n + 1) % items.length), INTERVAL);
    return () => clearInterval(id);
  }, [live, items.length, i]);

  useGSAP(
    () => {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
        gsap.to('.spot-img', {
          yPercent: 10,
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    },
    { scope: root }
  );

  const a = items[i];
  const entry = byMalId.get(a.mal_id);
  const meta = [a.type, a.episodes ? `${a.episodes} EP` : null, a.score != null ? `★ ${Number(a.score).toFixed(1)}` : null]
    .filter(Boolean)
    .join(' · ');

  async function add() {
    setBusy(true);
    try {
      await addToList(a, 'plan_to_watch', { keepExisting: true });
    } catch {
      /* the card shows nothing new; user can retry */
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={`spot ${live ? 'is-live' : ''}`}
      ref={root}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured this season"
    >
      <div className="spot-media" aria-hidden="true">
        {items.map((it, n) => (
          <img key={it.mal_id} className={`spot-img ${n === i ? 'is-on' : ''}`} src={it.banner} alt="" loading={n === 0 ? 'eager' : 'lazy'} />
        ))}
        <div className="spot-shade" />
      </div>

      <div className="wrap spot-body">
        <div className="spot-text" key={a.mal_id}>
          <p className="kicker">
            Spotlight · {String(i + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </p>
          <h2 className="spot-title">{a.title}</h2>
          <p className="spot-meta">{meta}{a.genres?.length ? ` · ${a.genres.slice(0, 3).join(' / ')}` : ''}</p>
          {a.synopsis && <p className="spot-syn">{a.synopsis}</p>}
          <div className="spot-actions">
            <Link className="btn btn-signal" to={`/anime/${a.mal_id}`}>View details</Link>
            {user && !entry && (
              <button className="btn btn-line" disabled={busy} onClick={add}>+ Plan to watch</button>
            )}
            {entry && <span className="spot-saved">In your list</span>}
          </div>
        </div>

        {items.length > 1 && (
          <div className="spot-dots">
            {items.map((it, n) => (
              <button key={it.mal_id} className={n === i ? 'on' : ''} onClick={() => setI(n)} aria-label={`Show ${it.title}`}>
                <i />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
