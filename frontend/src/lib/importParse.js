// Turns an uploaded file (JSON, CSV, Excel or Word) into plain rows, one list of rows per section.
// Nothing here talks to the server. Matching titles to catalogue IDs happens afterwards, in ImportDialog.

import { KINDS } from '../constants.js';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

// ----- helpers -----------------------------------------------------------------------------

const squash = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// "Watching", "plan_to_read", "On-Hold", "PTW"... to a neutral token ('active', 'completed', 'on_hold', 'dropped', 'plan'),
// or null when unrecognised. Anime and manga use different status keys, so the token is turned into
// the right key later, once we know which list the row belongs to (see statusKey).
export function normStatus(text) {
  const t = squash(text);
  if (!t) return null;
  if (/^(watching|reading|current|currently watching|currently reading|in progress)$/.test(t)) return 'active';
  if (/^(completed?|finished|done|watched|read)$/.test(t)) return 'completed';
  if (/^(on hold|hold|paused)$/.test(t)) return 'on_hold';
  if (/^(dropped|abandoned|quit)$/.test(t)) return 'dropped';
  if (/^(plan|plan to watch|plan to read|planning|planned|to watch|to read|backlog|watchlist|want to watch|want to read|ptw|ptr)$/.test(t)) return 'plan';
  return null;
}

export function statusKey(token, kind) {
  const cfg = KINDS[kind];
  if (token === 'active') return cfg.activeStatus;
  if (token === 'plan') return cfg.defaultStatus;
  return token || null;
}

// "8", "8.5", "8/10", "★ 9", 85 (out of 100) to a 0.5-step score between 0.5 and 10, or null
export function normScore(v) {
  if (v === null || v === undefined || v === '') return null;
  const m = String(v).replace(',', '.').match(/\d+(\.\d+)?/);
  if (!m) return null;
  let n = Number(m[0]);
  if (n > 10 && n <= 100) n /= 10;
  if (!Number.isFinite(n) || n <= 0 || n > 10) return null;
  return Math.max(0.5, Math.round(n * 2) / 2);
}

function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function parseRatings(v) {
  if (v && typeof v === 'object') return v;
  const out = {};
  for (const part of String(v ?? '').split(/[;,]/)) {
    const m = part.trim().match(/^([a-z]+)\s*[=:]\s*(\d+(?:\.\d+)?)$/i);
    if (m) {
      const n = normScore(m[2]);
      if (n) out[m[1].toLowerCase()] = n;
    }
  }
  return Object.keys(out).length ? out : null;
}

const splitGenres = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/[;,]/)).map((g) => String(g).trim()).filter(Boolean).slice(0, 12);

// ----- spreadsheet-style tables (CSV, Excel sheets, Word tables) ---------------------------

const HEADERS = {
  title: ['title', 'name', 'anime', 'anime title', 'manga', 'manga title', 'manga novel', 'manga light novel', 'series', 'series title', 'series name'],
  mal_id: ['mal id', 'mal_id', 'malid', 'id', 'mal', 'myanimelist id', 'series animedb id', 'series mangadb id'],
  status: ['status', 'my status', 'state', 'list'],
  score: ['score', 'rating', 'my score', 'your score', 'my rating'],
  progress: ['progress', 'episodes watched', 'chapters read', 'eps watched', 'watched', 'read', 'my watched episodes', 'my read chapters', 'episodes', 'chapters', 'eps'],
  total: ['total', 'total episodes', 'total chapters', 'total eps', 'series episodes', 'series chapters'],
  review: ['notes', 'note', 'review', 'comments', 'comment', 'my comments', 'my notes'],
  genres: ['genres', 'genre'],
  ratings: ['detailed ratings', 'detailed rating', 'ratings', 'category ratings']
};

function findHeader(matrix) {
  for (let r = 0; r < Math.min(matrix.length, 6); r += 1) {
    const cols = {};
    matrix[r].forEach((cell, c) => {
      const h = squash(cell);
      for (const [field, names] of Object.entries(HEADERS)) {
        if (names.includes(h)) (cols[field] ||= []).push(c);
      }
    });
    if (cols.title !== undefined) return { row: r, cols };
  }
  return null;
}

