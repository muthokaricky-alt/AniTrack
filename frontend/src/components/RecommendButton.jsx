import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client.js';
import { REC_NOTE_MAX } from '../constants.js';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from './Avatar.jsx';

// "Recommend to a friend": shown on a title that is on your own list. Friends are people you follow who follow you back.
// The server fills in the title, cover and your score from your list, so only the friend and a short note are sent from here.
export default function RecommendButton({ kind, malId, title }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-quiet" onClick={() => setOpen(true)}>Recommend to a friend</button>
      {open && <RecommendDialog kind={kind} malId={malId} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function RecommendDialog({ kind, malId, title, onClose }) {
  const toast = useToast();
  const [friends, setFriends] = useState(null);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let off = false;
    api.recommendFriends().then((r) => !off && setFriends(r.friends)).catch((e) => !off && setError(e.message));
    return () => { off = true; };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function send(e) {
    e.preventDefault();
    if (!to || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.sendRecommendation({ to, kind, mal_id: malId, note });
      toast(`Sent to ${to}`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Rendered into <body>: the detail page's list panel has its own light colours and form styling that must not leak in
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal rec-modal" role="dialog" aria-modal="true" aria-labelledby="rec-title">
        <h2 id="rec-title" className="modal-title">Recommend to a friend</h2>
        <p className="muted rec-sub">
          Send <b>{title}</b> to someone who follows you back. They'll see it in their inbox, along with your score.
        </p>

        {friends === null && !error && <p className="muted">Loading your friends…</p>}
        {error && friends === null && <p className="error-text">{error}</p>}

        {friends && friends.length === 0 && (
          <p className="rec-empty">
            You don't have any friends yet. Friends are people you follow who also follow you back. Follow someone from their
            profile, and ask them to follow you back.
          </p>
        )}

        {friends && friends.length > 0 && (
          <form onSubmit={send}>
            <fieldset className="rec-friends">
              <legend>Choose a friend</legend>
              {friends.map((f) => (
                <label key={f.username} className={`rec-friend ${to === f.username ? 'on' : ''}`}>
                  <input type="radio" name="rec-to" value={f.username} checked={to === f.username} onChange={() => setTo(f.username)} />
                  <Avatar user={f} size={28} />
                  <span>{f.username}</span>
                </label>
              ))}
            </fieldset>
            <label className="rec-note">
              <span>Add a short note <em>(optional)</em></span>
              <textarea
                rows="2"
                maxLength={REC_NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="You'll love the ending…"
              />
              <span className="rec-count">{note.length}/{REC_NOTE_MAX}</span>
            </label>
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button className="btn btn-signal" type="submit" disabled={!to || busy}>{busy ? 'Sending…' : 'Send'}</button>
              <button className="btn btn-line" type="button" onClick={onClose} disabled={busy}>Cancel</button>
            </div>
          </form>
        )}

        {(friends === null || friends.length === 0) && (
          <div className="modal-actions">
            <button className="btn btn-line" type="button" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
