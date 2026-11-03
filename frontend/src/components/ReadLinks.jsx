// "Where to read" for a manga: official readers (from AniList) plus search links.
// AniTrack only links out. It never hosts, embeds or proxies chapters.
const enc = encodeURIComponent;

export default function ReadLinks({ title, links = [] }) {
  const q = enc(title || '');
  const official = links.length > 0;

  return (
    <section className="readlinks d-in" aria-label="Where to read">
      <p className="kicker">Read officially</p>
      {official ? (
        <div className="rl-row">
          {links.map((l) => (
            <a key={l.url} className="btn btn-line btn-sm" href={l.url} target="_blank" rel="noopener noreferrer">
              {l.site}{l.language ? ` · ${l.language}` : ''} ↗
            </a>
          ))}
        </div>
      ) : (
        <div className="rl-row">
          <a className="btn btn-line btn-sm" href={`https://mangaplus.shueisha.co.jp/search_result?keyword=${q}`} target="_blank" rel="noopener noreferrer">Search MANGA Plus ↗</a>
          <a className="btn btn-line btn-sm" href={`https://www.viz.com/search?search=${q}`} target="_blank" rel="noopener noreferrer">Search VIZ ↗</a>
        </div>
      )}
      <p className="rl-alt">
        Not licensed in your region?{' '}
        <a className="rl-link" href={`https://mangadex.org/search?q=${q}`} target="_blank" rel="noopener noreferrer">Find on MangaDex ↗</a>
      </p>
      <p className="rl-note">Opens an external site. Chapters there are hosted and credited by their own uploaders, not AniTrack.</p>
    </section>
  );
}
