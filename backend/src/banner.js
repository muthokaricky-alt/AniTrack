// Rules for profile banners. Pure functions with no database, so they are easy to test.
//
// A banner is stored in users.banner as ONE of:
//   - the address of a banner picture from AniList (picked from your favourite series), or
//   - an uploaded picture, as a small JPEG/PNG/WebP data URL (the browser shrinks it first)
import { isAllowedImageUrl } from './imageUrl.js';

export const BANNER_MAX_CHARS = 330000; // roughly 240 KB of picture

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

// What kind of picture these bytes really are, judged by the file's own first bytes, or null if none of the three we accept.
export function sniffImageType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

// The bytes and type inside a data URL, but only if the file really is the type it claims to be. Otherwise null.
export function dataUrlParts(value) {
  const m = DATA_URL.exec(String(value));
  if (!m) return null;
  const buffer = Buffer.from(m[2], 'base64');
  const type = sniffImageType(buffer);
  return type && type === m[1] ? { type, buffer } : null;
}

const invalid = (error) => ({ valid: false, error });

// Check a banner someone wants to save. null or '' means "remove my banner".
// Result: { valid: true, value, kind: 'upload' | 'series' | null } or { valid: false, error }
export function parseBanner(value) {
  if (value === null || value === '') return { valid: true, value: null, kind: null };
  if (typeof value !== 'string') return invalid('That banner is not valid.');
  if (value.startsWith('data:')) {
    if (value.length > BANNER_MAX_CHARS) return invalid('That picture is too large for a banner. Try a smaller one.');
    if (!dataUrlParts(value)) return invalid('Choose a JPEG, PNG or WebP picture.');
    return { valid: true, value, kind: 'upload' };
  }
  // A series banner has to be an AniList banner picture, never some other address
  if (value.length <= 500 && isAllowedImageUrl(value) && /\/banner\//.test(value)) return { valid: true, value, kind: 'series' };
  return invalid("That banner isn't allowed. Pick one from your series, or upload a picture.");
}

// Position of the picture inside the banner frame: a whole number from 0 to 100 (50 = centred)
export function clampPos(value, fallback = 50) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
}

// What a PUBLIC profile shows. An uploaded picture is served from its own address (which the browser can cache, and which
// changes with ?v= whenever the banner changes); a series banner is simply its AniList address. null means no banner.
export function publicBanner({ username, banner_url, banner_upload, banner_x, banner_y, banner_v }) {
  const src = banner_upload ? `/api/users/${encodeURIComponent(username)}/banner?v=${banner_v}` : banner_url;
  return src ? { src, x: banner_x, y: banner_y } : null;
}
