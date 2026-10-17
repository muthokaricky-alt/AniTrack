import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { STATUSES } from '../constants.js';
import { gsap, ScrollTrigger, useGSAP } from '../lib/gsap.js';

export default function AnimeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { byMalId, addToList, updateEntry, removeEntry } = useList();
  const root = useRef(null);
  const [anime, setAnime] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAnime(null);
    setError('');
    setExpanded(false);
    api
      .animeDetail(id)
      .then((res) => !cancelled && setAnime(res.data))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id]);

  // Intro stagger + slow parallax on the banner
  useGSAP(
    () => {
      if (!anime) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.d-in', { y: 36, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08 });
        gsap.to('.d-banner-img', {
          yPercent: 16,
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true }
        });
        ScrollTrigger.refresh();
      });
    },
    { scope: root, dependencies: [anime?.mal_id] }
  );

  if (error) {
    return (
      <div className="wrap page-pad">
        <div className="empty-state">
          <p>{error === 'Anime not found' ? "We couldn't find that anime." : error}</p>
          <Link to="/search" className="btn btn-line">Back to search</Link>
        </div>
      </div>
    );
  }
  if (!anime) return <div className="detail-skeleton skeleton-img" aria-busy="true" />;

  const entry = byMalId.get(anime.mal_id);
  const image = anime.images?.jpg?.image_url;
  const synopsis = anime.synopsis || 'No synopsis available.';
  const long = synopsis.length > 420;

  async function run(action) {
    setSaving(true);
    setActionError('');
    try {
      await action();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="detail" ref={root}>
      <div className="d-banner" aria-hidden="true">
        <img className={`d-banner-img ${anime.banner ? '' : 'is-poster'}`} src={anime.banner || image} alt="" />
        <div className="d-banner-shade" />
      </div>

      <div className="wrap d-body">
        <div className="d-poster d-in">{image && <img src={image} alt={anime.title} />}</div>
        <div className="d-info">
          <p className="kicker d-in">
            {anime.type}{anime.year ? ` · ${anime.year}` : ''} · {(anime.status || '').replaceAll('_', ' ').toLowerCase()}
          </p>
          <h1 className="d-title d-in">{anime.title}</h1>

          <dl className="d-facts d-in">
            <div><dt>Score</dt><dd>{anime.score ?? '—'}</dd></div>
            <div><dt>Episodes</dt><dd>{anime.episodes ?? '?'}</dd></div>
            {anime.genres?.length > 0 && <div className="d-genres"><dt>Genres</dt><dd>{anime.genres.join(' / ')}</dd></div>}
          </dl>

          <div className="d-in">
            <p className={`d-syn ${long && !expanded ? 'clamped' : ''}`}>{synopsis}</p>
            {long && (
              <button className="text-link" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>

          {user ? (
            <div className="tracker d-in">
              <p className="kicker">Your list</p>
              <div className="status-picker">
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    className={entry?.status === s.key ? 'active' : ''}
                    disabled={saving}
                    onClick={() => run(() => addToList(anime, s.key))}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {entry && (
                <div className="tracker-fields">
                  <label>
                    Score
                    <select
                      value={entry.score ?? ''}
                      onChange={(e) => run(() => updateEntry(entry.id, { score: e.target.value === '' ? null : Number(e.target.value) }))}
                    >
                      <option value="">Not rated</option>
                      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <label>
                    Episodes watched
                    <input
                      type="number"
                      min="0"
                      max={entry.total_episodes || undefined}
                      defaultValue={entry.episodes_watched ?? 0}
                      key={entry.episodes_watched}
                      onBlur={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0);
                        if (v !== entry.episodes_watched) run(() => updateEntry(entry.id, { episodes_watched: v }));
                      }}
                    />
                  </label>
                  <button className="btn btn-quiet" disabled={saving} onClick={() => run(() => removeEntry(entry.id))}>
                    Remove
                  </button>
                </div>
              )}
              {actionError && <p className="error-text">{actionError}</p>}
            </div>
          ) : (
            <p className="login-hint d-in"><Link to="/login">Log in</Link> to add this to your list.</p>
          )}
        </div>
      </div>
    </article>
  );
}
