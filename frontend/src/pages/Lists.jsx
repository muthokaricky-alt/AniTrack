import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ErrorState from '../components/ErrorState.jsx';
import ListCard from '../components/ListCard.jsx';

const IDEAS = ['Top 10 arcs', 'Top 10 villains', 'Best isekai', 'Comfort anime'];
const FAV_KINDS = [['anime', 'anime'], ['manga', 'manga'], ['character', 'characters']];

// A Top 15 from the profile. Each can be turned into a normal list (to add notes, share or make a card).
function FavCard({ kind, label, items, onMakeList, busy }) {
  const covers = items.map((i) => i.image_url).filter(Boolean).slice(0, 4);
  return (
    <div className="cl-fav">
      <Link to="/profile?tab=favorites" className="cl-card">
        <div className="cl-mosaic" aria-hidden="true">{covers.map((src, i) => <img key={i} src={src} alt="" loading="lazy" />)}</div>
        <div className="cl-card-body">
          <h3>Top {items.length} {label}</h3>
          <p>On your profile · edit there</p>
        </div>
      </Link>
      <button type="button" className="btn btn-line btn-sm" onClick={onMakeList} disabled={busy}>Make it a list</button>
    </div>
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
  const [favs, setFavs] = useState(null);

  const load = useCallback(() => {
    setError('');
    api.customLists.mine().then((res) => setLists(res.lists)).catch((err) => setError(err.message));
  }, []);
  useEffect(load, [load]);
  // The profile favourites are a bonus here, so a failure to load them is not worth an error message
  useEffect(() => { api.favorites().then(setFavs).catch(() => setFavs(null)); }, []);

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

  async function makeList(kind, label, items) {
    setBusy(true);
    try {
      const made = await api.customLists.create({
        title: `Top ${items.length} ${label}`,
        ranked: true,
        items: items.map((i) => ({ kind, mal_id: i.item_id, title: i.title, image_url: i.image_url, note: null }))
      });
      toast('List created from your favourites');
      navigate(`/lists/${made.id}`);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  }

  const favCards = favs ? FAV_KINDS.filter(([k]) => favs[k]?.top15?.length) : [];

  return (
    <div className="wrap page-pad">
      <div className="page-title">
        <p className="kicker">Your collections</p>
        <h1 className="h1">My lists</h1>
      </div>
      <div className="cl-actions">
        <Link className="btn btn-line btn-sm" to="/lists/discover">Discover lists</Link>
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

      {favCards.length > 0 && (
        <section aria-label="From your profile">
          <p className="kicker cl-section">From your profile</p>
          <div className="cl-grid">
            {favCards.map(([k, label]) => (
              <FavCard key={k} kind={k} label={label} items={favs[k].top15} busy={busy} onMakeList={() => makeList(k, label, favs[k].top15)} />
            ))}
          </div>
        </section>
      )}

      <p className="kicker cl-section">Your lists</p>
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && lists === null && <p className="muted" role="status">Loading your lists…</p>}
      {lists && lists.length === 0 && (
        <div className="empty-state">
          <p className="es-title">No lists yet</p>
          <p>Make your top 10 arcs, your best villains, or anything else you want to rank. Lists are private until you choose to share them.</p>
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
