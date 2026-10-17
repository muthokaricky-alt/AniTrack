import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { getLenis } from '../components/SmoothScroll.jsx';
import AnimeCard from '../components/AnimeCard.jsx';
import SkeletonGrid from '../components/SkeletonGrid.jsx';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [input, setInput] = useState(q);
  const [results, setResults] = useState([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setInput(q), [q]);

  // Searching is driven by the URL, so results survive refresh/back and can be shared
  useEffect(() => {
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .searchAnime(q, page)
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
  }, [q, page]);

  function handleSearch(e) {
    e.preventDefault();
    const value = input.trim();
    if (value) setParams({ q: value });
  }

  function goToPage(p) {
    setParams({ q, page: String(p) });
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="wrap page-pad">
      <div className="page-title">
        <p className="kicker">Catalogue</p>
        <h1 className="h1">Search</h1>
      </div>
      <form className="search-bar" onSubmit={handleSearch}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by title, e.g. Fullmetal Alchemist"
          aria-label="Search anime"
          autoFocus={!q}
        />
        <button type="submit">Search</button>
      </form>

      {loading && <SkeletonGrid count={10} />}
      {!loading && error && <div className="empty-state">{error}</div>}
      {!loading && !error && q && results.length === 0 && (
        <div className="empty-state">Nothing matched “{q}”. Try another spelling.</div>
      )}
      {!loading && !q && <div className="empty-state">Type a title above to get started.</div>}

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
