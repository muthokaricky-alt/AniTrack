// "Where to watch" for an anime: official streaming services listed by AniList.
// AniTrack only links out. Nothing is hosted, embedded or proxied here.
export default function WatchLinks({ links = [] }) {
  if (!links.length) return null;
  return (
    <section className="readlinks d-in" aria-label="Where to watch">
      <p className="kicker">Where to watch</p>
      <div className="rl-row">
        {links.map((l) => (
          <a key={l.url} className="btn btn-line btn-sm" href={l.url} target="_blank" rel="noopener noreferrer">
            {l.site}{l.language ? ` · ${l.language}` : ''} ↗
          </a>
        ))}
      </div>
      <p className="rl-note">Opens the service's own site. Availability depends on your region and may need a subscription.</p>
    </section>
  );
}
