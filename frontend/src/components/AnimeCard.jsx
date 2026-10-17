import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { STATUS_LABEL } from '../constants.js';

export default function AnimeCard({ anime, rank }) {
  const { user } = useAuth();
  const { byMalId, addToList } = useList();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const image = anime.images?.jpg?.image_url;
  const entry = byMalId.get(anime.mal_id);

  async function quickAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (saving || entry) return;
    setSaving(true);
    setFailed(false);
    try {
      await addToList(anime, 'plan_to_watch', { keepExisting: true });
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Link to={`/anime/${anime.mal_id}`} className="anime-card">
      <div className="poster">
        {image ? <img src={image} alt="" loading="lazy" draggable="false" /> : <div className="img-fallback">No image</div>}
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
            aria-label={`Add ${anime.title} to Plan to Watch`}
            title={failed ? 'Could not add. Click to retry' : 'Add to Plan to Watch'}
          >
            {saving ? '…' : failed ? '!' : '+'}
          </button>
        )}
      </div>
      <div className="card-meta">
        <h3>{anime.title}</h3>
        <p>
          {anime.type || 'TV'} · {anime.episodes ?? '?'} EP
          {anime.score != null && <b> · ★ {Number(anime.score).toFixed(1)}</b>}
        </p>
      </div>
    </Link>
  );
}
