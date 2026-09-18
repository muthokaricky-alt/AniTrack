import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AnimeCard from '../components/AnimeCard.jsx';
  import SkeletonGrid from '../components/SkeletonGrid.jsx';

export default function Home() {
  const [top, setTop] = useState([]);
  const [seasonal, setSeasonal] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.topAnime(), api.seasonalAnime()])
      .then(([topData, seasonalData]) => {
        setTop(topData.data || []);
        setSeasonal(seasonalData.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Track every series you've ever watched.</h1>
          <p>
            AniTrack is a simple ledger for anime — search the catalog, log what you're
            watching, and keep score of what you've finished.
          </p>
        </div>
        <div className="hero-index">
          <strong>{top.length + seasonal.length || '—'}</strong>
          titles indexed below
        </div>
      </section>

       {loading && <SkeletonGrid count={12} />}

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
