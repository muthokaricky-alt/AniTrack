import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { setInboxCount } from '../lib/inboxCount.js';
import Avatar from './Avatar.jsx';

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Recommendations from friends (Received) and the ones you sent (Sent)
export default function Inbox() {
  const toast = useToast();
  const [box, setBox] = useState('inbox');
  const [data, setData] = useState({ inbox: null, sent: null });
  const [error, setError] = useState('');

  const load = useCallback(
    (which) => api.recommendations(which).then((r) => setData((d) => ({ ...d, [which]: r }))).catch((e) => setError(e.message)),
    []
  );

  // Opening the inbox shows what's new, then marks it all as seen (the "New" tags stay until you leave)
  useEffect(() => {
    load('inbox').then(() => api.markInboxRead().then(() => setInboxCount(0)).catch(() => {}));
  }, [load]);

  useEffect(() => {
    if (box === 'sent' && data.sent === null) load('sent');
  }, [box, data.sent, load]);

  async function remove(item) {
    try {
      await api.removeRecommendation(item.id);
      setData((d) => ({ ...d, [box]: { ...d[box], items: d[box].items.filter((i) => i.id !== item.id) } }));
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const current = data[box];
  const sent = box === 'sent';

  return (
    <div className="rec-inbox">
      <div className="kind-switch" role="tablist" aria-label="Inbox view">
        <button role="tab" aria-selected={!sent} className={!sent ? 'on' : ''} onClick={() => setBox('inbox')}>Received</button>
        <button role="tab" aria-selected={sent} className={sent ? 'on' : ''} onClick={() => setBox('sent')}>Sent</button>
      </div>
      {error && <p className="error-text">{error}</p>}

      <div className="rec-wrap">
        {current === null && !error && <p className="muted">Loading…</p>}

        {current && current.items.length === 0 && (
          <div className="empty-state">
            {sent ? (
              <>
                <p>You haven't recommended anything yet.</p>
                <p className="muted">Open a title on your list and press “Recommend to a friend”.</p>
              </>
            ) : (
              <>
                <p>Nothing here yet.</p>
                <p className="muted">When a friend recommends something, it shows up here. Friends are people you follow who follow you back.</p>
              </>
            )}
          </div>
        )}

        {current && current.items.length > 0 && (
          <ul className="rec-list">
            {current.items.map((r) => (
              <li key={r.id} className={`rec ${r.unread ? 'is-new' : ''}`}>
                <Link to={`/${r.kind === 'manga' ? 'manga' : 'anime'}/${r.mal_id}`} className="rec-cover" aria-label={r.title}>
                  {r.image_url && <img src={r.image_url} alt="" loading="lazy" />}
                </Link>
                <div className="rec-body">
                  <p className="rec-meta">
                    <Avatar user={{ username: r.username, avatar: current.avatars[r.username] }} size={20} />
                    <span>{sent ? <>You sent this to <b>{r.username}</b></> : <><b>{r.username}</b> recommends</>}</span>
                    <span>· {ago(r.created_at)}</span>
                  </p>
                  <Link to={`/${r.kind === 'manga' ? 'manga' : 'anime'}/${r.mal_id}`} className="rec-title">{r.title}</Link>
                  <div className="rec-tags">
                    {r.unread && <span className="rec-tag new">New</span>}
                    <span className="rec-tag">{r.kind === 'manga' ? 'Manga' : 'Anime'}</span>
                    {r.score != null && <span className="rec-tag">{sent ? 'You' : r.username} rated it {r.score}</span>}
                    {!sent && r.on_list && <span className="rec-tag">On your list</span>}
                    {sent && r.seen && <span className="rec-tag">Seen</span>}
                  </div>
                  {r.note && <p className="rec-text">“{r.note}”</p>}
                  <div className="rec-actions">
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => remove(r)}>{sent ? 'Unsend' : 'Dismiss'}</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
