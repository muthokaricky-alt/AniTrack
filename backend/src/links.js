// Official places to watch or read a title (Crunchyroll, MANGA Plus, VIZ...), from AniList's external links.
// Only live https links of type STREAMING are kept. AniTrack links out and never hosts or proxies anything.
export function toOfficialLinks(links, max = 8) {
  const seen = new Set();
  return (Array.isArray(links) ? links : [])
    .filter((l) => l && l.type === 'STREAMING' && !l.isDisabled && typeof l.url === 'string' && l.url.startsWith('https://') && l.site)
    .filter((l) => (seen.has(l.url) ? false : seen.add(l.url)))
    .slice(0, max)
    .map((l) => ({ site: String(l.site).slice(0, 40), url: l.url, language: l.language || null }));
}
