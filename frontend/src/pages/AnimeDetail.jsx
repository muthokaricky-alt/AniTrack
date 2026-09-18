import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUSES = [
  { key: 'watching', label: 'Watching' },
  { key: 'completed', label: 'Completed' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'plan_to_watch', label: 'Plan to watch' }
];

export default function AnimeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [anime, setAnime] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.animeDetail(id).then((res) => setAnime(res.data)).catch(() => {});
  }, [id]);

  async function setStatus(status) {
    if (!user || !anime) return;
    setSaving(true);
    try {
      await api.addToList({
        mal_id: anime.mal_id,
        title: anime.title,
        image_url: anime.images?.jpg?.image_url,
        status,
        total_episodes: anime.episodes
      });
      setCurrentStatus(status);
    } finally {
      setSaving(false);
    }
  }

  if (!anime) return <p>Loading…</p>;

  return (
    <div className="detail-hero">
      {anime.images?.jpg?.image_url && <img src={anime.images.jpg.image_url} alt={anime.title} />}
      <div>
        <h1>{anime.title}</h1>
        <div className="meta">
          {anime.type} · {anime.episodes ?? '?'} episodes · Score {anime.score ?? '—'} · {anime.status}
        </div>
        <p className="synopsis">{anime.synopsis || 'No synopsis available.'}</p>

        {user ? (
          <div className="status-picker">
            {STATUSES.map((s) => (
              <button
                key={s.key}
                className={currentStatus === s.key ? 'active' : ''}
                disabled={saving}
                onClick={() => setStatus(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          <p style={{ marginTop: 20, color: 'var(--muted)' }}>Log in to add this to your list.</p>
        )}
      </div>
    </div>
  );
}
