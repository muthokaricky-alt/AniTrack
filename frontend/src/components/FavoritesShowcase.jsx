import { useState } from 'react';
import CharacterDialog from './CharacterDialog.jsx';

const CONFIG = [
  { kind: 'anime', title: 'Favourite anime', href: (id) => `/anime/${id}` },
  { kind: 'manga', title: 'Favourite manga', href: (id) => `/manga/${id}` },
  { kind: 'character', title: 'Favourite characters' } // opens the character dialog here instead of leaving for AniList
];

// Read-only display of a user's top 3 and top 15 lists, used on public profiles.
// The Top 15 starts with the Top 3 (shown as the big tiles), so its grid continues from rank 4.
export default function FavoritesShowcase({ favorites, navigate }) {
  const [openCharacter, setOpenCharacter] = useState(null);
  if (!favorites) return null;

  // One tile. Anime and manga open their page; a character opens the dialog.
  function tile(kind, href, it, rank, big) {
    const inner = (
      <>
        <div className="sc-img">
          {it.image_url ? <img src={it.image_url} alt="" loading="lazy" /> : <div className="img-fallback" />}
          <span className="sc-n">{rank}</span>
        </div>
        <p>{it.title}</p>
        {big && it.sub && <em>{it.sub}</em>}
      </>
    );
    const cls = `sc-tile${big ? ' is-big' : ''}`;
    if (kind === 'character') {
      return (
        <button type="button" key={it.item_id} className={cls} title={it.title} onClick={() => setOpenCharacter(it.item_id)}>
          {inner}
        </button>
      );
    }
    return (
      <a
        key={it.item_id}
        className={cls}
        href={href(it.item_id)}
        title={big ? undefined : it.title}
        onClick={(e) => { if (navigate) { e.preventDefault(); navigate(href(it.item_id)); } }}
      >
        {inner}
      </a>
    );
  }

  return (
    <div className="showcase">
      {CONFIG.map(({ kind, title, href }) => {
        const group = favorites[kind];
        if (!group || (!group.top3.length && !group.top15.length)) return null;
        const after = group.top3.length;
        const rest = group.top15.slice(after);
        return (
          <section key={kind} className="sc-section">
            <h2 className="mini-h">{title}</h2>
            {group.top3.length > 0 && <div className="sc-top3">{group.top3.map((it, i) => tile(kind, href, it, i + 1, true))}</div>}
            {rest.length > 0 && (
              <>
                <h3 className="sc-sub">Top 15{after > 0 ? ` · ranks ${after + 1}–${group.top15.length}` : ''}</h3>
                <div className="sc-top15">{rest.map((it, i) => tile(kind, href, it, after + i + 1, false))}</div>
              </>
            )}
          </section>
        );
      })}
      {openCharacter && <CharacterDialog id={openCharacter} onClose={() => setOpenCharacter(null)} />}
    </div>
  );
}
