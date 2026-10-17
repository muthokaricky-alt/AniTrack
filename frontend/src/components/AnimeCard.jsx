import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { STATUS_LABEL } from '../constants.js';

export default function AnimeCard({ anime }) {
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
      <div className="card-image-wrap">
        {image ? <img src={image} alt="" loading="lazy" /> : <div className="img-fallback">No image</div>}
        {anime.score != null && <span className="score-badge">★ {anime.score.toFixed(1)}</span>}
        {entry && <span className={`status-pill status-${entry.status}`}>{STATUS_LABEL[entry.status]}</span>}
        {user && !entry && (
          <button
            className={`quick-add-btn ${failed ? 'failed' : ''}`}
            onClick={quickAdd}
            disabled={saving}
            aria-label={`Add ${anime.title} to Plan to Watch`}
            title={failed ? 'Could not add. Tap to retry' : 'Add to Plan to Watch'}
          >
            {saving ? '…' : failed ? '!' : '+'}
          </button>
        )}
      </div>
      <div className="card-body">
        <h3>{anime.title}</h3>
        <div className="meta">
          {anime.type || 'TV'} · {anime.episodes ?? '?'} ep
        </div>
      </div>
    </Link>
  );
}
