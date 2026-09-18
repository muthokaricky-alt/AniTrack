import { useState } from 'react';
import { api } from '../api/client.js';
import AnimeCard from '../components/AnimeCard.jsx';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function runSearch(targetPage) {
    setLoading(true);
    setSearched(true);
    setErrorMessage('');
    try {
      const data = await api.searchAnime(query, targetPage);
      setResults(data.data || []);
      setHasNextPage(Boolean(data.pagination?.has_next_page));
      setPage(targetPage);
    } catch (err) {
      setResults([]);
      setErrorMessage(
        err.message === 'Failed to reach anime data source'
          ? 'The anime database is temporarily unavailable — try again shortly.'
          : 'Something went wrong while searching. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    runSearch(1);
  }

  return (
    <>
      <div className="section-heading" style={{ border: 'none', marginBottom: 20 }}>
        <h2>Search the catalog</h2>
      </div>
      <form className="search-bar" onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title — e.g. Fullmetal Alchemist"
        />
        <button type="submit">Search</button>
      </form>

      {loading && <p>Searching…</p>}
      {!loading && errorMessage && (
        <div className="empty-state">{errorMessage}</div>
      )}
      {!loading && !errorMessage && searched && results.length === 0 && (
        <div className="empty-state">Nothing matched that title. Try another spelling.</div>
      )}
      <div className="anime-grid">
        {results.map((a) => <AnimeCard key={a.mal_id} anime={a} />)}
      </div>

      {!loading && !errorMessage && results.length > 0 && (
        <div className="pagination-bar">
          <button disabled={page <= 1} onClick={() => runSearch(page - 1)}>← Previous</button>
          <span>Page {page}</span>
          <button disabled={!hasNextPage} onClick={() => runSearch(page + 1)}>Next →</button>
        </div>
      )}
    </>
  );
}