function rowsFromMatrix(matrix, { allowHeaderless }) {
  const rows = matrix.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (!rows.length) return [];
  const head = findHeader(rows);
  if (!head && !allowHeaderless) return [];
  const cols = head ? head.cols : { title: [0] };
  const body = head ? rows.slice(head.row + 1) : rows;
  const get = (r, f) => {
    const idx = Array.isArray(cols[f]) ? cols[f] : cols[f] === undefined ? [] : [cols[f]];
    for (const c of idx) if (String(r[c] ?? '').trim() !== '') return r[c];
    return undefined;
  };

  return body
    .map((r) => ({
      title: String(get(r, 'title') ?? '').trim(),
      mal_id: toInt(get(r, 'mal_id')) || null,
      status: normStatus(get(r, 'status')),
      score: normScore(get(r, 'score')),
      progress: toInt(get(r, 'progress')),
      total: toInt(get(r, 'total')),
      review: String(get(r, 'review') ?? '').trim() || null,
      genres: splitGenres(get(r, 'genres')),
      ratings: parseRatings(get(r, 'ratings'))
    }))
    .filter((r) => r.title);
}

// ----- CSV ------------------------------------------------------------------------------------

function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const comma = (src.split('\n')[0].match(/,/g) || []).length;
  const semi = (src.split('\n')[0].match(/;/g) || []).length;
  const sep = semi > comma ? ';' : ',';
  const out = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      out.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out;
}

// ----- Excel ----------------------------------------------------------------------------------

function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return cellValue(v.result);
    if ('text' in v) return cellValue(v.text);
    if ('hyperlink' in v) return String(v.hyperlink);
    return '';
  }
  return v;
}

const kindFromName = (name) => (/manga/i.test(name) ? 'manga' : /anime/i.test(name) ? 'anime' : null);

async function parseXlsx(buffer) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sections = [];
  wb.worksheets.forEach((ws, i) => {
    const kind = kindFromName(ws.name);
    const matrix = [];
    ws.eachRow({ includeEmpty: false }, (row) => matrix.push(row.values.slice(1).map(cellValue)));
    // a sheet without a header row is only trusted when it is the only one in the workbook
    const rows = rowsFromMatrix(matrix, { allowHeaderless: wb.worksheets.length === 1 && i === 0 });
    if (rows.length) sections.push({ kind, rows });
  });
  return sections;
}

// ----- Word -----------------------------------------------------------------------------------

// "Title - 8/10", "Title -9.1", "Title– 7", "Title (9/10)", "Title ★9", with or without list numbering ("12." / "12)" / "148 ").
// A bare number only counts as a score when a dash or colon sits right before it, so "Mob Psycho 100" stays a title.
function splitLine(raw) {
  let line = raw.replace(/^\s*(?:\d+\s*[.)]|[-*•▪◦])\s*/, '').replace(/^\d{3}\s+(?=\D)/, '').trim();
  let score = null;
  const m =
    line.match(/^(.*?)\s*[-–—|:(]*\s*(\d{1,2}(?:[.,]\d+)?)\s*\/\s*10\s*\)?\s*$/) ||
    line.match(/^(.*?)\s*★\s*(\d{1,2}(?:[.,]\d+)?)\s*$/) ||
    line.match(/^(.*?\S)\s*[-–—:]\s*(\d{1,2}(?:[.,]\d+)?)\.?\s*$/);
  if (m && m[1].trim()) {
    const n = normScore(m[2]);
    if (n && Number(m[2].replace(',', '.')) <= 10) {
      score = n;
      line = m[1].trim();
    }
  }
  return { title: line.replace(/[\s\-–—|:(]+$/, '').trim(), score };
}

