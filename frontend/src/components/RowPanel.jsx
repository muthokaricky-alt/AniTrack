import { useState } from 'react';
import ScoreInput from './ScoreInput.jsx';

// Slide-down editor under a My List row: score, notes and tags without leaving the page
export default function RowPanel({ entry, onSave, allTags }) {
  const [tag, setTag] = useState('');
  const tags = entry.tags || [];

  const addTag = (raw) => {
    const t = raw.trim().replace(/\s+/g, ' ').slice(0, 24);
    setTag('');
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase()) || tags.length >= 8) return;
    onSave({ tags: [...tags, t] });
  };
  const suggestions = allTags.filter((t) => !tags.some((x) => x.toLowerCase() === t.toLowerCase())).slice(0, 8);

  return (
    <div className="lr-panel" onClick={(e) => e.stopPropagation()}>
      <div className="lr-score">
        <ScoreInput label="Your score" value={entry.score ?? null} onCommit={(v) => onSave({ score: v })} />
      </div>
      <label className="lr-notes">
        Notes
        <textarea
          rows="3"
          maxLength="5000"
          placeholder="Thoughts, where you stopped, who recommended it…"
          defaultValue={entry.review || ''}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (entry.review || '')) onSave({ review: v || null });
          }}
        />
      </label>
      <div className="lr-tags">
        <span className="lr-label">Tags</span>
        <div className="lr-tagrow">
          {tags.map((t) => (
            <span key={t} className="tag">{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => onSave({ tags: tags.filter((x) => x !== t) })}>×</button></span>
          ))}
          {tags.length < 8 && (
            <input
              className="tag-input"
              value={tag}
              placeholder="Add a tag (Rewatch, Comfort…)"
              maxLength="24"
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tag); } }}
              onBlur={() => tag && addTag(tag)}
              aria-label="Add a tag"
            />
          )}
        </div>
        {suggestions.length > 0 && (
          <div className="lr-sugg">{suggestions.map((t) => <button key={t} type="button" className="chip" onClick={() => addTag(t)}>+ {t}</button>)}</div>
        )}
      </div>
    </div>
  );
}
