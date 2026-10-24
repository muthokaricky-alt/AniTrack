import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { fileToBanner } from '../lib/image.js';
import Banner from './Banner.jsx';

// Choose a profile banner: a picture from one of your favourite series, or one of your own. `current` is { src, x, y } or null.
export default function BannerPicker({ current, onClose, onSaved }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [tab, setTab] = useState('series');
  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState('');
  const [choice, setChoice] = useState(null); // a new picture picked in this dialog: { value, preview }
  const [x, setX] = useState(current?.x ?? 50);
  const [y, setY] = useState(current?.y ?? 50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The series list only loads when its tab is open (it asks AniList, so it is not free to do for nothing)
  useEffect(() => {
    if (tab !== 'series' || options !== null || optionsError) return undefined;
    let off = false;
    api.bannerOptions().then((r) => !off && setOptions(r.options)).catch((e) => !off && setOptionsError(e.message));
    return () => { off = true; };
  }, [tab, options, optionsError]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const preview = choice?.preview || current?.src || null;
  const changed = Boolean(choice) || (Boolean(current) && (x !== current.x || y !== current.y));

  function use(value) {
    setChoice({ value, preview: value });
    setX(50); // a new picture starts centred
    setY(50);
    setError('');
  }

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      use(await fileToBanner(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const body = { x, y };
      if (choice) body.banner = choice.value;
      const r = await api.saveBanner(body);
      onSaved({ src: r.banner, x: r.x, y: r.y });
      toast('Banner saved');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api.saveBanner({ banner: null });
      onSaved(null);
      toast('Banner removed');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal bp-modal" role="dialog" aria-modal="true" aria-labelledby="bp-title">
        <h2 id="bp-title" className="modal-title">Profile banner</h2>

        <div className="bp-preview">
          {preview ? <Banner src={preview} x={x} y={y} /> : <div className="bp-empty">No banner yet. Pick one below.</div>}
        </div>
        {preview && (
          <div className="bp-sliders">
            <label>Left / right <input type="range" min="0" max="100" value={x} onChange={(e) => setX(Number(e.target.value))} /></label>
            <label>Up / down <input type="range" min="0" max="100" value={y} onChange={(e) => setY(Number(e.target.value))} /></label>
          </div>
        )}

        <div className="kind-switch bp-tabs" role="tablist" aria-label="Where the banner comes from">
          <button role="tab" aria-selected={tab === 'series'} className={tab === 'series' ? 'on' : ''} onClick={() => setTab('series')}>From your series</button>
          <button role="tab" aria-selected={tab === 'upload'} className={tab === 'upload' ? 'on' : ''} onClick={() => setTab('upload')}>Upload your own</button>
        </div>

        {tab === 'series' ? (
          <div className="bp-pane">
            {options === null && !optionsError && <p className="muted">Finding banners for your favourites…</p>}
            {optionsError && <p className="error-text">{optionsError}</p>}
            {options && options.length === 0 && (
              <p className="muted">None of your favourites or top-rated titles have a banner picture yet. Add favourites on the Favourites tab, or upload your own.</p>
            )}
            {options && options.length > 0 && (
              <div className="bp-grid">
                {options.map((o) => (
                  <button
                    type="button"
                    key={`${o.kind}:${o.mal_id}`}
                    className={`bp-thumb ${choice?.value === o.url ? 'on' : ''}`}
                    aria-pressed={choice?.value === o.url}
                    title={o.title}
                    onClick={() => use(o.url)}
                  >
                    <img src={o.url} alt="" loading="lazy" />
                    <span>{o.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bp-pane bp-upload">
            <p className="muted">Use any wide picture (JPEG, PNG or WebP, at least 600 pixels wide). It's resized for you, and you can slide it to choose which part shows.</p>
            <button type="button" className="btn btn-line" disabled={busy} onClick={() => fileInput.current?.click()}>
              {busy ? 'Preparing…' : 'Choose a picture'}
            </button>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile} hidden />
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-signal" onClick={save} disabled={busy || !changed}>{busy ? 'Saving…' : 'Save banner'}</button>
          {current && <button type="button" className="btn btn-quiet" onClick={remove} disabled={busy}>Remove banner</button>}
          <button type="button" className="btn btn-line" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
