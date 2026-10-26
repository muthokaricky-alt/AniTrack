import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { ACTIVITY_STEP_CAP } from '../constants.js';

const GOAL_KEY = 'anitrack:weekgoal';
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function startOfWeek(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d;
}

// Streak, this week's count and a goal ring, built from the progress log
export default function Momentum({ kind }) {
  const [events, setEvents] = useState(null);
  const [goal, setGoal] = useState(() => {
    try { return Number(localStorage.getItem(GOAL_KEY)) || 10; } catch { return 10; }
  });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let off = false;
    api.activity().then((r) => !off && setEvents(r.events || [])).catch(() => !off && setEvents([]));
    return () => { off = true; };
  }, []);

  const m = useMemo(() => {
    if (!events) return null;
    const days = new Set(events.map((e) => dayKey(new Date(e.ts))));
    const today = new Date();
    let streak = 0;
    const cursor = new Date(today);
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1); // today not logged yet does not break it
    while (days.has(dayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    const from = startOfWeek(today).getTime();
    const week = events.filter((e) => new Date(e.ts).getTime() >= from);
    // one update counts for at most ACTIVITY_STEP_CAP, so marking a long series as caught up can't fill the whole week
    const sum = (arr) => arr.reduce((s, e) => s + Math.min(e.delta, ACTIVITY_STEP_CAP), 0);
    return { streak, weekAnime: sum(week.filter((e) => e.kind === 'anime')), weekManga: sum(week.filter((e) => e.kind === 'manga')), any: events.length > 0 };
  }, [events]);

  if (!m) return null;
  const done = kind === 'manga' ? m.weekManga : m.weekAnime;
  const unit = kind === 'manga' ? 'chapters' : 'episodes';
  const pct = Math.min(1, done / goal);
  const R = 30, C = 2 * Math.PI * R;

  const saveGoal = (v) => {
    const n = Math.max(1, Math.min(500, Math.round(Number(v) || 10)));
    setGoal(n);
    try { localStorage.setItem(GOAL_KEY, String(n)); } catch { /* private mode */ }
    setEditing(false);
  };

  return (
    <section className="mo" aria-label="Your momentum">
      <div className="mo-ring">
        <svg viewBox="0 0 76 76" role="img" aria-label={`${done} of ${goal} ${unit} this week`}>
          <circle cx="38" cy="38" r={R} className="mo-track" />
          <circle cx="38" cy="38" r={R} className="mo-arc" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 38 38)" />
        </svg>
        <strong style={done >= 1000 ? { fontSize: 13 } : done >= 100 ? { fontSize: 17 } : undefined}>{done}</strong>
      </div>
      <div className="mo-text">
        <p className="mo-line"><b>{done}</b> of {editing ? (
          <input className="mo-goal" type="number" min="1" max="500" defaultValue={goal} autoFocus onBlur={(e) => saveGoal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label="Weekly goal" />
        ) : <button type="button" className="mo-edit" onClick={() => setEditing(true)} title="Change your weekly goal">{goal}</button>} {unit} this week</p>
        <p className="muted mo-sub">{done >= goal ? 'Goal reached. Nice.' : `${goal - done} to go. Resets every Monday.`}</p>
      </div>
      <div className="mo-streak">
        <strong>{m.streak}</strong>
        <span>day streak</span>
      </div>
    </section>
  );
}
