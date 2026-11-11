// A custom list shown like a profile's favourites: the first three of a ranked list as big tiles, the rest in a numbered grid.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import CharacterDialog from './CharacterDialog.jsx';
import { labels } from '../lib/listCard.js';

export default function ListShowcase({ list }) {
  const [openCharacter, setOpenCharacter] = useState(null);
  const { items, ranked } = list;
  const big = ranked ? Math.min(3, items.length) : 0;

  function tile(it, i, isBig) {
    const [head, sub] = labels(it); // anime and manga lead with the note, characters with the name
    const inner = (
      <>
        <div className="sc-img">
          {it.image_url ? <img src={it.image_url} alt="" loading="lazy" /> : <div className="img-fallback" />}
          {ranked && <span className="sc-n">{i + 1}</span>}
        </div>
        <p>{head}</p>
        {sub && <em>{sub}</em>}
      </>
    );
    const cls = `sc-tile${isBig ? ' is-big' : ''}`;
    const key = `${it.kind}:${it.mal_id}:${i}`;
    return it.kind === 'character'
      ? <button type="button" key={key} className={cls} title={head} onClick={() => setOpenCharacter(it.mal_id)}>{inner}</button>
      : <Link key={key} className={cls} to={`/${it.kind}/${it.mal_id}`} title={head}>{inner}</Link>;
  }

  return (
    <div className="showcase cl-showcase">
      <section className="sc-section">
        {big > 0 && <div className="sc-top3">{items.slice(0, big).map((it, i) => tile(it, i, true))}</div>}
        {big > 0 && items.length > big && <h3 className="sc-sub">{items.length > big + 1 ? `Ranks ${big + 1}–${items.length}` : `Rank ${big + 1}`}</h3>}
        {items.length > big && <div className="sc-top15">{items.slice(big).map((it, i) => tile(it, big + i, false))}</div>}
      </section>
      {openCharacter && <CharacterDialog id={openCharacter} onClose={() => setOpenCharacter(null)} />}
    </div>
  );
}
