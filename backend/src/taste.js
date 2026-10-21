// The taste-match maths. Pure functions (no database, no network), so they are easy to test.
// Used by routes/profile.js (compare with one person) and routes/follows.js (compare with everyone you follow).

const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const parseGenres = (text) => { try { const g = JSON.parse(text || '[]'); return Array.isArray(g) ? g : []; } catch { return []; } };

// A genre "taste vector": each title adds weight to its genres, more for high scores (10 counts 6, unscored 1, 4 or less 0.5)
function genreVector(entries) {
  const v = new Map();
  for (const e of entries) {
    const w = e.score != null ? Math.max(0.5, e.score - 4) : 1;
    for (const g of e.genres) v.set(g, (v.get(g) || 0) + w);
  }
  return v;
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [, x] of a) na += x * x;
  for (const [, x] of b) nb += x * x;
  for (const [g, x] of a) if (b.has(g)) dot += x * b.get(g);
  return na && nb ? dot / Math.sqrt(na * nb) : null;
}

// How alike two people's lists are. Three parts, averaged over the parts that can be measured:
//   genres  (40%): cosine similarity of score-weighted genre vectors, 0.5 or less counts as 0%
//   scores  (40%): how closely they rate titles they both have (0 points apart = 100%, 3 or more apart = 0%)
//   overlap (20%): how many titles they share (40% of the smaller list in common = 100%)
export function compareTaste(mine, theirs) {
  const theirById = new Map(theirs.map((e) => [`${e.kind}:${e.mal_id}`, e]));
  const shared = [];
  for (const e of mine) {
    const o = theirById.get(`${e.kind}:${e.mal_id}`);
    if (o) shared.push({ kind: e.kind, mal_id: e.mal_id, title: e.title, image_url: e.image_url || o.image_url, you: e.score, them: o.score });
  }
  const both = shared.filter((s) => s.you != null && s.them != null);
  const meanDiff = both.length >= 3 ? both.reduce((sum, s) => sum + Math.abs(s.you - s.them), 0) / both.length : null;
  const cos = cosine(genreVector(mine), genreVector(theirs));
  const overlapRaw = mine.length && theirs.length ? shared.length / Math.min(mine.length, theirs.length) : 0;

  const parts = {
    genres: cos == null ? null : clamp01((cos - 0.5) / 0.5),
    scores: meanDiff == null ? null : clamp01(1 - meanDiff / 3),
    overlap: clamp01(overlapRaw / 0.4)
  };
  const weights = { genres: 0.4, scores: 0.4, overlap: 0.2 };
  let sum = 0, wsum = 0;
  for (const k of Object.keys(parts)) if (parts[k] != null) { sum += parts[k] * weights[k]; wsum += weights[k]; }

  // genres you both lean towards, by the smaller of the two weights
  const gm = genreVector(mine), gt = genreVector(theirs);
  const commonGenres = [...gm.keys()].filter((g) => gt.has(g)).sort((a, b) => Math.min(gt.get(b), gm.get(b)) - Math.min(gt.get(a), gm.get(a))).slice(0, 5);

  const pct = (x) => (x == null ? null : Math.round(x * 100));
  return {
    percent: wsum ? Math.round((sum / wsum) * 100) : 0,
    parts: { genres: pct(parts.genres), scores: pct(parts.scores), overlap: pct(parts.overlap) },
    shared_count: shared.length,
    mean_diff: meanDiff == null ? null : Math.round(meanDiff * 10) / 10,
    both_loved: both.filter((s) => s.you >= 8 && s.them >= 8).sort((a, b) => Math.min(b.you, b.them) - Math.min(a.you, a.them)).slice(0, 6),
    disagree: both.filter((s) => Math.abs(s.you - s.them) >= 2).sort((a, b) => Math.abs(b.you - b.them) - Math.abs(a.you - a.them)).slice(0, 3),
    common_genres: commonGenres
  };
}
