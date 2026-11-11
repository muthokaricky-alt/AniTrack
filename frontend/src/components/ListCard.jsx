// A card for one list: a strip of covers, the title and a short summary.
// showVisibility is off on public pages, where every list is public anyway.
import { Link } from 'react-router-dom';

export default function ListCard({ list, showVisibility = true }) {
  const covers = (list.covers || []).slice(0, 4);
  const bits = [
    `${list.count} title${list.count === 1 ? '' : 's'}`,
    list.ranked && 'Ranked',
    list.owner && `by ${list.owner.username}`,
    list.saves > 0 && `${list.saves} saved`,
    showVisibility && (list.is_public === false ? 'Private' : list.is_public ? 'Public' : '')
  ].filter(Boolean);
  return (
    <Link to={`/lists/${list.id}`} className="cl-card">
      <div className="cl-mosaic" aria-hidden="true">
        {covers.length ? covers.map((src, i) => <img key={i} src={src} alt="" loading="lazy" />) : <span className="cl-empty">No titles yet</span>}
      </div>
      <div className="cl-card-body">
        <h3>{list.title}</h3>
        <p>{bits.join(' \u00b7 ')}</p>
      </div>
    </Link>
  );
}
