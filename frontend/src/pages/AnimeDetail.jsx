import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { useMangaList } from '../context/MangaListContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { KINDS } from '../constants.js';
import { gsap, ScrollTrigger, useGSAP } from '../lib/gsap.js';
import { useAccent } from '../lib/useAccent.js';
import AnimeCard from '../components/AnimeCard.jsx';
import ScoreInput from '../components/ScoreInput.jsx';

// "Episode 7 airs in 2d 4h 10m", refreshed every 30 seconds
function Countdown({ at, episode }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, at - Math.floor(now / 1000));
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return (
    <div className="d-next">
      <dt>Episode {episode} airs in</dt>
      <dd>{d > 0 ? `${d}d ` : ''}{h}h {m}m</dd>
    </div>
  );
}

// Serves /anime/:id and /manga/:id
export default function AnimeDetail({ kind = 'anime' }) {
  const cfg = KINDS[kind];
  const { id } = useParams();
  const { user } = useAuth();
  const animeList = useList();
  const mangaList = useMangaList();
  const { byMalId, addToList, updateEntry, removeEntry, restoreEntries } = kind === 'manga' ? mangaList : animeList;
  const toast = useToast();
  const root = useRef(null);
  const [anime, setAnime] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAnime(null);
    setError('');
    setExpanded(false);
    setShowTrailer(false);
    (kind === 'manga' ? api.mangaDetail(id) : api.animeDetail(id))
      .then((res) => !cancelled && setAnime(res.data))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id, kind]);

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
    { scope: root, dependencies: [anime?.mal_id, kind] }
  );

  // the whole site takes on this cover's colour while you're here
  useAccent(anime?.color);

  if (error) {
    return (
      <div className="wrap page-pad">
        <div className="empty-state">
          <p>{/not found/i.test(error) ? "We couldn't find that one." : error}</p>
          <Link to={kind === 'manga' ? '/manga' : '/search'} className="btn btn-line">Back to {kind === 'manga' ? 'manga' : 'search'}</Link>
        </div>
      </div>
    );
  }
  if (!anime) return <div className="detail-skeleton skeleton-img" aria-busy="true" />;

  const entry = byMalId.get(anime.mal_id);
  const image = anime.images?.jpg?.image_url;
  const synopsis = anime.synopsis || 'No synopsis available.';
  const long = synopsis.length > 420;
  const total = anime[cfg.totalProp];
  const given = entry ? Object.values(entry.ratings || {}).filter((v) => typeof v === 'number') : [];
  const avg = given.length >= 2 ? Math.round((given.reduce((a, b) => a + b, 0) / given.length) * 2) / 2 : null;

  async function run(action, success) {
    setSaving(true);
    setActionError('');
    try {
      await action();
      if (success) toast(success);
    } catch (e) {
      setActionError(e.message);
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="detail" ref={root}>
      <div className="d-banner" aria-hidden="true">
        <img className={`d-banner-img ${anime.banner ? '' : 'is-poster'}`} src={anime.banner || image} alt="" />
        <div className="d-banner-tint" />
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
            <div><dt>{cfg.unit}</dt><dd>{total ?? '?'}</dd></div>
            {kind === 'manga' && anime.volumes && <div><dt>Volumes</dt><dd>{anime.volumes}</dd></div>}
            {anime.studio && <div><dt>Studio</dt><dd>{anime.studio}</dd></div>}
            {kind === 'anime' && anime.next_airing && <Countdown at={anime.next_airing.airing_at} episode={anime.next_airing.episode} />}
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

          {anime.trailer && (
            <div className="d-trailer d-in">
              {showTrailer ? (
                <iframe
                  title={`${anime.title} trailer`}
                  src={`https://www.youtube-nocookie.com/embed/${anime.trailer}?autoplay=1&rel=0`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button type="button" className="btn btn-line btn-sm" onClick={() => setShowTrailer(true)}>▶ Watch trailer</button>
              )}
            </div>
          )}

          {user ? (
            <div className="tracker d-in">
              <p className="kicker">Your list</p>
              <div className="status-picker">
                {cfg.statuses.map((s) => (
                  <button
                    key={s.key}
                    className={entry?.status === s.key ? 'active' : ''}
                    disabled={saving}
                    onClick={() => run(() => addToList(anime, s.key), `Marked as ${s.label.toLowerCase()}`)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {entry && (
                <>
                  <div className="tracker-score">
                    <ScoreInput
                      label="Overall score"
                      value={entry.score ?? null}
                      onCommit={(v) => run(() => updateEntry(entry.id, { score: v }))}
                    />
                  </div>
                  <div className="tracker-fields">
                    <label>
                      {cfg.progressLabel}
                      <input
                        type="number"
                        min="0"
                        max={entry[cfg.total] || undefined}
                        defaultValue={entry[cfg.progress] ?? 0}
                        key={entry[cfg.progress]}
                        onBlur={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          if (v !== entry[cfg.progress]) run(() => updateEntry(entry.id, { [cfg.progress]: v }));
                        }}
                      />
                    </label>
                    <button className="btn btn-quiet" disabled={saving} onClick={() => run(async () => { const copy = entry; await removeEntry(copy.id); toast('Removed from your list', 'info', { action: { label: 'Undo', onClick: () => restoreEntries([copy]).catch((e) => toast(e.message, 'error')) } }); })}>
                      Remove
                    </button>
                  </div>
                  <details className="rate-detail" open={Object.keys(entry.ratings || {}).length > 0}>
                    <summary>Rate in detail <em>(optional)</em></summary>
                    <div className="rate-grid">
                      {cfg.ratings.map((c) => (
                        <ScoreInput
                          key={c.key}
                          label={c.label}
                          value={entry.ratings?.[c.key] ?? null}
                          onCommit={(v) => run(() => updateEntry(entry.id, { ratings: { ...(entry.ratings || {}), [c.key]: v } }))}
                        />
                      ))}
                    </div>
                    {avg != null && (
                      <p className="rate-avg">
                        Average of your detailed ratings: <strong>{avg}</strong>
                        {entry.score !== avg && (
                          <button type="button" className="text-link" onClick={() => run(() => updateEntry(entry.id, { score: avg }))}>
                            Use as overall
                          </button>
                        )}
                      </p>
                    )}
                  </details>
                  <label className="notes">
                    Private notes
                    <textarea
                      rows="3"
                      maxLength="5000"
                      placeholder="Thoughts, where you stopped, who recommended it…"
                      defaultValue={entry.review || ''}
                      key={`notes-${entry.id}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (entry.review || '')) run(() => updateEntry(entry.id, { review: v || null }), 'Notes saved');
                      }}
                    />
                  </label>
                </>
              )}
              {actionError && <p className="error-text">{actionError}</p>}
            </div>
          ) : (
            <p className="login-hint d-in"><Link to="/login">Log in</Link> to add this to your list.</p>
          )}
        </div>
      </div>

      {anime.relations?.length > 0 && (
        <div className="wrap recs">
          <p className="kicker">Same story</p>
          <h2 className="h2">Seasons and related</h2>
          <div className="anime-grid recs-grid rel-grid">
            {anime.relations.map((r) => (
              <div key={`${r.relation}${r.mal_id}`} className="rel-item">
                <span className="rel-tag">{r.relation}</span>
                <AnimeCard anime={r} kind="anime" />
              </div>
            ))}
          </div>
        </div>
      )}

      {anime.recommendations?.length > 0 && (
        <div className="wrap recs">
          <p className="kicker">Readers also liked</p>
          <h2 className="h2">More like this</h2>
          <div className="anime-grid recs-grid">
            {anime.recommendations.slice(0, 6).map((r) => <AnimeCard key={r.mal_id} anime={r} kind={kind} />)}
          </div>
        </div>
      )}
    </article>
  );
}
