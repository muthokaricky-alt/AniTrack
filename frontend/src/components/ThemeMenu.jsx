import { useEffect, useRef, useState } from 'react';
import { ACCENTS, MODES, applyTheme, readTheme, saveTheme } from '../lib/theme.js';

// Small popover in the navbar: dark / light / match device, plus an accent colour
export default function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState(readTheme);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    if (t.mode !== 'auto' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const on = () => applyTheme(t);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [t]);

  const set = (patch) => { const next = { ...t, ...patch }; setT(next); saveTheme(next); };

  return (
    <div className="theme" ref={box}>
      <button type="button" className="theme-btn" aria-label="Theme and accent colour" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M10 3a7 7 0 0 0 0 14z" fill="currentColor" /></svg>
      </button>
      {open && (
        <div className="theme-pop" role="dialog" aria-label="Theme">
          <p className="mini-h">Mode</p>
          <div className="theme-modes">
            {MODES.map((m) => (
              <button key={m.key} type="button" className={t.mode === m.key ? 'on' : ''} aria-pressed={t.mode === m.key} onClick={() => set({ mode: m.key })}>{m.label}</button>
            ))}
          </div>
          <p className="mini-h">Accent</p>
          <div className="theme-swatches">
            {ACCENTS.map((a) => (
              <button key={a.key} type="button" title={a.label} aria-label={a.label} aria-pressed={t.accent === a.key} className={t.accent === a.key ? 'on' : ''} style={{ background: a.color }} onClick={() => set({ accent: a.key })} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
