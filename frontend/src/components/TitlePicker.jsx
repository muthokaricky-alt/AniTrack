import { useState } from 'react';
import { api } from '../api/client.js';

const toItem = (kind, r) => ({ kind, mal_id: r.mal_id, title: r.title, image_url: r.images?.jpg?.image_url || null, sub: r.type || null });

// Search the catalogue and pick a title. taken: Set of "kind:id" strings already in the list.
export default function TitlePicker({ taken, onPick, disabled = false }) {
  const [kind, setKind] = useState('anime');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function search(e) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setNote('');
    try {
      const res = kind === 'manga' ? await api.searchManga(query) : await api.searchAnime(query);
      const items = (res.data || []).map((r) => toItem(kind, r)).slice(0, 8);
      setResults(items);
      if (items.length === 0) setNote('No matches. Try another spelling.');
    } catch (err) {
      setResults([]);
      setNote(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fp cl-picker">
      <div className="genre-row" role="group" aria-label="What to search">
        {['anime', 'manga'].map((k) => (
          <button key={k} type="button" className={`chip ${kind === k ? 'on' : ''}`} aria-pressed={kind === k} onClick={() => { setKind(k); setResults([]); setNote(''); }}>
            {k === 'anime' ? 'Anime' : 'Manga'}
          </button>
        ))}
      </div>
      <form className="fp-form" onSubmit={search}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${kind} to add`} aria-label={`Search ${kind}`} />
        <button className="btn btn-line btn-sm" disabled={busy}>{busy ? '…' : 'Search'}</button>
      </form>
      {note && <p className="muted">{note}</p>}
      {results.length > 0 && (
        <ul className="fp-results">
          {results.map((r) => {
            const have = taken.has(`${r.kind}:${r.mal_id}`);
            return (
              <li key={`${r.kind}:${r.mal_id}`}>
                {r.image_url ? <img src={r.image_url} alt="" loading="lazy" /> : <span className="fp-noimg" />}
                <div>
                  <strong>{r.title}</strong>
                  {r.sub && <em>{r.sub}</em>}
                </div>
                <button type="button" className="btn btn-dark btn-sm" disabled={disabled} onClick={() => { onPick(r); setResults([]); setQ(''); }}>
                  {have ? 'Add again' : 'Add'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
