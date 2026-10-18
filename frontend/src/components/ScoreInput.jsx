import { useEffect, useRef, useState } from 'react';

// A 0.5-step slider for one rating. Empty until the user presses Rate; saves when they let go.
export default function ScoreInput({ label, value, onCommit, disabled = false }) {
  const [draft, setDraft] = useState(value ?? null);
  const saved = useRef(value ?? null);

  useEffect(() => {
    setDraft(value ?? null);
    saved.current = value ?? null;
  }, [value]);

  function commit(v) {
    if (v === saved.current) return;
    saved.current = v;
    onCommit(v);
  }

  return (
    <div className="score-input">
      <div className="si-head">
        <span>{label}</span>
        <output>{draft ?? '—'}</output>
      </div>
      {draft === null ? (
        <button type="button" className="si-rate" disabled={disabled} onClick={() => { setDraft(7); commit(7); }}>
          Rate
        </button>
      ) : (
        <div className="si-row">
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={draft}
            disabled={disabled}
            aria-label={label}
            onChange={(e) => setDraft(Number(e.target.value))}
            onPointerUp={() => commit(draft)}
            onKeyUp={() => commit(draft)}
            onBlur={() => commit(draft)}
          />
          <button type="button" className="si-clear" aria-label={`Clear ${label}`} onClick={() => { setDraft(null); commit(null); }}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
