import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import ErrorState from '../components/ErrorState.jsx';
import TitlePicker from '../components/TitlePicker.jsx';

const MAX_ITEMS = 50;

// A note under a title (for example which arc). Saved when you leave the box.
function NoteInput({ value, onSave, disabled }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  return (
    <input
      className="cl-note-input"
      value={text}
      maxLength={280}
      disabled={disabled}
      placeholder="Add a note, like which arc"
      aria-label="Note for this title"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== (value || '') && onSave(text.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

export default function CustomList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  const load = useCallback(() => {
    setError('');
    setMissing(false);
    api.customLists.get(id).then(setList).catch((err) => (/not found/i.test(err.message) ? setMissing(true) : setError(err.message)));
  }, [id]);
  useEffect(load, [load]);

  // Every change is saved straight away. Returns true when it worked.
  async function save(patch, okMessage) {
    setBusy(true);
    try {
      setList(await api.customLists.update(id, patch));
      if (okMessage) toast(okMessage);
      return true;
    } catch (err) {
      toast(err.message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const changeItems = async (items) => {
    const before = list;
    setList({ ...list, items }); // show it at once, put it back if the save fails
    if (!(await save({ items }))) setList(before);
  };

  const move = (i, d) => {
    const items = [...list.items];
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    changeItems(items);
  };

  const add = (r) => {
    if (list.items.length >= MAX_ITEMS) return toast(`A list can hold at most ${MAX_ITEMS} titles.`, 'error');
    changeItems([...list.items, { kind: r.kind, mal_id: r.mal_id, title: r.title, image_url: r.image_url, note: null }]);
  };

  const remove = (i) => changeItems(list.items.filter((_, n) => n !== i));
  const setNote = (i, note) => changeItems(list.items.map((it, n) => (n === i ? { ...it, note: note || null } : it)));

  async function saveDetails(e) {
    e.preventDefault();
    if (await save({ title: draft.title, description: draft.description, ranked: draft.ranked, is_public: draft.is_public }, 'Saved')) setEditing(false);
  }

  async function deleteList() {
    if (!window.confirm('Delete this list? This cannot be undone.')) return;
    try {
      await api.customLists.remove(id);
      toast('List deleted');
      navigate('/lists');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/lists/${id}`);
      toast('Link copied');
    } catch {
      toast('Could not copy. Copy the address from your browser instead.', 'error');
    }
  }

  if (missing) {
    return (
      <div className="wrap page-pad">
        <ErrorState title="List not found" message="It may be private, or it may have been deleted." />
        <p><Link className="text-link" to="/lists">Go to my lists</Link></p>
      </div>
    );
  }
  if (error) return <div className="wrap page-pad"><ErrorState message={error} onRetry={load} /></div>;
  if (!list) return <div className="wrap page-pad"><p className="muted" role="status">Loading…</p></div>;

  const owner = list.is_owner;
  const taken = new Set(list.items.map((it) => `${it.kind}:${it.mal_id}`));

  return (
    <div className="wrap page-pad">
      <div className="page-title">
        <p className="kicker">
          {list.ranked ? 'Ranked list' : 'List'} · by <Link to={`/u/${list.owner.username}`}>{list.owner.username}</Link>
          {owner && <> · {list.is_public ? 'Public' : 'Private'}</>}
        </p>
        <h1 className="h1">{list.title}</h1>
        {list.description && <p className="cl-desc">{list.description}</p>}
      </div>

      {owner && !editing && (
        <div className="cl-actions">
          <button type="button" className="btn btn-line btn-sm" onClick={() => { setDraft({ title: list.title, description: list.description || '', ranked: list.ranked, is_public: list.is_public }); setEditing(true); }}>Edit details</button>
          {list.is_public ? (
            <button type="button" className="btn btn-line btn-sm" onClick={copyLink}>Copy link</button>
          ) : (
            <button type="button" className="btn btn-line btn-sm" onClick={() => save({ is_public: true }, 'List is now public')} disabled={busy}>Make public to share</button>
          )}
          <Link className="btn btn-quiet btn-sm" to="/lists">All lists</Link>
        </div>
      )}

      {owner && editing && (
        <form className="cl-edit" onSubmit={saveDetails}>
          <div className="field">
            <label htmlFor="cl-title">Title</label>
            <input id="cl-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="cl-desc">Description <span className="optional">(optional)</span></label>
            <textarea id="cl-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={500} />
          </div>
          <label className="check"><input type="checkbox" checked={draft.ranked} onChange={(e) => setDraft({ ...draft, ranked: e.target.checked })} /> Ranked (show numbers)</label>
          <label className="check"><input type="checkbox" checked={draft.is_public} onChange={(e) => setDraft({ ...draft, is_public: e.target.checked })} /> Public (anyone with the link can see it)</label>
          <div className="modal-actions">
            <button type="submit" className="btn btn-signal btn-sm" disabled={busy || !draft.title.trim()}>Save</button>
            <button type="button" className="btn btn-line btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="btn btn-quiet btn-sm cl-delete" onClick={deleteList}>Delete list</button>
          </div>
        </form>
      )}

      {owner && <TitlePicker taken={taken} onPick={add} disabled={busy || list.items.length >= MAX_ITEMS} />}

      {list.items.length === 0 ? (
        <div className="empty-state">
          <p className="es-title">{owner ? 'Nothing here yet' : 'This list is empty'}</p>
          {owner && <p>Search above and press Add to build your list.</p>}
        </div>
      ) : (
        <ol className={`cl-items ${list.ranked ? 'is-ranked' : ''}`}>
          {list.items.map((it, i) => (
            <li key={`${it.kind}:${it.mal_id}:${i}`} className="cl-item">
              {list.ranked && <span className="cl-rank" aria-label={`Number ${i + 1}`}>{i + 1}</span>}
              <Link to={`/${it.kind}/${it.mal_id}`} className="cl-cover-link" tabIndex={-1} aria-hidden="true">
                {it.image_url ? <img className="cl-cover" src={it.image_url} alt="" loading="lazy" /> : <span className="cl-cover" />}
              </Link>
              <div className="cl-main">
                <Link to={`/${it.kind}/${it.mal_id}`}><strong>{it.title}</strong></Link>
                <span className="cl-kind">{it.kind}</span>
                {owner ? <NoteInput value={it.note} onSave={(note) => setNote(i, note)} disabled={busy} /> : it.note && <p className="cl-note">{it.note}</p>}
              </div>
              {owner && (
                <div className="cl-tools">
                  <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label={`Move ${it.title} up`}>↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={busy || i === list.items.length - 1} aria-label={`Move ${it.title} down`}>↓</button>
                  <button type="button" onClick={() => remove(i)} disabled={busy} aria-label={`Remove ${it.title}`}>✕</button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {owner && <p className="muted cl-count">{list.items.length} of {MAX_ITEMS} titles</p>}
    </div>
  );
}
