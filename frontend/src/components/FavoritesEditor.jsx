import { useState } from 'react';
import { api } from '../api/client.js';

const LABEL = { anime: 'anime', manga: 'manga', character: 'characters' };

function toItem(kind, r) {
  if (kind === 'character') return { item_id: r.id, title: r.name, image_url: r.image_url, sub: r.series };
  return { item_id: r.mal_id, title: r.title, image_url: r.images?.jpg?.image_url || null, sub: r.type || null };
}

// Search box that adds a result to the list
function Picker({ kind, exclude, onPick }) {
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
      const res =
        kind === 'character' ? await api.searchCharacters(query) : kind === 'manga' ? await api.searchManga(query) : await api.searchAnime(query);
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
    <div className="fp">
      <form className="fp-form" onSubmit={search}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${LABEL[kind]} to add`} aria-label={`Search ${LABEL[kind]}`} />
        <button className="btn btn-line btn-sm" disabled={busy}>{busy ? '…' : 'Search'}</button>
      </form>
      {note && <p className="muted">{note}</p>}
      {results.length > 0 && (
        <ul className="fp-results">
          {results.map((r) => (
            <li key={r.item_id}>
              {r.image_url ? <img src={r.image_url} alt="" loading="lazy" /> : <span className="fp-noimg" />}
              <div>
                <strong>{r.title}</strong>
                {r.sub && <em>{r.sub}</em>}
              </div>
              <button className="btn btn-dark btn-sm" disabled={exclude.includes(r.item_id)} onClick={() => { onPick(r); setResults([]); setQ(''); }}>
                {exclude.includes(r.item_id) ? 'Added' : 'Add'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// One ordered list (a "top 3" or "top 15"): add, reorder, remove. Every change is saved straight away.
export default function FavoritesEditor({ kind, list, items, onChange }) {
  const max = list === 'top3' ? 3 : 15;
  const title = `${list === 'top3' ? 'Top 3' : 'Top 15'} ${LABEL[kind]}`;

  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  function drop(to) {
    if (drag == null || drag === to) return;
    const next = [...items];
    const [it] = next.splice(drag, 1);
    next.splice(to, 0, it);
    onChange(next);
  }

  function move(i, dir) {
    const next = [...items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <section className="fe">
      <div className="fe-head">
        <h3 className="mini-h">{title}</h3>
        <span className="muted">{items.length} / {max}</span>
      </div>

      {items.length === 0 && <p className="muted fe-empty">Nothing picked yet.</p>}
      <ol className="fe-list">
        {items.map((it, i) => (
          <li
            key={it.item_id}
            draggable
            className={`${drag === i ? 'is-dragging' : ''} ${over === i && drag !== i ? 'is-over' : ''}`}
            onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
            onDragOver={(e) => { e.preventDefault(); setOver(i); }}
            onDrop={(e) => { e.preventDefault(); drop(i); setDrag(null); setOver(null); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}
          >
            <span className="fe-n" title="Drag to reorder">⠿ {i + 1}</span>
            {it.image_url ? <img src={it.image_url} alt="" loading="lazy" /> : <span className="fp-noimg" />}
            <div className="fe-main">
              <strong>{it.title}</strong>
              {it.sub && <em>{it.sub}</em>}
            </div>
            <div className="fe-ctl">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${it.title} up`}>▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${it.title} down`}>▼</button>
              <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label={`Remove ${it.title}`}>✕</button>
            </div>
          </li>
        ))}
      </ol>

      {items.length < max ? (
        <Picker kind={kind} exclude={items.map((i) => i.item_id)} onPick={(r) => onChange([...items, r])} />
      ) : (
        <p className="muted">This list is full. Remove one to add another.</p>
      )}
    </section>
  );
}
