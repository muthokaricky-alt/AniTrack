import { useState } from 'react';
import { api } from '../api/client.js';
import AnimeCard from '../components/AnimeCard.jsx';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await api.searchAnime(query);
      setResults(data.data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
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
      {!loading && searched && results.length === 0 && (
        <div className="empty-state">Nothing matched that title. Try another spelling.</div>
      )}
      <div className="anime-grid">
        {results.map((a) => <AnimeCard key={a.mal_id} anime={a} />)}
      </div>
    </>
  );
}
