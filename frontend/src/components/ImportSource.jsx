import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { KINDS } from '../constants.js';

// First step of importing: upload a file, or pull a public AniList profile by username.
// Either way the result ends up in the same preview-and-confirm dialog (ImportDialog).
export default function ImportSource({ onFile, onSections, onClose }) {
  const [step, setStep] = useState('choose'); // choose | anilist
  const [username, setUsername] = useState('');
  const [kinds, setKinds] = useState({ anime: true, manga: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function fetchFromAniList(e) {
    e.preventDefault();
    const name = username.trim().replace(/^@/, '');
    const wanted = Object.keys(KINDS).filter((k) => kinds[k]);
    if (!name) return setError('Type your AniList username.');
    if (!wanted.length) return setError('Pick anime, manga or both.');
    setBusy(true);
    setError('');
    try {
      const sections = [];
      let skipped = 0;
      for (const kind of wanted) {
        const res = await api.importAniList(name, kind);
        if (!alive.current) return;
        skipped += res.skipped_count || 0;
        if (res.entries?.length) sections.push({ kind, rows: res.entries });
      }
      if (!sections.length) {
        setError(`No ${wanted.join(' or ')} entries found on that AniList profile.`);
        return;
      }
      const note = skipped ? `${skipped} title${skipped === 1 ? ' was' : 's were'} skipped because MyAnimeList has no entry for ${skipped === 1 ? 'it' : 'them'}.` : '';
      onSections(sections, note);
    } catch (err) {
      if (alive.current) setError(err.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="src-title">
        <h2 id="src-title" className="modal-title">Import to your list</h2>

        {step === 'choose' && (
          <>
            <div className="src-options">
              <button type="button" className="src-option" onClick={() => { onFile(); onClose(); }}>
                <strong>Upload a file</strong>
                <span>MyAnimeList export (.xml or .xml.gz), Excel, Word, CSV or JSON</span>
              </button>
              <button type="button" className="src-option" onClick={() => setStep('anilist')}>
                <strong>From an AniList username</strong>
                <span>Nothing to export. Works for public profiles.</span>
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-line" onClick={onClose}>Close</button>
            </div>
          </>
        )}

        {step === 'anilist' && (
          <form onSubmit={fetchFromAniList}>
            <div className="field">
              <label htmlFor="al-name">AniList username</label>
              <input id="al-name" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={21} placeholder="your_username" disabled={busy} />
              <small>Your AniList profile must be public while you import. You can switch it back afterwards.</small>
            </div>
            <label className="check"><input type="checkbox" checked={kinds.anime} onChange={(e) => setKinds({ ...kinds, anime: e.target.checked })} disabled={busy} /> Anime</label>
            <label className="check"><input type="checkbox" checked={kinds.manga} onChange={(e) => setKinds({ ...kinds, manga: e.target.checked })} disabled={busy} /> Manga</label>
            {error && <p className="error-text" role="alert">{error}</p>}
            {busy && <p className="muted" role="status">Fetching your list from AniList… this can take a few seconds.</p>}
            <div className="modal-actions">
              <button type="submit" className="btn btn-signal" disabled={busy}>Fetch my list</button>
              <button type="button" className="btn btn-line" onClick={() => { setStep('choose'); setError(''); }} disabled={busy}>Back</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
