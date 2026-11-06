import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ErrorState from '../components/ErrorState.jsx';

const IDEAS = ['Top 10 arcs', 'Best isekai', 'Comfort anime', 'Underrated gems'];

export function ListCard({ list }) {
  const covers = (list.covers || []).slice(0, 4);
  return (
    <Link to={`/lists/${list.id}`} className="cl-card">
      <div className="cl-mosaic" aria-hidden="true">
        {covers.length ? covers.map((src, i) => <img key={i} src={src} alt="" loading="lazy" />) : <span className="cl-empty">No titles yet</span>}
      </div>
      <div className="cl-card-body">
        <h3>{list.title}</h3>
        <p>
          {list.count} title{list.count === 1 ? '' : 's'}
          {list.ranked ? ' · Ranked' : ''}
          {list.is_public === false ? ' · Private' : list.is_public ? ' · Public' : ''}
        </p>
      </div>
    </Link>
  );
}

export default function Lists() {
  const toast = useToast();
  const navigate = useNavigate();
  const [lists, setLists] = useState(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [ranked, setRanked] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.customLists.mine().then((res) => setLists(res.lists)).catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load]);

  async function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const made = await api.customLists.create({ title: title.trim(), ranked });
      navigate(`/lists/${made.id}`);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  }

  return (
    <div className="wrap page-pad">
      <div className="page-title">
        <p className="kicker">Your collections</p>
        <h1 className="h1">My lists</h1>
      </div>

      <form className="cl-create" onSubmit={create}>
        <div className="field">
          <label htmlFor="cl-new">Start a new list</label>
          <input id="cl-new" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Top 10 anime arcs" autoComplete="off" disabled={busy} />
        </div>
        <div className="cl-ideas" aria-label="Ideas">
          {IDEAS.map((idea) => (
            <button key={idea} type="button" className="chip" onClick={() => setTitle(idea)} disabled={busy}>{idea}</button>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={ranked} onChange={(e) => setRanked(e.target.checked)} disabled={busy} /> Ranked (numbered #1, #2, #3…)</label>
        <button type="submit" className="btn btn-signal" disabled={busy || !title.trim()}>{busy ? 'Creating…' : 'Create list'}</button>
      </form>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && lists === null && <p className="muted" role="status">Loading your lists…</p>}
      {lists && lists.length === 0 && (
        <div className="empty-state">
          <p className="es-title">No lists yet</p>
          <p>Make your top 10 arcs, your best isekai, or anything else you want to rank. Lists are private until you choose to share them.</p>
        </div>
      )}
      {lists && lists.length > 0 && (
        <div className="cl-grid">
          {lists.map((l) => <ListCard key={l.id} list={l} />)}
        </div>
      )}
    </div>
  );
}
