import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, imgSrc } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useList } from '../context/ListContext.jsx';
import { useMangaList } from '../context/MangaListContext.jsx';
import CountUp from '../components/CountUp.jsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function longestStreak(events) {
  const days = [...new Set(events.map((e) => dayKey(new Date(e.ts))))].map((k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m, d).getTime(); }).sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  for (const t of days) {
    run = prev !== null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

async function drawCard(canvas, d) {
  await Promise.race([Promise.all(['900 80px Archivo', '600 80px Fraunces', '500 22px "JetBrains Mono"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,75,31,0.15)';
  for (let y = 18; y < H; y += 30) for (let x = 18; x < W; x += 30) { c.beginPath(); c.arc(x, y, 1.7, 0, 7); c.fill(); }
  c.fillStyle = '#ff4b1f'; c.fillRect(60, 56, 22, 22);
  c.fillStyle = '#f4f1ea'; c.font = '800 26px Archivo, sans-serif';
  if ('letterSpacing' in c) c.letterSpacing = '4px';
  c.fillText('ANITRACK', 96, 76);
  c.fillStyle = '#ff4b1f'; c.font = '500 24px "JetBrains Mono", monospace';
  c.fillText(`${d.username.toUpperCase()} · ${d.year}`, 60, 160);
  if ('letterSpacing' in c) c.letterSpacing = '0px';
  c.fillStyle = '#f4f1ea'; c.font = '600 120px Fraunces, Georgia, serif';
  c.fillText('Wrapped', 60, 290);

  const big = [[String(d.logged), d.unit], [String(d.hours), 'hours, roughly'], [String(d.streak), 'day best streak']];
  big.forEach(([n, l], i) => {
    const x = 60 + i * 340;
    c.fillStyle = i === 0 ? '#ff4b1f' : '#f4f1ea'; c.font = '900 110px Archivo, sans-serif'; c.fillText(n, x, 460);
    c.fillStyle = '#9b968b'; c.font = '500 22px "JetBrains Mono", monospace'; c.fillText(l, x, 500);
  });
  c.fillStyle = '#f4f1ea'; c.fillRect(60, 540, 960, 2);

  c.fillStyle = '#9b968b'; c.font = '500 22px "JetBrains Mono", monospace';
  c.fillText('TOP GENRES', 60, 600);
  c.fillStyle = '#f4f1ea'; c.font = '700 44px Archivo, sans-serif';
  d.genres.slice(0, 3).forEach((g, i) => c.fillText(`${i + 1}. ${g}`, 60, 660 + i * 62));
  if (d.month) {
    c.fillStyle = '#9b968b'; c.font = '500 22px "JetBrains Mono", monospace'; c.fillText('BUSIEST MONTH', 600, 600);
    c.fillStyle = '#f4f1ea'; c.font = '600 56px Fraunces, Georgia, serif'; c.fillText(d.month, 600, 668);
  }

  c.fillStyle = '#9b968b'; c.font = '500 22px "JetBrains Mono", monospace'; c.fillText('HIGHEST RATED', 60, 880);
  const imgs = await Promise.all(d.top.slice(0, 4).map((t) => loadImg(imgSrc(t.image_url))));
  d.top.slice(0, 4).forEach((t, i) => {
    const x = 60 + i * 240, y = 910, w = 216, h = 310;
    c.fillStyle = '#1c1c1c'; c.fillRect(x, y, w, h);
    if (imgs[i]) {
      const s = Math.max(w / imgs[i].naturalWidth, h / imgs[i].naturalHeight), sw = w / s, sh = h / s;
      c.drawImage(imgs[i], (imgs[i].naturalWidth - sw) / 2, (imgs[i].naturalHeight - sh) / 2, sw, sh, x, y, w, h);
    }
    c.fillStyle = '#ff4b1f'; c.fillRect(x, y, 70, 38);
    c.fillStyle = '#0a0a0a'; c.font = '800 24px Archivo, sans-serif'; c.fillText(`★ ${t.score}`, x + 8, y + 27);
  });
  c.fillStyle = '#9b968b'; c.font = '500 20px "JetBrains Mono", monospace'; c.fillText('made with AniTrack', 60, 1300);
}

export default function Wrapped() {
  const { user } = useAuth();
  const [kind, setKind] = useState('anime');
  const anime = useList();
  const manga = useMangaList();
  const [events, setEvents] = useState(null);
  const canvas = useRef(null);
  const year = new Date().getFullYear();
  const cfg = kind === 'manga' ? { progress: 'chapters_read', unit: 'chapters read', mins: 6 } : { progress: 'episodes_watched', unit: 'episodes watched', mins: 24 };
  const entries = kind === 'manga' ? manga.entries : anime.entries;

  useEffect(() => { api.activity().then((r) => setEvents(r.events || [])).catch(() => setEvents([])); }, []);

  const data = useMemo(() => {
    if (!events) return null;
    const yr = events.filter((e) => e.kind === kind && new Date(e.ts).getFullYear() === year);
    const fromLog = yr.reduce((s, e) => s + e.delta, 0);
    const total = entries.reduce((s, e) => s + (e[cfg.progress] || 0), 0);
    const logged = fromLog || total; // the log only starts when this version went live; before that, use everything on the list
    const byMonth = Array(12).fill(0);
    yr.forEach((e) => { byMonth[new Date(e.ts).getMonth()] += e.delta; });
    const bestMonth = Math.max(...byMonth);
    const genreCount = {};
    entries.filter((e) => (e[cfg.progress] || 0) > 0).forEach((e) => (e.genres || []).forEach((g) => { genreCount[g] = (genreCount[g] || 0) + (e[cfg.progress] || 1); }));
    const genres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).map(([g]) => g);
    const top = entries.filter((e) => e.score != null).sort((a, b) => b.score - a.score).slice(0, 4).map((e) => ({ title: e.title, image_url: e.image_url, score: e.score }));
    const completed = entries.filter((e) => e.status === 'completed').length;
    return {
      username: user.username, year, logged, unit: cfg.unit, completed,
      hours: Math.round((logged * cfg.mins) / 60),
      streak: longestStreak(events),
      month: bestMonth > 0 ? MONTHS[byMonth.indexOf(bestMonth)] : null,
      genres, top, fromLog: fromLog > 0
    };
  }, [events, entries, kind, year, user, cfg.progress, cfg.unit, cfg.mins]);

  useEffect(() => { if (data && canvas.current) drawCard(canvas.current, data); }, [data]);

  function download() {
    canvas.current?.toBlob((b) => {
      if (!b) return;
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: `anitrack-wrapped-${year}-${kind}.png` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  return (
    <div className="wrap page-pad wr">
      <div className="page-title">
        <p className="kicker">{year} so far</p>
        <h1 className="h1">Wrapped</h1>
        <div className="kind-switch" role="tablist" aria-label="Anime or manga">
          {['anime', 'manga'].map((k) => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k === 'anime' ? 'Anime' : 'Manga'}</button>)}
        </div>
      </div>
      {!data ? <p className="muted">Counting…</p> : entries.length === 0 ? (
        <div className="empty-state"><p className="es-title">Nothing to wrap yet</p><p>Add titles and log some progress first.</p><Link className="btn btn-signal" to="/search">Find something to add</Link></div>
      ) : (
        <div className="wr-grid">
          <div>
            <div className="stats-strip">
              <div className="stat"><strong><CountUp value={data.logged} /></strong><span>{data.unit}</span></div>
              <div className="stat"><strong><CountUp value={data.hours} /></strong><span>Hours, roughly</span></div>
              <div className="stat"><strong><CountUp value={data.completed} /></strong><span>Completed</span></div>
            </div>
            <ul className="wr-facts">
              {data.genres.length > 0 && <li><span>Top genres</span><b>{data.genres.slice(0, 3).join(', ')}</b></li>}
              {data.month && <li><span>Busiest month</span><b>{data.month}</b></li>}
              <li><span>Longest streak</span><b>{data.streak} day{data.streak === 1 ? '' : 's'}</b></li>
              {data.top[0] && <li><span>Highest rated</span><b>{data.top[0].title} ({data.top[0].score})</b></li>}
            </ul>
            {!data.fromLog && <p className="muted">Month and streak fill in as you log progress from now on. Hours assume about {cfg.mins} minutes per {kind === 'manga' ? 'chapter' : 'episode'}.</p>}
          </div>
          <div className="wr-card">
            <canvas ref={canvas} aria-label="Your Wrapped card" />
            <button type="button" className="btn btn-signal" onClick={download}>Download card</button>
          </div>
        </div>
      )}
    </div>
  );
}
