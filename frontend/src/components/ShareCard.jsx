import { useEffect, useMemo, useRef, useState } from 'react';
import { api, imgSrc } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { useMangaList } from '../context/MangaListContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { KINDS } from '../constants.js';

const W = 1080;
const H = 1350;
const ORANGE = '#ff4b1f';
const INK = '#0a0a0a';
const TEXT = '#f4f1ea';
const MUTED = '#9b968b';

const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

async function ensureFonts() {
  const wanted = ['600 96px Fraunces', 'italic 400 34px Fraunces', '900 96px Archivo', '700 30px Archivo', '500 24px "JetBrains Mono"'];
  await Promise.race([Promise.all(wanted.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
}

// draw an image like CSS object-fit: cover
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.replace(/[\s,.;:]+$/, '')}…`;
    return kept;
  }
  return lines;
}

const setSpacing = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };

// stats: { total, progress, mean } for the list being shown, so a manga card never shows anime numbers
async function drawCard(canvas, { user, kind, items, stats, link }) {
  await ensureFonts();
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  // background and dot grid
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255, 75, 31, 0.15)';
  for (let y = 18; y < H; y += 30) for (let x = 18; x < W; x += 30) { ctx.beginPath(); ctx.arc(x, y, 1.7, 0, Math.PI * 2); ctx.fill(); }

  // brand
  ctx.fillStyle = ORANGE;
  ctx.fillRect(60, 56, 22, 22);
  ctx.fillStyle = TEXT;
  ctx.font = '800 26px Archivo, sans-serif';
  setSpacing(ctx, 4);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ANITRACK', 96, 76);
  setSpacing(ctx, 0);

  // avatar
  const [avatar, ...covers] = await Promise.all([loadImage(user.avatar), ...items.map((i) => loadImage(imgSrc(i.image_url)))]);
  const ax = 60, ay = 132, as = 132;
  if (avatar) drawCover(ctx, avatar, ax, ay, as, as);
  else {
    ctx.fillStyle = ORANGE;
    ctx.fillRect(ax, ay, as, as);
    ctx.fillStyle = INK;
    ctx.font = '900 64px Archivo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((user.username || '?').slice(0, 1).toUpperCase(), ax + as / 2, ay + as / 2 + 22);
    ctx.textAlign = 'left';
  }

  // name: shrink until it fits next to the avatar
  let size = 104;
  ctx.fillStyle = TEXT;
  do {
    ctx.font = `600 ${size}px Fraunces, Georgia, serif`;
    size -= 4;
  } while (ctx.measureText(user.username).width > W - 60 - 60 - as - 36 && size > 40);
  ctx.fillText(user.username, ax + as + 36, ay + 78);
  ctx.fillStyle = ORANGE;
  ctx.font = '500 24px "JetBrains Mono", monospace';
  setSpacing(ctx, 3);
  ctx.fillText(`TOP ${items.length} ${KINDS[kind].name.toUpperCase()}`, ax + as + 38, ay + 122);
  setSpacing(ctx, 0);

  // bio
  let y = ay + as + 52;
  if (user.bio) {
    ctx.fillStyle = '#cfc9bc';
    ctx.font = 'italic 400 34px Fraunces, Georgia, serif';
    for (const line of wrapLines(ctx, user.bio, W - 120, 2)) {
      ctx.fillText(line, 60, y);
      y += 46;
    }
  }

  // covers
  const cw = 300, ch = 450, gap = 30;
  const cy = Math.max(y + 24, 440);
  const startX = items.length === 3 ? 60 : (W - (items.length * cw + (items.length - 1) * gap)) / 2;
  items.forEach((it, i) => {
    const x = startX + i * (cw + gap);
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(x, cy, cw, ch);
    if (covers[i]) drawCover(ctx, covers[i], x, cy, cw, ch);
    else {
      ctx.fillStyle = MUTED;
      ctx.font = '500 24px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No cover', x + cw / 2, cy + ch / 2);
      ctx.textAlign = 'left';
    }
    // rank numeral, outlined so it reads on any cover
    ctx.font = '900 168px Archivo, sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = INK;
    ctx.strokeText(String(i + 1), x + 10, cy + ch - 6);
    ctx.fillStyle = ORANGE;
    ctx.fillText(String(i + 1), x + 10, cy + ch - 6);

    ctx.fillStyle = TEXT;
    ctx.font = '700 29px Archivo, sans-serif';
    const lines = wrapLines(ctx, it.title, cw, 2);
    lines.forEach((l, n) => ctx.fillText(l, x, cy + ch + 46 + n * 36));
    if (it.score != null) {
      ctx.fillStyle = ORANGE;
      ctx.font = '500 24px "JetBrains Mono", monospace';
      ctx.fillText(`★ ${it.score}`, x, cy + ch + 46 + lines.length * 36 + 8);
    }
  });

  // stats
  const sy = 1100;
  ctx.fillStyle = TEXT;
  ctx.fillRect(60, sy, W - 120, 3);
  const name = KINDS[kind].name.toLowerCase();
  const cells = [
    [Number(stats.total || 0).toLocaleString(), `${name} tracked`],
    [Number(stats.progress || 0).toLocaleString(), KINDS[kind].progressLabel.toLowerCase()], // episodes watched / chapters read
    [stats.mean ?? '—', `mean ${name} score`]
  ];
  cells.forEach(([n, label], i) => {
    const x = 60 + i * 340;
    ctx.fillStyle = TEXT;
    let size = 88; // shrink a long number (like 12,345) until it fits its column
    do {
      ctx.font = `900 ${size}px Archivo, sans-serif`;
      size -= 4;
    } while (ctx.measureText(n).width > 300 && size > 40);
    ctx.fillText(n, x, sy + 110);
    ctx.fillStyle = MUTED;
    ctx.font = '500 22px "JetBrains Mono", monospace';
    ctx.fillText(label, x, sy + 148);
  });

  // footer
  ctx.fillStyle = MUTED;
  ctx.font = '500 24px "JetBrains Mono", monospace';
  ctx.fillText(link || 'Tracked with AniTrack', 60, H - 44);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(W - 88, H - 66, 28, 28);
}

// "Share card" dialog: draws a picture of your top three with your stats, ready to post
export default function ShareCard({ onClose }) {
  const { user } = useAuth();
  const anime = useList();
  const manga = useMangaList();
  const toast = useToast();
  const canvas = useRef(null);
  const [kind, setKind] = useState('anime');
  const shown = (kind === 'manga' ? manga : anime).stats; // the numbers for the list being shown
  const [favs, setFavs] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | empty | error
  const canShare = useMemo(() => {
    try {
      return Boolean(navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] }));
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    api.favorites().then(setFavs).catch(() => setFavs({}));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // your chosen top 3, topped up with your highest-rated titles if you picked fewer than three
  const items = useMemo(() => {
    if (!favs) return null;
    const src = kind === 'manga' ? manga : anime;
    const byId = new Map(src.entries.map((e) => [e.mal_id, e]));
    const picked = (favs[kind]?.top3 || []).map((f) => ({ id: f.item_id, title: f.title, image_url: f.image_url || byId.get(f.item_id)?.image_url, score: byId.get(f.item_id)?.score ?? null }));
    const ids = new Set(picked.map((p) => p.id));
    const extra = [...src.entries]
      .filter((e) => e.score != null && !ids.has(e.mal_id))
      .sort((a, b) => b.score - a.score)
      .map((e) => ({ id: e.mal_id, title: e.title, image_url: e.image_url, score: e.score }));
    return [...picked, ...extra].slice(0, 3);
  }, [favs, kind, anime.entries, manga.entries]);

  useEffect(() => {
    if (!items || !canvas.current) return undefined;
    if (!items.length) { setState('empty'); return undefined; }
    let off = false;
    setState('loading');
    const link = user.is_public ? `${window.location.host}/u/${encodeURIComponent(user.username)}` : null;
    drawCard(canvas.current, { user, kind, items, stats: { total: shown.total, progress: shown.progress, mean: shown.mean }, link })
      .then(() => !off && setState('ready'))
      .catch(() => !off && setState('error'));
    return () => { off = true; };
  }, [items, kind, user, shown.total, shown.progress, shown.mean]);

  const toBlob = () => new Promise((resolve) => canvas.current.toBlob(resolve, 'image/png'));

  async function download() {
    try {
      const blob = await toBlob();
      if (!blob) throw new Error('export failed');
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `anitrack-${user.username}-${kind}.png` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      toast('Could not save the image. Try another browser.', 'error');
    }
  }

  async function share() {
    try {
      const blob = await toBlob();
      await navigator.share({ files: [new File([blob], `anitrack-${user.username}.png`, { type: 'image/png' })], title: `${user.username} on AniTrack` });
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Sharing did not work. Use Download instead.', 'error');
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal sc" role="dialog" aria-modal="true" aria-labelledby="sc-title">
        <h2 id="sc-title" className="modal-title">Share card</h2>
        <div className="kind-switch" role="tablist" aria-label="Which list">
          {Object.values(KINDS).map((k) => (
            <button key={k.key} role="tab" aria-selected={kind === k.key} className={kind === k.key ? 'on' : ''} onClick={() => setKind(k.key)}>{k.name}</button>
          ))}
        </div>
        <div className="sc-stage">
          <canvas ref={canvas} className={state === 'ready' ? 'is-ready' : ''} aria-label="Preview of your share card" />
          {state === 'loading' && <p className="sc-msg muted">Drawing your card…</p>}
          {state === 'empty' && <p className="sc-msg muted">Nothing to show yet. Pick favourites on your profile or rate a few {KINDS[kind].name.toLowerCase()} titles first.</p>}
          {state === 'error' && <p className="sc-msg error-text">Could not draw the card. Try again.</p>}
        </div>
        {!user.is_public && <p className="muted sc-note">Your profile is private, so the card leaves out a link. Turn on the public profile in Settings to add one.</p>}
        <div className="modal-actions">
          <button className="btn btn-signal" onClick={download} disabled={state !== 'ready'}>Download PNG</button>
          {canShare && <button className="btn btn-line" onClick={share} disabled={state !== 'ready'}>Share</button>}
          <button className="btn btn-quiet" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
