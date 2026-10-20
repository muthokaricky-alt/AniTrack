// Turns a cover's dominant colour (AniList gives "#e4a15d") into an accent that is safe on AniTrack's near-black pages.
// Very dark covers would vanish and very light ones would glare, so lightness is held in a readable band
// and washed-out colours get a little saturation back.

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: Math.round(((h * 60) + 360) % 360), s, l };
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Returns { accent, hot } as CSS colours, or null when the input isn't a 6-digit hex colour
export function accentFrom(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const { h, s, l } = hexToHsl(hex);
  const sat = s < 0.08 ? s : clamp(s, 0.5, 0.95); // true greys stay grey
  const light = clamp(l, 0.58, 0.7);
  return {
    accent: `hsl(${h} ${Math.round(sat * 100)}% ${Math.round(light * 100)}%)`,
    hot: `hsl(${h} ${Math.round(sat * 100)}% ${Math.round(clamp(light + 0.08, 0, 0.8) * 100)}%)`
  };
}
