// Draws a custom list as a poster image. For lists like "Top 10 arcs" the note is the headline under each cover
// (Marineford) and the show is the small line beneath it (One Piece). Titles without a note show the title itself.
// The drawing is kept apart from the button so it can be tested, and loadImage is passed in.

const INK = '#0a0a0a', TEXT = '#f4f1ea', MUTED = '#9b968b', ORANGE = '#ff4b1f';
const COLS = 5, CW = 240, CH = 340, GX = 28, PAD = 70;
export const CARD_WIDTH = PAD * 2 + COLS * CW + (COLS - 1) * GX;

function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

// Wraps text into at most n lines no wider than max, ending the last one with an ellipsis if it had to be cut
export function wrapLines(ctx, text, max, n) {
  const out = [];
  let line = '';
  for (const w of String(text || '').split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width <= max || !line) line = t;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  if (out.length > n) {
    let last = out[n - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1);
    return [...out.slice(0, n - 1), `${last}…`];
  }
  // a single very long word can still be too wide: cut it too
  return out.map((l) => {
    if (ctx.measureText(l).width <= max) return l;
    let cut = l;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
    return `${cut}…`;
  });
}

export async function drawListCard(canvas, { title, owner, ranked, items }, loadImage) {
  await Promise.race([
    Promise.all(['900 60px Archivo', '600 60px Fraunces', '500 20px "JetBrains Mono"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 3000))
  ]).catch(() => {});

  const probe = canvas.getContext('2d');
  probe.font = '600 64px Fraunces, Georgia, serif';
  const titleLines = wrapLines(probe, title, CARD_WIDTH - PAD * 2, 2);
  const hasNotes = items.some((i) => i.note);
  const rowH = CH + (hasNotes ? 138 : 96);
  const top = 252 + (titleLines.length - 1) * 76; // where the first row of covers starts
  const rows = Math.ceil(items.length / COLS);
  const H = top + rows * rowH + 90;

  canvas.width = CARD_WIDTH;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = INK; ctx.fillRect(0, 0, CARD_WIDTH, H);
  ctx.fillStyle = 'rgba(255,75,31,0.14)';
  for (let y = 18; y < H; y += 30) for (let x = 18; x < CARD_WIDTH; x += 30) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); }

  ctx.fillStyle = ORANGE; ctx.fillRect(PAD, 62, 18, 18);
  ctx.fillStyle = TEXT; ctx.font = '800 22px Archivo, sans-serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.fillText('ANITRACK', PAD + 30, 78);
  ctx.fillStyle = ORANGE; ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillText(`${String(owner || 'my').toUpperCase()}'S ${ranked ? 'RANKED ' : ''}LIST`, PAD, 134);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillStyle = TEXT; ctx.font = '600 64px Fraunces, Georgia, serif';
  titleLines.forEach((l, k) => ctx.fillText(l, PAD, 210 + k * 76));

  const imgs = await Promise.all(items.map((i) => loadImage(i.image_url)));
  items.forEach((it, i) => {
    const x = PAD + (i % COLS) * (CW + GX);
    const y = top + Math.floor(i / COLS) * rowH;
    ctx.fillStyle = '#1c1c1c'; ctx.fillRect(x, y, CW, CH);
    if (imgs[i]) cover(ctx, imgs[i], x, y, CW, CH);
    if (ranked) {
      ctx.fillStyle = ORANGE; ctx.fillRect(x, y, i >= 99 ? 78 : i >= 9 ? 66 : 52, 40);
      ctx.fillStyle = INK; ctx.font = '900 26px Archivo, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x + (i >= 99 ? 39 : i >= 9 ? 33 : 26), y + 29); ctx.textAlign = 'left';
    }
    // the note is the headline when there is one, with the show as a small line under it
    ctx.fillStyle = TEXT; ctx.font = '700 20px Archivo, sans-serif';
    const head = wrapLines(ctx, it.note || it.title, CW, 2);
    head.forEach((l, k) => ctx.fillText(l, x, y + CH + 30 + k * 26));
    if (it.note) {
      ctx.fillStyle = MUTED; ctx.font = '500 16px "JetBrains Mono", monospace';
      ctx.fillText(wrapLines(ctx, it.title, CW, 1)[0] || '', x, y + CH + 30 + head.length * 26 + 6);
    }
  });
  ctx.fillStyle = MUTED; ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText('made with AniTrack', PAD, H - 40);
}

// "1. Marineford (One Piece)" or "1. One Piece" when there is no note
export function listText({ title, items }) {
  const body = items.map((it, i) => `${i + 1}. ${it.note ? `${it.note} (${it.title})` : it.title}`).join('\n');
  return `${title}\n\n${body}\n`;
}

export const cardFileName = (title, ext) => `anitrack-${String(title || 'list').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'list'}.${ext}`;
