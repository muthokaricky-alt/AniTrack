import { Link } from 'react-router-dom';

export default function AnimeCard({ anime }) {
  const image = anime.images?.jpg?.image_url;
  return (
    <Link to={`/anime/${anime.mal_id}`} className="anime-card">
      {image && <img src={image} alt={anime.title} loading="lazy" />}
      <div className="card-body">
        <h3>{anime.title}</h3>
        <div className="meta">
          {anime.type || 'TV'} · {anime.episodes ?? '?'} ep · {anime.score ?? '—'}★
        </div>
      </div>
    </Link>
  );
}
