import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import FavoritesShowcase from '../components/FavoritesShowcase.jsx';

function Favorites({ title, items, base }) {
  if (!items.length) return null;
  return (
    <section className="pub-favs">
      <h2 className="mini-h">{title}</h2>
      <div className="fav-grid">
        {items.map((f) => (
          <Link key={f.mal_id} to={`${base}/${f.mal_id}`} className="fav">
            {f.image_url ? <img src={f.image_url} alt="" loading="lazy" /> : <div className="img-fallback" />}
            <span className="fav-score">★ {f.score}</span>
            <p>{f.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Block({ label, data, unit }) {
  return (
    <div className="pub-block">
      <h2 className="mini-h">{label}</h2>
      <dl>
        <div><dt>Titles</dt><dd>{data.total}</dd></div>
        <div><dt>Completed</dt><dd>{data.completed}</dd></div>
        <div><dt>{unit}</dt><dd>{data.progress}</dd></div>
        <div><dt>Mean score</dt><dd>{data.mean ?? '—'}</dd></div>
      </dl>
    </div>
  );
}

export default function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    api
      .publicProfile(username)
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [username]);

  if (error) {
    return (
      <div className="wrap page-pad">
        <div className="empty-state">
          <p>{error}</p>
          <Link to="/" className="btn btn-line">Back to browse</Link>
        </div>
      </div>
    );
  }
  if (!data) return <div className="wrap page-pad"><p className="muted">Loading profile…</p></div>;

  const joined = data.user.joined ? new Date(data.user.joined.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;

  return (
    <div className="wrap page-pad pub">
      <header className="pub-head">
        <Avatar user={data.user} size={148} />
        <div>
          <p className="kicker">Profile{joined ? ` · joined ${joined}` : ''}</p>
          <h1 className="h1">{data.user.username}</h1>
          {data.user.bio && <p className="pub-bio">{data.user.bio}</p>}
        </div>
      </header>

      <div className="pub-blocks">
        <Block label="Anime" data={data.anime} unit="Episodes" />
        <Block label="Manga" data={data.manga} unit="Chapters" />
      </div>

      <FavoritesShowcase favorites={data.favorites} navigate={navigate} />

      <Favorites title="Highest-rated anime" items={data.anime.favorites} base="/anime" />
      <Favorites title="Highest-rated manga" items={data.manga.favorites} base="/manga" />
    </div>
  );
}
