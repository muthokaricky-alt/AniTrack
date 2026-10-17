import { Link } from 'react-router-dom';
import { useState } from 'react';
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
