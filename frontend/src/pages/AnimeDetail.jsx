import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { STATUSES } from '../constants.js';

export default function AnimeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { byMalId, addToList, updateEntry, removeEntry } = useList();
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

  if (error) {
    return (
      <div className="empty-state">
        <p>{error === 'Anime not found' ? 'We couldn\'t find that anime.' : error}</p>
        <Link to="/search" className="btn btn-ghost">Back to search</Link>
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

  const setStatus = (status) => run(() => addToList(anime, status));

  return (
    <article className="detail">
      <div className="detail-banner" style={{ backgroundImage: `url(${anime.banner || image || ''})` }} />
      <div className="detail-hero">
        {image && <img src={image} alt={anime.title} />}
        <div className="detail-info">
          <h1>{anime.title}</h1>
          <div className="chips">
            <span className="chip chip-strong">★ {anime.score ?? '—'}</span>
            <span className="chip">{anime.type}</span>
            <span className="chip">{anime.episodes ?? '?'} episodes</span>
            {anime.year && <span className="chip">{anime.year}</span>}
            <span className="chip">{(anime.status || '').replaceAll('_', ' ').toLowerCase()}</span>
          </div>
          {anime.genres?.length > 0 && (
            <div className="chips">
              {anime.genres.map((g) => <span key={g} className="chip chip-outline">{g}</span>)}
            </div>
          )}
          <p className={`synopsis ${long && !expanded ? 'clamped' : ''}`}>{synopsis}</p>
          {long && (
            <button className="link-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}

          {user ? (
            <div className="tracker">
              <div className="tracker-label">Your list</div>
              <div className="status-picker">
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    className={entry?.status === s.key ? 'active' : ''}
                    disabled={saving}
                    onClick={() => setStatus(s.key)}
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
                      onChange={(e) =>
                        run(() => updateEntry(entry.id, { score: e.target.value === '' ? null : Number(e.target.value) }))
                      }
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
                  <button className="btn btn-danger-ghost" disabled={saving} onClick={() => run(() => removeEntry(entry.id))}>
                    Remove
                  </button>
                </div>
              )}
              {actionError && <p className="error-text">{actionError}</p>}
            </div>
          ) : (
            <p className="login-hint">
              <Link to="/login">Log in</Link> to add this to your list.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