async function parseDocx(buffer) {
  const { default: mammoth } = await import('mammoth/mammoth.browser.js');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer }, { styleMap: ["p[style-name='Title'] => h1:fresh", "p[style-name='Subtitle'] => h2:fresh"] });
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const sections = [];
  let kind = null;
  let status = null;
  let rows = [];
  const flush = () => { if (rows.length) sections.push({ kind, rows }); rows = []; };

  const addLine = (text, isHeading = false) => {
    const t = text.trim();
    if (!t) return;
    // A heading that mentions exactly one of "anime"/"manga" starts that section ("My Anime List", "Manga I've read")
    if (isHeading) {
      const hasA = /\banime\b/i.test(t), hasM = /\bmanga\b/i.test(t);
      if (hasA !== hasM) { flush(); kind = hasA ? 'anime' : 'manga'; status = null; return; }
    }
    const word = squash(t);
    // A short line like "Anime", "Manga list", "Completed" or "Plan to watch:" acts as a heading for what follows
    if (t.length <= 30) {
      const k = /^(anime|manga)( list)?$/.exec(word);
      if (k) { flush(); kind = k[1]; status = null; return; }
      const s = normStatus(word);
      if (s && !/^(watched|read|done|finished)$/.test(word)) { status = s; return; }
    }
    if (isHeading) return; // headings label sections; they are never titles
    const { title, score } = splitLine(t);
    if (title) rows.push({ title, mal_id: null, status, score, progress: null, total: null, review: null, genres: [], ratings: null });
  };

  for (const el of doc.body.children) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'table') {
      const matrix = [...el.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => c.textContent.trim()));
      const found = rowsFromMatrix(matrix, { allowHeaderless: true });
      flush();
      if (found.length) sections.push({ kind, rows: found });
    } else if (tag === 'ul' || tag === 'ol') {
      el.querySelectorAll('li').forEach((li) => addLine(li.textContent));
    } else {
      addLine(el.textContent, /^h[1-6]$/.test(tag));
    }
  }
  flush();
  return sections;
}

// ----- JSON (AniTrack's own export, or a bare array) ---------------------------------------------

function parseJson(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data?.entries;
  if (!Array.isArray(list)) throw new Error('No entries found in that file');
  const rows = list
    .filter((e) => e && typeof e.title === 'string' && e.title.trim())
    .map((e) => ({
      title: e.title.trim(),
      mal_id: toInt(e.mal_id) || null,
      status: normStatus(e.status),
      score: normScore(e.score),
      progress: toInt(e.episodes_watched ?? e.chapters_read ?? e.progress),
      total: toInt(e.total_episodes ?? e.total_chapters ?? e.total),
      review: typeof e.review === 'string' && e.review.trim() ? e.review : null,
      genres: splitGenres(e.genres),
      ratings: e.ratings && typeof e.ratings === 'object' ? e.ratings : null,
      image_url: typeof e.image_url === 'string' ? e.image_url : null
    }));
  return [{ kind: data?.kind === 'manga' || data?.kind === 'anime' ? data.kind : null, rows }];
}

// ----- entry point ------------------------------------------------------------------------------

export async function parseFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('That file is over 5 MB. Split it into smaller files.');
  const name = file.name.toLowerCase();
  let sections;
  if (name.endsWith('.json')) sections = parseJson(await file.text());
  else if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const text = await file.text();
    sections = [{ kind: null, rows: rowsFromMatrix(parseCsv(text), { allowHeaderless: true }) }];
  } else if (name.endsWith('.xlsx')) sections = await parseXlsx(await file.arrayBuffer());
  else if (name.endsWith('.docx')) sections = await parseDocx(await file.arrayBuffer());
  else if (name.endsWith('.xls') || name.endsWith('.doc')) {
    throw new Error('Old .xls and .doc files are not supported. In Excel or Word, choose Save As and pick .xlsx or .docx.');
  } else throw new Error('Unsupported file type. Use .xlsx, .docx, .csv or .json.');

  sections = sections.filter((s) => s.rows.length);
  if (!sections.length) throw new Error('No titles found in that file. Put one title per row, with a "Title" column if you use a table.');
  return sections;
}
