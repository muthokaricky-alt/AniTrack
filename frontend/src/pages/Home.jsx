import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AnimeCard from '../components/AnimeCard.jsx';
import SkeletonGrid from '../components/SkeletonGrid.jsx';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [top, setTop] = useState([]);
  const [seasonal, setSeasonal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api.topAnime(), api.seasonalAnime()])
      .then(([topData, seasonalData]) => {
        setTop(topData.data || []);
        setSeasonal(seasonalData.data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function onSearch(e) {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <>
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <span className="eyebrow">Your anime watchlist</span>
        <h1>Track every series <span className="gradient-text">you've ever watched.</span></h1>
        <p>Search the catalog, log what you're watching, rate your favourites and watch your stats grow.</p>
        <form className="hero-search" onSubmit={onSearch}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anime, e.g. Frieren"
            aria-label="Search anime"
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
        {!user && (
          <p className="hero-cta">
            <Link to="/register">Create a free account</Link> to start your list.
          </p>
        )}
      </section>

      {loading && <SkeletonGrid count={12} />}

      {!loading && error && (
        <div className="empty-state">
          <p>{error}</p>
          <button className="btn btn-ghost" onClick={load}>Try again</button>
        </div>
      )}

      {!loading && seasonal.length > 0 && (
        <>
          <div className="section-heading">
            <h2>This season</h2>
            <span>Currently airing</span>
          </div>
          <div className="anime-grid">
            {seasonal.slice(0, 12).map((a) => <AnimeCard key={a.mal_id} anime={a} />)}
          </div>
        </>
      )}

      {!loading && top.length > 0 && (
        <>
          <div className="section-heading">
            <h2>Top rated</h2>
            <span>All-time ranking</span>
          </div>
          <div className="anime-grid">
            {top.slice(0, 12).map((a) => <AnimeCard key={a.mal_id} anime={a} />)}
          </div>
        </>
      )}
    </>
  );
}
