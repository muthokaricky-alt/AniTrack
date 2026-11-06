// Turns an AniList MediaListCollection into the rows AniTrack's import preview already understands.
// Pure functions only, so they can be tested without the network.

// AniList usernames are letters, digits and underscores, 2 to 20 characters
export const USERNAME_RE = /^[A-Za-z0-9_]{2,20}$/;

const STATUS = { CURRENT: 'active', REPEATING: 'active', COMPLETED: 'completed', PAUSED: 'on_hold', DROPPED: 'dropped', PLANNING: 'plan' };

export const LIST_QUERY = `
  query ($userName: String, $type: MediaType, $chunk: Int) {
    MediaListCollection(userName: $userName, type: $type, chunk: $chunk, perChunk: 500) {
      hasNextChunk
      lists {
        isCustomList
        entries {
          status
          score(format: POINT_10_DECIMAL)
          progress
          notes
          media { idMal title { romaji english } episodes chapters genres coverImage { extraLarge large medium } }
        }
      }
    }
  }
`;

// Custom lists repeat entries that already sit in the status lists, so they are skipped.
// Titles AniList knows but MyAnimeList does not have no id AniTrack can use, so they are reported as skipped.
export function shapeCollection(collection, kind) {
  const seen = new Set();
  const skipped = [];
  const rows = [];
  for (const list of collection?.lists || []) {
    if (!list || list.isCustomList) continue;
    for (const e of list.entries || []) {
      const m = e?.media;
      if (!m) continue;
      const title = String(m.title?.english || m.title?.romaji || '').trim().slice(0, 300);
      if (!Number.isInteger(m.idMal) || m.idMal <= 0) {
        if (title && !skipped.includes(title)) skipped.push(title);
        continue;
      }
      if (seen.has(m.idMal)) continue;
      seen.add(m.idMal);

      const total = kind === 'manga' ? m.chapters : m.episodes;
      rows.push({
        title: title || `MyAnimeList #${m.idMal}`,
        mal_id: m.idMal,
        status: STATUS[e.status] || null,
        // asked for on a 10-point scale already; 0 means "not scored"
        score: typeof e.score === 'number' && e.score > 0 ? Math.min(10, Math.round(e.score * 2) / 2) : null,
        progress: Number.isInteger(e.progress) && e.progress >= 0 ? e.progress : null,
        total: Number.isInteger(total) && total > 0 ? total : null,
        review: typeof e.notes === 'string' && e.notes.trim() ? e.notes.trim().slice(0, 5000) : null,
        genres: Array.isArray(m.genres) ? m.genres.filter((g) => typeof g === 'string').slice(0, 12) : [],
        ratings: null,
        image_url: m.coverImage?.extraLarge || m.coverImage?.large || m.coverImage?.medium || null
      });
    }
  }
  return { rows, skipped };
}
