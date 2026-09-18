import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

export default function AnimeCard({ anime }) {
  const { user } = useAuth();
  const [added, setAdded] = useState(false);
  const [saving, setSaving] = useState(false);
  const image = anime.images?.jpg?.image_url;

  async function quickAdd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || saving) return;
    setSaving(true);
    try {
      await api.addToList({
        mal_id: anime.mal_id,
        title: anime.title,
        image_url: image,
        status: 'plan_to_watch',
        total_episodes: anime.episodes
      });
      setAdded(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Link to={`/anime/${anime.mal_id}`} className="anime-card">
      <div className="card-image-wrap">
        {image && <img src={image} alt={anime.title} loading="lazy" />}
        {user && (
          <button
            className={`quick-add-btn ${added ? 'added' : ''}`}
            onClick={quickAdd}
            disabled={saving || added}
            title={added ? 'Added to Plan to Watch' : 'Add to Plan to Watch'}
          >
            {added ? '✓' : '+'}
          </button>
        )}
      </div>
      <div className="card-body">
        <h3>{anime.title}</h3>
        <div className="meta">
          {anime.type || 'TV'} · {anime.episodes ?? '?'} ep · {anime.score ?? '—'}★
        </div>
      </div>
    </Link>
  );
}