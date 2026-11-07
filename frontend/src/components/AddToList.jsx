import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const MAX_ITEMS = 50;

// "Add to a list" on an anime or manga page: pick one of your custom lists (or start a new one) and optionally
// write a note, like which arc you mean. The same title can go in a list more than once.
export default function AddToList({ kind, malId, title, imageUrl }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-quiet" onClick={() => setOpen(true)}>Add to a list</button>
      {open && <AddToListDialog kind={kind} malId={malId} title={title} imageUrl={imageUrl} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddToListDialog({ kind, malId, title, imageUrl, onClose }) {
  const toast = useToast();
  const [lists, setLists] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(() => new Set()); // lists this title went into during this visit

  useEffect(() => {
    let off = false;
    api.customLists.mine().then((r) => !off && setLists(r.lists)).catch((e) => !off && setError(e.message));
    return () => { off = true; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const item = () => ({ kind, mal_id: malId, title, image_url: imageUrl || null, note: note.trim() || null });

  async function addTo(list) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.customLists.addItem(list.id, item());
      setAdded((a) => new Set(a).add(list.id));
      setLists((ls) => ls.map((l) => (l.id === list.id ? { ...l, count: res.count } : l)));
      toast(`Added to “${list.title}”`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd(e) {
    e.preventDefault();
    const name = newTitle.trim();
    if (!name || busy) return;
    setBusy(true);
    setError('');
    try {
      const made = await api.customLists.create({ title: name, items: [item()] });
      setLists((ls) => [{ id: made.id, title: made.title, count: 1, ranked: made.ranked, is_public: made.is_public }, ...(ls || [])]);
      setAdded((a) => new Set(a).add(made.id));
      setNewTitle('');
      toast(`Created “${made.title}” and added it`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Rendered into <body>, like the recommend dialog, so the detail page's panel styling cannot leak in
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal al-modal" role="dialog" aria-modal="true" aria-labelledby="al-title">
        <h2 id="al-title" className="modal-title">Add to a list</h2>
        <p className="muted al-sub">Adding <b>{title}</b>. Your lists are private until you choose to share them.</p>

        <div className="field">
          <label htmlFor="al-note">Note <span className="optional">(optional, like which arc)</span></label>
          <input id="al-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder="Marineford" autoComplete="off" />
        </div>

        {lists === null && !error && <p className="muted" role="status">Loading your lists…</p>}
        {lists && lists.length === 0 && <p className="muted">You have no lists yet. Start one below.</p>}
        {lists && lists.length > 0 && (
          <ul className="al-lists">
            {lists.map((l) => {
              const full = l.count >= MAX_ITEMS;
              return (
                <li key={l.id}>
                  <button type="button" className={`al-row ${added.has(l.id) ? 'on' : ''}`} onClick={() => addTo(l)} disabled={busy || full}>
                    <span className="al-name">{l.title}</span>
                    <span className="al-meta">{l.count} of {MAX_ITEMS}{l.ranked ? ' · ranked' : ''}</span>
                    <span className="al-act">{full ? 'Full' : added.has(l.id) ? 'Add again' : 'Add'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form className="al-new" onSubmit={createAndAdd}>
          <label htmlFor="al-new">Or start a new list</label>
          <div className="al-new-row">
            <input id="al-new" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={80} placeholder="Top 10 arcs" autoComplete="off" />
            <button type="submit" className="btn btn-line btn-sm" disabled={busy || !newTitle.trim()}>Create and add</button>
          </div>
        </form>

        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-signal" onClick={onClose} disabled={busy}>Done</button>
          <Link className="btn btn-quiet" to="/lists" onClick={onClose}>Open my lists</Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
