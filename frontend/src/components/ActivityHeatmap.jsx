import { useMemo } from 'react';
import { buildHeatmap, daysWatched } from '../lib/activity.js';

const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// A year (or half a year on a phone) of progress, one square a day, plus a rough "days watched" total
export default function ActivityHeatmap({ events, kind, total, unit }) {
  // Wide screens get a full year, phones six months so the squares stay readable
  const weeks = typeof window !== 'undefined' && window.innerWidth >= 900 ? 52 : 26;
  const map = useMemo(() => buildHeatmap(events, new Date(), weeks, kind), [events, weeks, kind]);
  const days = kind === 'manga' ? 0 : daysWatched(total);
  if (!map.total && !days) return null;

  return (
    <div className="mo-heat">
      {map.total > 0 && (
        <>
          <div
            className="hm-grid"
            style={{ aspectRatio: `${weeks} / 7` }}
            role="img"
            aria-label={`${map.total} ${unit} over ${map.activeDays} days in the last ${weeks === 52 ? 'year' : 'six months'}`}
          >
            {map.weeks.flat().map((c) => (
              <i key={c.key} className={`hm-cell hm-${c.level}${c.future ? ' hm-future' : ''}`} title={c.future ? undefined : `${fmt.format(c.date)}: ${c.count} ${unit}`} />
            ))}
          </div>
          <div className="hm-foot">
            <span>{map.total} {unit} on {map.activeDays} day{map.activeDays === 1 ? '' : 's'} in the last {weeks === 52 ? 'year' : 'six months'}</span>
            <span className="hm-legend" aria-hidden="true">Less <i className="hm-cell hm-0" /><i className="hm-cell hm-1" /><i className="hm-cell hm-2" /><i className="hm-cell hm-3" /><i className="hm-cell hm-4" /> More</span>
          </div>
        </>
      )}
      {days > 0 && <p className="hm-days"><b>≈ {days}</b> days of {kind === 'manga' ? 'reading' : 'anime'} in total <span className="muted">(counting 24 minutes an episode)</span></p>}
    </div>
  );
}
