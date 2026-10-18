import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { useMangaList } from '../context/MangaListContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import FavoritesEditor from '../components/FavoritesEditor.jsx';

const fromUser = (u) => ({ username: u.username, bio: u.bio || '', avatar: u.avatar || null, is_public: Boolean(u.is_public) });
const EMPTY = { top3: [], top15: [] };
const FAV_KINDS = [
  { key: 'anime', label: 'Anime' },
  { key: 'manga', label: 'Manga' },
  { key: 'character', label: 'Characters' }
];

function Favorites() {
  const toast = useToast();
  const [kind, setKind] = useState('anime');
  const [favs, setFavs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.favorites().then(setFavs).catch((e) => setError(e.message));
  }, []);

  async function change(k, list, next) {
    const before = favs;
    setFavs((f) => ({ ...f, [k]: { ...f[k], [list]: next } })); // show it immediately, undo if the save fails
    try {
      const saved = await api.saveFavorites(k, list, next);
      setFavs((f) => ({ ...f, [k]: { ...f[k], [list]: saved.items } }));
    } catch (e) {
      setFavs(before);
      toast(e.message, 'error');
    }
  }

  if (error) return <div className="empty-state">{error}</div>;
  if (!favs) return <p className="muted">Loading your favourites…</p>;
  const group = favs[kind] || EMPTY;

  return (
    <>
      <p className="muted pf-note">Pick the titles you'd recommend to anyone. They appear on your public profile, in this order.</p>
      <div className="kind-switch" role="tablist" aria-label="Favourites type">
        {FAV_KINDS.map((k) => (
          <button key={k.key} role="tab" aria-selected={kind === k.key} className={kind === k.key ? 'on' : ''} onClick={() => setKind(k.key)}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="fe-grid">
        <FavoritesEditor kind={kind} list="top3" items={group.top3} onChange={(next) => change(kind, 'top3', next)} />
        <FavoritesEditor kind={kind} list="top15" items={group.top15} onChange={(next) => change(kind, 'top15', next)} />
      </div>
    </>
  );
}

function Settings() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => fromUser(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [pwBusy, setPwBusy] = useState(false);

  // A background refresh may bring in newer profile data
  useEffect(() => setForm(fromUser(user)), [user.username, user.bio, user.avatar, user.is_public]); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = fromUser(user);
  const dirty = Object.keys(form).some((k) => form[k] !== saved[k]);
  const link = `${window.location.origin}/u/${encodeURIComponent(user.username)}`;

  async function save(e) {
    e.preventDefault();
    setError('');
    const patch = {};
    for (const k of Object.keys(form)) if (form[k] !== saved[k]) patch[k] = form[k];
    setSaving(true);
    try {
      const res = await api.updateProfile(patch);
      updateUser(res.user);
      toast('Profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwBusy(true);
    try {
      await api.changePassword(pw);
      setPw({ current_password: '', new_password: '' });
      toast('Password changed');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPwBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      toast('Profile link copied');
    } catch {
      toast('Copy failed. Select the link and copy it manually.', 'error');
    }
  }

  return (
    <>
      <form className="pf" onSubmit={save}>
        <div className="pf-section">
          <h2 className="mini-h">Photo</h2>
          <AvatarPicker value={form.avatar} username={form.username} size={112} onChange={(avatar) => setForm((f) => ({ ...f, avatar }))} />
        </div>

        <div className="pf-section">
          <div className="field">
            <label htmlFor="pf-username">Username</label>
            <input id="pf-username" value={form.username} minLength={2} maxLength={30} required onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="pf-email">Email</label>
            <input id="pf-email" value={user.email} disabled />
            <small>Your email is private and can't be changed here yet.</small>
          </div>
          <div className="field">
            <label htmlFor="pf-bio">Bio</label>
            <textarea id="pf-bio" rows="3" maxLength={300} value={form.bio} placeholder="Favourite genre, what you're binging, hot takes…" onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            <small>{form.bio.length} / 300</small>
          </div>
        </div>

        <div className="pf-section">
          <h2 className="mini-h">Public profile</h2>
          <label className="check">
            <input type="checkbox" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
            <span>Let anyone with my link see my profile</span>
          </label>
          <p className="muted">They'll see your username, photo, bio, stats, favourites and top-rated titles. Your email and full list stay private. It's off by default.</p>
          {user.is_public && !dirty && (
            <div className="share-line">
              <Link to={`/u/${encodeURIComponent(user.username)}`}>{link}</Link>
              <button type="button" className="btn btn-line btn-sm" onClick={copyLink}>Copy link</button>
            </div>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}
        <div className="pf-actions">
          <button className="btn btn-signal" type="submit" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          {dirty && <button type="button" className="btn btn-quiet" onClick={() => setForm(saved)}>Discard</button>}
        </div>
      </form>

      <form className="pf pf-password" onSubmit={changePassword}>
        <h2 className="mini-h">Change password</h2>
        <div className="field">
          <label htmlFor="pw-current">Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))} required />
        </div>
        <div className="field">
          <label htmlFor="pw-new">New password</label>
          <input id="pw-new" type="password" autoComplete="new-password" minLength={6} value={pw.new_password} onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))} required />
        </div>
        <button className="btn btn-line" type="submit" disabled={pwBusy}>{pwBusy ? 'Updating…' : 'Update password'}</button>
      </form>
    </>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const anime = useList();
  const manga = useMangaList();
  const [tab, setTab] = useState('favorites');

  return (
    <div className="wrap page-pad">
      <header className="pf-head">
        <Avatar user={user} size={104} />
        <div className="pf-head-main">
          <p className="kicker">Your profile</p>
          <h1 className="h1">{user.username}</h1>
          <p className="pf-bio">{user.bio || 'No bio yet. Add one in Settings.'}</p>
          <ul className="pf-chips">
            <li><b>{anime.stats.total}</b> anime</li>
            <li><b>{manga.stats.total}</b> manga</li>
            {anime.stats.mean && <li>mean <b>{anime.stats.mean}</b></li>}
            <li className={user.is_public ? 'is-public' : ''}>{user.is_public ? 'Public' : 'Private'}</li>
          </ul>
        </div>
        <div className="pf-head-actions">
          {user.is_public ? (
            <Link className="btn btn-line btn-sm" to={`/u/${encodeURIComponent(user.username)}`}>View public page</Link>
          ) : (
            <button className="btn btn-line btn-sm" onClick={() => setTab('settings')}>Make public</button>
          )}
        </div>
      </header>

      <div className="kind-switch pf-tabs" role="tablist" aria-label="Profile sections">
        <button role="tab" aria-selected={tab === 'favorites'} className={tab === 'favorites' ? 'on' : ''} onClick={() => setTab('favorites')}>Favourites</button>
        <button role="tab" aria-selected={tab === 'settings'} className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>Settings</button>
      </div>

      {tab === 'favorites' ? <Favorites /> : <Settings />}
    </div>
  );
}
