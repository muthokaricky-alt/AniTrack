import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useInboxCount } from '../lib/inboxCount.js';
import Avatar from './Avatar.jsx';
import { People } from './FollowBar.jsx';
import Inbox from './Inbox.jsx';

function Matches({ data }) {
  if (!data) return <p className="muted">Comparing your lists…</p>;
  if (!data.matches.length) {
    return (
      <div className="empty-state">
        <p>You're not following anyone yet.</p>
        <p className="muted">Look someone up in the Compare tab, open their profile and press Follow. They'll show up here with a taste match.</p>
      </div>
    );
  }
  return (
    <>
      {!data.has_list && <p className="muted pf-note">Add some titles to your list and the match percentages will appear here.</p>}
      <ul className="fol-matches">
        {data.matches.map((m) => (
          <li key={m.username}>
            <Link to={`/u/${encodeURIComponent(m.username)}`}>
              <Avatar user={m} size={44} />
              <span className="fol-m-main">
                <b>{m.username}</b>
                <span className="muted">
                  {m.percent == null ? 'Not enough on either list yet' : `${m.shared_count} in common`}
                  {m.common_genres.length > 0 ? ` · ${m.common_genres.join(', ')}` : ''}
                </span>
              </span>
              <span className="fol-m-pct">{m.percent == null ? '–' : `${m.percent}%`}</span>
              {m.percent != null && <span className="fol-m-bar"><i style={{ width: `${m.percent}%` }} /></span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

// "Friends" tab on your own profile: everyone you follow ranked by taste match, and who follows you
export default function Friends() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const unread = useInboxCount(user);
  const [view, setView] = useState(params.get('view') === 'inbox' ? 'inbox' : 'following');
  const [info, setInfo] = useState(null);
  const [matches, setMatches] = useState(null);
  const [followers, setFollowers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.followInfo(user.username).then(setInfo).catch(() => {});
  }, [user.username]);

  // The navbar badge links here with ?view=inbox, even when this tab is already open
  useEffect(() => {
    if (params.get('view') === 'inbox') setView('inbox');
  }, [params]);

  // Each view loads once per visit to this tab
  useEffect(() => {
    let off = false;
    if (view === 'following' && matches === null) {
      api.followMatches().then((r) => !off && setMatches(r)).catch((e) => !off && setError(e.message));
    } else if (view === 'followers' && followers === null) {
      api.network(user.username, 'followers').then((r) => !off && setFollowers(r.users)).catch((e) => !off && setError(e.message));
    }
    return () => { off = true; };
  }, [view, matches, followers, user.username]);

  return (
    <div className="fol-friends">
      <p className="muted pf-note">Follow people from their public profile. Everyone you follow is ranked here by how well your tastes line up. Friends are people you follow who follow you back, and you can send each other recommendations.</p>
      <div className="kind-switch" role="tablist" aria-label="Friends view">
        <button role="tab" aria-selected={view === 'inbox'} className={view === 'inbox' ? 'on' : ''} onClick={() => setView('inbox')}>
          Inbox{unread > 0 ? ` · ${unread}` : ''}
        </button>
        <button role="tab" aria-selected={view === 'following'} className={view === 'following' ? 'on' : ''} onClick={() => setView('following')}>
          Following{info ? ` · ${info.following}` : ''}
        </button>
        <button role="tab" aria-selected={view === 'followers'} className={view === 'followers' ? 'on' : ''} onClick={() => setView('followers')}>
          Followers{info ? ` · ${info.followers}` : ''}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="fol-friends-body">
        {view === 'inbox' ? <Inbox /> : view === 'following' ? <Matches data={matches} /> : <People users={followers} empty="Nobody follows you yet. Share your profile link and make sure your profile is public." />}
      </div>
    </div>
  );
}
