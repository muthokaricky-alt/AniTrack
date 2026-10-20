import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { GENRES } from '../constants.js';
import { getLenis } from '../components/SmoothScroll.jsx';
import AnimeCard from '../components/AnimeCard.jsx';
import ErrorState from '../components/ErrorState.jsx';
import SkeletonGrid from '../components/SkeletonGrid.jsx';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const genre = params.get('genre') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [input, setInput] = useState(q);
  const [results, setResults] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setInput(q), [q]);

  // Searching is driven by the URL, so results survive refresh/back and can be shared
  useEffect(() => {
    if (!q && !genre) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .searchAnime(q, page, genre)
      .then((data) => {
        if (cancelled) return;
        setResults(data.data || []);
        setHasNextPage(Boolean(data.pagination?.has_next_page));
      })
      .catch((err) => {
        if (cancelled) return;
        setResults([]);
        setError(
          err.message.includes('anime data source')
            ? 'The anime database is temporarily unavailable. Try again shortly.'
            : err.message
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [q, genre, page, attempt]);

  function update(next) {
    const merged = { q, genre, ...next };
    const clean = {};
    if (merged.q) clean.q = merged.q;
    if (merged.genre) clean.genre = merged.genre;
    if (merged.page && merged.page > 1) clean.page = String(merged.page);
    setParams(clean);
  }

  function handleSearch(e) {
    e.preventDefault();
    update({ q: input.trim(), page: 1 });
  }

  function toggleGenre(g) {
    update({ genre: genre === g ? '' : g, page: 1 });
  }

  function goToPage(p) {
    update({ page: p });
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const hasQuery = Boolean(q || genre);

  return (
    <div className="wrap page-pad">
      <div className="page-title">
        <p className="kicker">Catalogue · press / to search</p>
        <h1 className="h1">Search</h1>
      </div>
      <form className="search-bar" onSubmit={handleSearch}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by title, e.g. Fullmetal Alchemist"
          aria-label="Search anime"
          autoFocus={!hasQuery}
        />
        <button type="submit">Search</button>
      </form>

      <div className="genre-row" role="group" aria-label="Filter by genre">
        {GENRES.map((g) => (
          <button key={g} className={`chip ${genre === g ? 'on' : ''}`} aria-pressed={genre === g} onClick={() => toggleGenre(g)}>
            {g}
          </button>
        ))}
      </div>

      {loading && <SkeletonGrid count={10} />}
      {!loading && error && <ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} />}
      {!loading && !error && hasQuery && results.length === 0 && (
        <div className="empty-state">Nothing matched. Try another spelling or genre.</div>
      )}
      {!loading && !hasQuery && <div className="empty-state">Type a title above or pick a genre to get started.</div>}

      {!loading && results.length > 0 && (
        <>
          <div className="anime-grid">
            {results.map((a) => <AnimeCard key={a.mal_id} anime={a} />)}
          </div>
          <div className="pagination-bar">
            <button disabled={page <= 1} onClick={() => goToPage(page - 1)}>← Previous</button>
            <span>Page {page}</span>
            <button disabled={!hasNextPage} onClick={() => goToPage(page + 1)}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
}
