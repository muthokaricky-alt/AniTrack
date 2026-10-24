import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import CountUp from '../components/CountUp.jsx';
import TasteMatch from '../components/TasteMatch.jsx';
import FollowBar from '../components/FollowBar.jsx';
import Banner from '../components/Banner.jsx';
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
        <div><dt>Titles</dt><dd><CountUp value={data.total} /></dd></div>
        <div><dt>Completed</dt><dd><CountUp value={data.completed} /></dd></div>
        <div><dt>{unit}</dt><dd><CountUp value={data.progress} /></dd></div>
        <div><dt>Mean score</dt><dd><CountUp value={data.mean} /></dd></div>
      </dl>
    </div>
  );
}

export default function PublicProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: viewer } = useAuth();
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
      {data.user.banner && <Banner src={data.user.banner.src} x={data.user.banner.x} y={data.user.banner.y} />}
      <header className={`pub-head ${data.user.banner ? 'has-banner' : ''}`}>
        <Avatar user={data.user} size={148} />
        <div>
          <p className="kicker">Profile{joined ? ` · joined ${joined}` : ''}</p>
          <h1 className="h1">{data.user.username}</h1>
          {data.user.bio && <p className="pub-bio">{data.user.bio}</p>}
        </div>
      </header>

      <FollowBar username={data.user.username} viewer={viewer} />

      <div className="pub-blocks">
        <Block label="Anime" data={data.anime} unit="Episodes" />
        <Block label="Manga" data={data.manga} unit="Chapters" />
      </div>

      {!(viewer && viewer.username.toLowerCase() === data.user.username.toLowerCase()) && (
        <TasteMatch username={data.user.username} viewer={viewer} />
      )}

      <FavoritesShowcase favorites={data.favorites} navigate={navigate} />

      <Favorites title="Highest-rated anime" items={data.anime.favorites} base="/anime" />
      <Favorites title="Highest-rated manga" items={data.manga.favorites} base="/manga" />
    </div>
  );
}
