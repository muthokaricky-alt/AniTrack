import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from './Avatar.jsx';

// A simple grid of people. Private profiles show as plain text (their page isn't viewable).
export function People({ users, empty }) {
  if (!users) return <p className="muted">Loading…</p>;
  if (!users.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="fol-list">
      {users.map((u) => (
        <li key={u.username}>
          {u.is_public ? (
            <Link to={`/u/${encodeURIComponent(u.username)}`}>
              <Avatar user={u} size={36} />
              <span>{u.username}</span>
            </Link>
          ) : (
            <span className="fol-private">
              <Avatar user={u} size={36} />
              <span>{u.username}</span>
              <small>private</small>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// Follower / following counts and the Follow button, shown on a public profile
export default function FollowBar({ username, viewer }) {
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(null); // 'followers' | 'following' | null
  const [lists, setLists] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    setInfo(null);
    setOpen(null);
    setLists({});
    api.followInfo(username).then((r) => !off && setInfo(r)).catch(() => {});
    return () => { off = true; };
  }, [username, viewer?.id]);

  const loadList = useCallback(
    (type) => api.network(username, type).then((r) => setLists((l) => ({ ...l, [type]: r.users }))).catch((e) => toast(e.message, 'error')),
    [username, toast]
  );

  function toggleList(type) {
    if (open === type) return setOpen(null);
    setOpen(type);
    if (!lists[type]) loadList(type);
  }

  async function toggleFollow() {
    if (busy || !info) return;
    setBusy(true);
    try {
      const res = info.is_following ? await api.unfollow(username) : await api.follow(username);
      setInfo((i) => ({ ...i, ...res }));
      if (open === 'followers') loadList('followers');
      else setLists((l) => ({ ...l, followers: undefined })); // reload it next time it's opened
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!info) return null;

  return (
    <section className="fol" aria-label="Followers and following">
      <div className="fol-bar">
        <div className="fol-counts">
          <button className={open === 'followers' ? 'on' : ''} aria-expanded={open === 'followers'} onClick={() => toggleList('followers')}>
            <b>{info.followers}</b>{info.followers === 1 ? 'follower' : 'followers'}
          </button>
          <button className={open === 'following' ? 'on' : ''} aria-expanded={open === 'following'} onClick={() => toggleList('following')}>
            <b>{info.following}</b>following
          </button>
        </div>
        {!info.is_self && (viewer ? (
          <button className={`btn btn-sm ${info.is_following ? 'btn-line' : 'btn-signal'}`} onClick={toggleFollow} disabled={busy} aria-pressed={info.is_following}>
            {info.is_following ? 'Following' : 'Follow'}
          </button>
        ) : (
          <Link className="btn btn-signal btn-sm" to="/login" state={{ from: `/u/${encodeURIComponent(username)}` }}>Follow</Link>
        ))}
      </div>
      {open && (
        <div className="fol-panel">
          <People users={lists[open]} empty={open === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'} />
        </div>
      )}
    </section>
  );
}
