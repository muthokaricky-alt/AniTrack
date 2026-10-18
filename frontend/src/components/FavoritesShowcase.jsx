const CONFIG = [
  { kind: 'anime', title: 'Favourite anime', href: (id) => `/anime/${id}` },
  { kind: 'manga', title: 'Favourite manga', href: (id) => `/manga/${id}` },
  { kind: 'character', title: 'Favourite characters', href: (id) => `https://anilist.co/character/${id}`, external: true }
];

// Read-only display of a user's top 3 and top 15 lists, used on public profiles
export default function FavoritesShowcase({ favorites, navigate }) {
  if (!favorites) return null;
  const go = (e, href, external) => {
    if (external || !navigate) return;
    e.preventDefault();
    navigate(href);
  };
  return (
    <div className="showcase">
      {CONFIG.map(({ kind, title, href, external }) => {
        const group = favorites[kind];
        if (!group || (!group.top3.length && !group.top15.length)) return null;
        return (
          <section key={kind} className="sc-section">
            <h2 className="mini-h">{title}</h2>
            {group.top3.length > 0 && (
              <div className="sc-top3">
                {group.top3.map((it, i) => (
                  <a
                    key={it.item_id}
                    className="sc-tile is-big"
                    href={href(it.item_id)}
                    {...(external ? { target: '_blank', rel: 'noreferrer' } : { onClick: (e) => go(e, href(it.item_id), false) })}
                  >
                    <div className="sc-img">
                      {it.image_url ? <img src={it.image_url} alt="" loading="lazy" /> : <div className="img-fallback" />}
                      <span className="sc-n">{i + 1}</span>
                    </div>
                    <p>{it.title}</p>
                    {it.sub && <em>{it.sub}</em>}
                  </a>
                ))}
              </div>
            )}
            {group.top15.length > 0 && (
              <>
                <h3 className="sc-sub">Top 15</h3>
                <div className="sc-top15">
                  {group.top15.map((it, i) => (
                    <a
                      key={it.item_id}
                      className="sc-tile"
                      href={href(it.item_id)}
                      title={it.title}
                      {...(external ? { target: '_blank', rel: 'noreferrer' } : { onClick: (e) => go(e, href(it.item_id), false) })}
                    >
                      <div className="sc-img">
                        {it.image_url ? <img src={it.image_url} alt="" loading="lazy" /> : <div className="img-fallback" />}
                        <span className="sc-n">{i + 1}</span>
                      </div>
                      <p>{it.title}</p>
                    </a>
                  ))}
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
