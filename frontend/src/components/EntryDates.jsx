// When you started and finished a title, and how many times you have been through it again.
// paper: the light panel on a title's page. Otherwise it sits in the dark row editor on My List.
import { todayLocal } from '../lib/dates.js';

export default function EntryDates({ entry, kind, onSave, paper = false }) {
  const n = entry.rewatches || 0;
  const label = kind === 'manga' ? 'Reread' : 'Rewatched';
  const today = todayLocal();
  return (
    <div className={`ed ${paper ? 'tracker-fields' : 'lr-dates'}`}>
      <label>
        Started
        <input type="date" max={today} defaultValue={entry.started_on || ''} key={`s${entry.started_on || ''}`} onChange={(e) => onSave({ started_on: e.target.value || null })} />
      </label>
      <label>
        Finished
        <input type="date" min={entry.started_on || undefined} max={today} defaultValue={entry.finished_on || ''} key={`f${entry.finished_on || ''}`} onChange={(e) => onSave({ finished_on: e.target.value || null })} />
      </label>
      <div className="ed-again" role="group" aria-label={label}>
        <span>{label}</span>
        <button type="button" aria-label={`One fewer time`} disabled={n <= 0} onClick={() => onSave({ rewatches: n - 1 })}>−</button>
        <b>{n}×</b>
        <button type="button" aria-label={`One more time`} disabled={n >= 99} onClick={() => onSave({ rewatches: n + 1 })}>+</button>
      </div>
    </div>
  );
}
