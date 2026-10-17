import { useMemo } from 'react';
import { STATUS_LABEL, KINDS } from '../constants.js';

const AVG_EPISODE_MINUTES = 24;
const STATUS_COLOR = {
  watching: 'var(--signal)', reading: 'var(--signal)', completed: 'var(--paper)',
  on_hold: 'var(--amber)', dropped: 'var(--stone)', plan_to_watch: 'var(--line-strong)', plan_to_read: 'var(--line-strong)'
};

// Taste profile computed from the user's own list: status split, score spread, favourite genres, time spent
export default function Insights({ entries, kind }) {
  const cfg = KINDS[kind];

  const data = useMemo(() => {
    const byStatus = {};
    const scores = Array(10).fill(0);
    const genres = {};
    let withGenres = 0;
    let units = 0;
    for (const e of entries) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      if (e.score >= 1 && e.score <= 10) scores[e.score - 1] += 1;
      units += e[cfg.progress] || 0;
      if (Array.isArray(e.genres) && e.genres.length) {
        withGenres += 1;
        for (const g of e.genres) genres[g] = (genres[g] || 0) + 1;
      }
    }
    const topGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { byStatus, scores, topGenres, withGenres, units };
  }, [entries, cfg]);

  if (entries.length === 0) return null;
  const maxScore = Math.max(1, ...data.scores);
  const maxGenre = Math.max(1, ...data.topGenres.map(([, n]) => n));
  const days = (data.units * AVG_EPISODE_MINUTES) / 60 / 24;

  return (
    <section className="insights" aria-labelledby="insights-title">
      <p className="kicker">Your taste</p>
      <h2 id="insights-title" className="h2">By the numbers</h2>

      <div className="split-bar" role="img" aria-label="List split by status">
        {cfg.statuses.map((s) =>
          data.byStatus[s.key] ? (
            <span key={s.key} style={{ flex: data.byStatus[s.key], background: STATUS_COLOR[s.key] }} title={`${s.label}: ${data.byStatus[s.key]}`} />
          ) : null
        )}
      </div>
      <ul className="split-legend">
        {cfg.statuses.map((s) => (
          <li key={s.key}>
            <i style={{ background: STATUS_COLOR[s.key] }} />
            {STATUS_LABEL[s.key]} <b>{data.byStatus[s.key] || 0}</b>
          </li>
        ))}
      </ul>

      <div className="insight-cols">
        <div>
          <h3 className="mini-h">Scores you give</h3>
          <div className="score-bars" role="img" aria-label="Score distribution">
            {data.scores.map((n, i) => (
              <div className="score-col" key={i} title={`${i + 1}: ${n}`}>
                <span style={{ height: `${(n / maxScore) * 100}%` }} />
                <em>{i + 1}</em>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mini-h">Favourite genres</h3>
          {data.topGenres.length === 0 ? (
            <p className="muted">Genres are saved for titles you add from now on. They'll show up here.</p>
          ) : (
            <ul className="genre-bars">
              {data.topGenres.map(([g, n]) => (
                <li key={g}>
                  <span>{g}</span>
                  <div><i style={{ width: `${(n / maxGenre) * 100}%` }} /></div>
                  <b>{n}</b>
                </li>
              ))}
            </ul>
          )}
          {data.topGenres.length > 0 && data.withGenres < entries.length && (
            <p className="muted note">Based on {data.withGenres} of {entries.length} titles; older entries have no genres saved.</p>
          )}
        </div>
      </div>

      {kind === 'anime' && data.units > 0 && (
        <p className="time-line">
          ≈ <strong>{days >= 1 ? days.toFixed(1) : ((data.units * AVG_EPISODE_MINUTES) / 60).toFixed(1)}</strong>{' '}
          {days >= 1 ? 'days' : 'hours'} of anime watched <span className="muted">(at {AVG_EPISODE_MINUTES} min per episode)</span>
        </p>
      )}
    </section>
  );
}
