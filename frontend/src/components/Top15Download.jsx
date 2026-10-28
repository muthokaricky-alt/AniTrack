import { useState } from 'react';
import { imgSrc } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const INK = '#0a0a0a', TEXT = '#f4f1ea', MUTED = '#9b968b', ORANGE = '#ff4b1f';
const COLS = 5, CW = 240, CH = 340, GX = 28, PAD = 70, ROW = CH + 96;
const W = PAD * 2 + COLS * CW + (COLS - 1) * GX;

const load = (src) => new Promise((res) => {
  if (!src) return res(null);
  const i = new Image();
  i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
});

function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function lines(ctx, text, max, n) {
  const out = []; let line = '';
  for (const w of String(text || '').split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width <= max || !line) line = t; else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  if (out.length > n) {
    let last = out[n - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1);
    return [...out.slice(0, n - 1), `${last}…`];
  }
  return out;
}

async function draw(canvas, username, label, items) {
  await Promise.race([
    Promise.all(['900 60px Archivo', '600 60px Fraunces', '500 20px "JetBrains Mono"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 3000))
  ]).catch(() => {});
  const rows = Math.ceil(items.length / COLS);
  const top = 252; // where the first row of covers starts: leaves room for the logo, kicker and title above it
  const H = top + rows * ROW + 90;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,75,31,0.14)';
  for (let y = 18; y < H; y += 30) for (let x = 18; x < W; x += 30) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); }

  ctx.fillStyle = ORANGE; ctx.fillRect(PAD, 62, 18, 18);
  ctx.fillStyle = TEXT; ctx.font = '800 22px Archivo, sans-serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
  ctx.fillText('ANITRACK', PAD + 30, 78);
  ctx.fillStyle = ORANGE; ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillText(`${username.toUpperCase()}'S`, PAD, 134);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillStyle = TEXT; ctx.font = '600 64px Fraunces, Georgia, serif';
  ctx.fillText(`Top ${items.length} ${label}`, PAD, 210); // 64px title: its tops reach about y=165, clear of the kicker above

  const imgs = await Promise.all(items.map((i) => load(imgSrc(i.image_url))));
  items.forEach((it, i) => {
    const x = PAD + (i % COLS) * (CW + GX);
    const y = top + Math.floor(i / COLS) * ROW;
    ctx.fillStyle = '#1c1c1c'; ctx.fillRect(x, y, CW, CH);
    if (imgs[i]) cover(ctx, imgs[i], x, y, CW, CH);
    ctx.fillStyle = ORANGE; ctx.fillRect(x, y, 52, 40);
    ctx.fillStyle = INK; ctx.font = '900 26px Archivo, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x + 26, y + 29); ctx.textAlign = 'left';
    ctx.fillStyle = TEXT; ctx.font = '700 20px Archivo, sans-serif';
    lines(ctx, it.title, CW, 2).forEach((l, k) => ctx.fillText(l, x, y + CH + 30 + k * 26));
  });
  ctx.fillStyle = MUTED; ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText('made with AniTrack', PAD, H - 40);
}

// Downloads a favourites list (anime, manga or characters) as a poster image, or as a plain text list
export default function Top15Download({ kind, label, items }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!items?.length) return null;

  async function png() {
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      await draw(canvas, user?.username || 'my', label, items);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) throw new Error('Could not build the image');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `anitrack-top${items.length}-${kind}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { toast(e.message || 'Download failed', 'error'); }
    setBusy(false);
  }

  function txt() {
    const body = items.map((it, i) => `${i + 1}. ${it.title}`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`Top ${items.length} ${label}\n\n${body}\n`], { type: 'text/plain' }));
    a.download = `anitrack-top${items.length}-${kind}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div className="t15">
      <button type="button" className="btn btn-line btn-sm" onClick={png} disabled={busy}>{busy ? 'Drawing…' : `Download Top ${items.length} ${label} (image)`}</button>
      <button type="button" className="btn btn-line btn-sm" onClick={txt}>Text list</button>
    </div>
  );
}
