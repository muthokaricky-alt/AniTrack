import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AnimeCard from './AnimeCard.jsx';

// "Because you loved X": AniList's recommendations for a few of your top-scored titles, one row per title.
export default function ForYou() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!user) return undefined;
    let off = false;
    api.forYou().then((r) => !off && setRows(r.rows || [])).catch(() => !off && setRows([]));
    return () => { off = true; };
  }, [user]);

  if (!rows?.length) return null;
  const row = rows[Math.min(active, rows.length - 1)];

  return (
    <section className="fy" aria-labelledby="fy-title">
      <div className="wrap">
        <h2 id="fy-title" className="h2">Because you loved <span className="fy-seed">{row.seed.title}</span></h2>
        {rows.length > 1 && (
          <div className="fy-chips" role="tablist" aria-label="Pick a title to base recommendations on">
            {rows.map((r, i) => (
              <button key={r.seed.mal_id} role="tab" aria-selected={i === active} className={`chip ${i === active ? 'on' : ''}`} onClick={() => setActive(i)}>
                {r.seed.title}
              </button>
            ))}
          </div>
        )}
        <div className="fy-row" key={row.seed.mal_id}>
          {row.data.map((a) => <AnimeCard key={a.mal_id} anime={a} />)}
        </div>
        <p className="muted fy-note">Titles already on your list are left out. The picks change daily.</p>
      </div>
    </section>
  );
}
