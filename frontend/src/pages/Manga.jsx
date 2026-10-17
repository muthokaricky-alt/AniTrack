import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { GENRES } from '../constants.js';
import { getLenis } from '../components/SmoothScroll.jsx';
import AnimeCard from '../components/AnimeCard.jsx';
import SkeletonGrid from '../components/SkeletonGrid.jsx';

export default function Manga() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const genre = params.get('genre') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const hasQuery = Boolean(q || genre);

  const [input, setInput] = useState(q);
  const [results, setResults] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [trending, setTrending] = useState([]);
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => setInput(q), [q]);

  // Browse view (no search yet): trending + top rated
  useEffect(() => {
    if (hasQuery) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([api.trendingManga(), api.topManga()])
      .then(([t, s]) => {
        if (cancelled) return;
        setTrending(t.data || []);
        setTop(s.data || []);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [hasQuery]);

  // Search view, driven by the URL
  useEffect(() => {
    if (!hasQuery) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .searchManga(q, page, genre)
      .then((data) => {
        if (cancelled) return;
        setResults(data.data || []);
        setHasNext(Boolean(data.pagination?.has_next_page));
      })
      .catch((e) => {
        if (cancelled) return;
        setResults([]);
        setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [q, genre, page, hasQuery]);

  function update(next) {
    const merged = { q, genre, ...next };
    const clean = {};
    if (merged.q) clean.q = merged.q;
    if (merged.genre) clean.genre = merged.genre;
    if (merged.page && merged.page > 1) clean.page = String(merged.page);
    setParams(clean);
  }

  function goToPage(p) {
    update({ page: p });
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="wrap page-pad">
      <div className="page-title">
        <p className="kicker">Catalogue · chapters and volumes</p>
        <h1 className="h1">Manga</h1>
      </div>

      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); update({ q: input.trim(), page: 1 }); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search manga, e.g. Berserk" aria-label="Search manga" />
        <button type="submit">Search</button>
      </form>

      <div className="genre-row" role="group" aria-label="Filter by genre">
        {GENRES.map((g) => (
          <button key={g} className={`chip ${genre === g ? 'on' : ''}`} aria-pressed={genre === g} onClick={() => update({ genre: genre === g ? '' : g, page: 1 })}>
            {g}
          </button>
        ))}
      </div>

      {loading && <SkeletonGrid count={10} />}
      {!loading && error && <div className="empty-state">{error}</div>}

      {!loading && !error && !hasQuery && (
        <>
          <div className="section-heading"><h2 className="h2">Trending now</h2><span className="kicker">Publishing</span></div>
          <div className="anime-grid">{trending.slice(0, 10).map((m) => <AnimeCard key={m.mal_id} anime={m} kind="manga" />)}</div>
          <div className="section-heading"><h2 className="h2">Top rated</h2><span className="kicker">All time</span></div>
          <div className="anime-grid">{top.slice(0, 10).map((m) => <AnimeCard key={m.mal_id} anime={m} kind="manga" />)}</div>
        </>
      )}

      {!loading && !error && hasQuery && results.length === 0 && <div className="empty-state">Nothing matched. Try another spelling or genre.</div>}
      {!loading && hasQuery && results.length > 0 && (
        <>
          <div className="anime-grid">{results.map((m) => <AnimeCard key={m.mal_id} anime={m} kind="manga" />)}</div>
          <div className="pagination-bar">
            <button disabled={page <= 1} onClick={() => goToPage(page - 1)}>← Previous</button>
            <span>Page {page}</span>
            <button disabled={!hasNext} onClick={() => goToPage(page + 1)}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
}
