import { Link } from 'react-router-dom';

// A card for one list: a strip of covers, the title and a short summary.
// showVisibility is off on public profiles, where every list is public anyway.
export default function ListCard({ list, showVisibility = true }) {
  const covers = (list.covers || []).slice(0, 4);
  return (
    <Link to={`/lists/${list.id}`} className="cl-card">
      <div className="cl-mosaic" aria-hidden="true">
        {covers.length ? covers.map((src, i) => <img key={i} src={src} alt="" loading="lazy" />) : <span className="cl-empty">No titles yet</span>}
      </div>
      <div className="cl-card-body">
        <h3>{list.title}</h3>
        <p>
          {list.count} title{list.count === 1 ? '' : 's'}
          {list.ranked ? ' \u00b7 Ranked' : ''}
          {showVisibility ? (list.is_public === false ? ' \u00b7 Private' : list.is_public ? ' \u00b7 Public' : '') : ''}
        </p>
      </div>
    </Link>
  );
}
