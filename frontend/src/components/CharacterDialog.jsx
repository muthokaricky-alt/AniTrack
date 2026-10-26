import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

// Character details inside AniTrack, so clicking a favourite character doesn't send anyone off to AniList.
// The server removes spoilers from the description.
export default function CharacterDialog({ id, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    let off = false;
    setState({ loading: true, data: null, error: '' });
    api.characterInfo(id)
      .then((r) => !off && setState({ loading: false, data: r.data, error: '' }))
      .catch((e) => !off && setState({ loading: false, data: null, error: e.message }));
    return () => { off = true; };
  }, [id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { loading, data, error } = state;
  const facts = data
    ? [['Gender', data.gender], ['Age', data.age], ['Birthday', data.birthday], ['Blood type', data.blood_type], ['Favourites', data.favourites != null ? data.favourites.toLocaleString() : null]].filter(([, v]) => v)
    : [];

  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal cd-modal" role="dialog" aria-modal="true" aria-labelledby="cd-title">
        <button type="button" className="cd-close" onClick={onClose} aria-label="Close">✕</button>

        {loading && <p className="muted" id="cd-title">Loading character…</p>}
        {error && <p className="error-text" id="cd-title">{error}</p>}

        {data && (
          <>
            <div className="cd-head">
              {data.image_url ? <img className="cd-img" src={data.image_url} alt="" /> : <div className="cd-img" />}
              <div>
                <h2 id="cd-title" className="modal-title">{data.name}</h2>
                {data.native && <p className="cd-native">{data.native}</p>}
                {data.alternative.length > 0 && <p className="muted cd-alt">Also known as {data.alternative.join(', ')}</p>}
                {facts.length > 0 && (
                  <dl className="cd-facts">
                    {facts.map(([k, v]) => (
                      <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
            {data.description ? <p className="cd-desc">{data.description}</p> : <p className="muted">There's no description for this character yet.</p>}
            {data.appears_in.length > 0 && (
              <>
                <h3 className="mini-h">Appears in</h3>
                <ul className="cd-series">
                  {data.appears_in.map((s) => (
                    <li key={`${s.kind}:${s.mal_id}`}>
                      <Link to={`/${s.kind}/${s.mal_id}`} onClick={onClose} title={s.title}>
                        {s.image_url ? <img src={s.image_url} alt="" loading="lazy" /> : <span className="cd-noimg" />}
                        <span>{s.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <div className="modal-actions">
          {data && <a className="btn btn-quiet btn-sm" href={`https://anilist.co/character/${data.id}`} target="_blank" rel="noopener noreferrer">More on AniList ↗</a>}
          <button type="button" className="btn btn-line" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
