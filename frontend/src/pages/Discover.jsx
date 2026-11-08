import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ErrorState from '../components/ErrorState.jsx';
import ListCard from '../components/ListCard.jsx';

// Public lists from other people. Open them to look around, and save a copy to make it your own.
export default function Discover() {
  const [lists, setLists] = useState(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback((p) => {
    setBusy(true);
    setError('');
    api.customLists.discover(p)
      .then((res) => {
        setLists((prev) => (p === 1 ? res.lists : [...(prev || []), ...res.lists]));
        setMore(res.has_more);
        setPage(p);
      })
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => load(1), [load]);

  return (
    <div className="wrap page-pad">
      <div className="page-title">
        <p className="kicker">From the community</p>
        <h1 className="h1">Discover lists</h1>
        <p className="cl-desc">Lists other people chose to share. The most saved come first. Open one, and press Save a copy to keep it in your own lists.</p>
      </div>
      <div className="cl-actions">
        <Link className="btn btn-line btn-sm" to="/lists">My lists</Link>
      </div>

      {error && <ErrorState message={error} onRetry={() => load(page)} />}
      {!error && lists === null && <p className="muted" role="status">Loading lists…</p>}
      {lists && lists.length === 0 && (
        <div className="empty-state">
          <p className="es-title">Nothing to discover yet</p>
          <p>Lists show up here once someone makes one public and puts at least three titles in it. Yours could be the first.</p>
        </div>
      )}
      {lists && lists.length > 0 && (
        <div className="cl-grid">
          {lists.map((l) => <ListCard key={l.id} list={l} showVisibility={false} />)}
        </div>
      )}
      {more && (
        <p className="cl-more"><button type="button" className="btn btn-line" onClick={() => load(page + 1)} disabled={busy}>{busy ? 'Loading…' : 'Show more'}</button></p>
      )}
    </div>
  );
}
