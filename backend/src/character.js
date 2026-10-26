// Turning an AniList character into the small, safe shape the character dialog shows. Pure functions, easy to test.
import { cleanImageUrl } from './imageUrl.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// AniList descriptions are written in a mini markup: ~!spoilers!~, __bold__, ~~strike~~, [text](link), img(url) and HTML.
// Spoilers are removed completely (nobody opens a profile expecting plot twists), the rest becomes plain readable text.
export function cleanCharacterText(text, max = 1200) {
  let s = String(text ?? '').replace(/\r/g, '');
  s = s.replace(/~!([\s\S]*?)!~/g, ''); // spoiler blocks
  s = s.replace(/~!|!~/g, ''); // a stray, unmatched spoiler marker
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''); // HTML
  s = s.replace(/img\d*\([^)]*\)/gi, ''); // embedded pictures
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // [text](link) keeps the text
  s = s.replace(/(__|\*\*)(.+?)\1/g, '$2').replace(/~~(.+?)~~/g, '$1'); // bold and strike-through markers
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (s.length > max) s = `${s.slice(0, max).replace(/\s+\S*$/, '')}…`; // cut at a word boundary
  return s;
}

// 'March 11', or just 'March' when the day isn't known, or null
export function birthdayText(dob) {
  const month = Number(dob?.month);
  const day = Number(dob?.day);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return Number.isInteger(day) && day >= 1 && day <= 31 ? `${MONTHS[month - 1]} ${day}` : MONTHS[month - 1];
}

const short = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

// `c` is AniList's Character object. Series that have no MyAnimeList id are left out (they can't be opened inside AniTrack).
export function characterShape(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: short(c.name?.full, 120) || 'Unknown',
    native: short(c.name?.native, 120),
    alternative: (c.name?.alternative || []).map((n) => short(n, 80)).filter(Boolean).slice(0, 4),
    image_url: cleanImageUrl(c.image?.large),
    description: cleanCharacterText(c.description),
    gender: short(c.gender, 40),
    age: short(c.age, 40),
    birthday: birthdayText(c.dateOfBirth),
    blood_type: short(c.bloodType, 10),
    favourites: Number.isInteger(c.favourites) ? c.favourites : null,
    appears_in: (c.media?.nodes || [])
      .filter((m) => m && Number.isInteger(m.idMal))
      .slice(0, 8)
      .map((m) => ({
        mal_id: m.idMal,
        kind: m.type === 'MANGA' ? 'manga' : 'anime',
        title: short(m.title?.english, 200) || short(m.title?.romaji, 200) || 'Untitled',
        image_url: cleanImageUrl(m.coverImage?.large || m.coverImage?.medium),
        format: short(m.format, 20)
      }))
  };
}
