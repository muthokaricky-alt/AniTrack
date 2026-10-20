import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useList } from '../context/ListContext.jsx';
import { useMangaList } from '../context/MangaListContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { KINDS, SCORE_OPTIONS } from '../constants.js';
import Insights from '../components/Insights.jsx';
import Roulette from '../components/Roulette.jsx';
import ImportDialog from '../components/ImportDialog.jsx';
import AiringWeek from '../components/AiringWeek.jsx';
import CountUp from '../components/CountUp.jsx';
import ListSkeleton from '../components/ListSkeleton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { parseFile } from '../lib/importParse.js';

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PREFS_KEY = 'anitrack:listprefs';
function loadPrefs() {
  try { return { view: 'list', sort: 'recent', ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { view: 'list', sort: 'recent' }; }
}
const SORTS = [
  { key: 'recent', label: 'Recently updated' },
  { key: 'title', label: 'Title A–Z' },
  { key: 'score', label: 'Highest score' },
  { key: 'progress', label: 'Most progress' },
  { key: 'added', label: 'Oldest first' }
];
const VIEWS = [{ key: 'list', label: 'List' }, { key: 'grid', label: 'Grid' }, { key: 'compact', label: 'Compact' }];

const csvCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;

export default function MyList() {
  const [kind, setKind] = useState('anime');
  const cfg = KINDS[kind];
  const animeList = useList();
  const mangaList = useMangaList();
  const { entries, stats, loading, error, reload, updateEntry, removeEntry } = kind === 'manga' ? mangaList : animeList;
  const toast = useToast();
  const fileInput = useRef(null);
  const [tab, setTab] = useState('all');
  const [rowError, setRowError] = useState('');
  const [importSections, setImportSections] = useState(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
  }, [prefs]);
  const setPref = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));

  const tabs = useMemo(() => [{ key: 'all', label: 'All' }, ...cfg.statuses], [cfg]);
  const genres = useMemo(() => [...new Set(entries.flatMap((e) => e.genres || []))].sort(), [entries]);
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pct = (e) => (e[cfg.total] ? (e[cfg.progress] ?? 0) / e[cfg.total] : 0);
    const out = entries.filter((e) =>
      (tab === 'all' || e.status === tab) &&
      (!term || e.title.toLowerCase().includes(term)) &&
      (!genre || (e.genres || []).includes(genre))
    );
    const by = {
      title: (a, b) => a.title.localeCompare(b.title),
      score: (a, b) => (b.score ?? -1) - (a.score ?? -1),
      progress: (a, b) => pct(b) - pct(a),
      added: (a, b) => a.id - b.id
    }[prefs.sort];
    return by ? [...out].sort(by) : out; // 'recent' keeps the server order
  }, [entries, tab, q, genre, prefs.sort, cfg]);
  const pool = useMemo(() => entries.filter((e) => e.status === cfg.defaultStatus), [entries, cfg]);

  function switchKind(next) {
    setKind(next);
    setTab('all');
    setRowError('');
    setQ('');
    setGenre('');
    exitSelect();
  }

  function exitSelect() { setSelecting(false); setPicked(new Set()); }
  function toggle(id) {
    setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  async function bulkStatus(status) {
    if (!status || picked.size === 0) return;
    setBusy(true);
    const targets = entries.filter((e) => picked.has(e.id));
    const res = await Promise.allSettled(targets.map((e) => {
      const patch = { status };
      if (status === 'completed' && e[cfg.total]) patch[cfg.progress] = e[cfg.total];
      return updateEntry(e.id, patch);
    }));
    const failed = res.filter((r) => r.status === 'rejected').length;
    toast(failed ? `Updated ${targets.length - failed}, ${failed} failed` : `Updated ${targets.length} titles`, failed ? 'error' : undefined);
    setBusy(false);
    exitSelect();
  }
  async function bulkRemove() {
    if (picked.size === 0 || !window.confirm(`Remove ${picked.size} title${picked.size === 1 ? '' : 's'} from your list?`)) return;
    setBusy(true);
    const targets = entries.filter((e) => picked.has(e.id));
    const res = await Promise.allSettled(targets.map((e) => removeEntry(e.id)));
    const failed = res.filter((r) => r.status === 'rejected').length;
    toast(failed ? `Removed ${targets.length - failed}, ${failed} failed` : `Removed ${targets.length} titles`, failed ? 'error' : undefined);
    setBusy(false);
    exitSelect();
  }

  async function save(id, patch) {
    setRowError('');
    try {
      await updateEntry(id, patch);
    } catch (e) {
      setRowError(e.message);
    }
  }

  function changeStatus(entry, status) {
    const patch = { status };
    if (status === 'completed' && entry[cfg.total]) patch[cfg.progress] = entry[cfg.total];
    save(entry.id, patch);
  }

  async function remove(entry) {
    if (!window.confirm(`Remove “${entry.title}” from your list?`)) return;
    try {
      await removeEntry(entry.id);
      toast('Removed from your list');
    } catch (e) {
      setRowError(e.message);
    }
  }

  function exportJson() {
    const body = { app: 'AniTrack', version: 1, kind, exported_at: new Date().toISOString(), entries };
    download(`anitrack-${kind}-list.json`, JSON.stringify(body, null, 2), 'application/json');
  }

  function exportCsv() {
    const head = ['title', 'mal_id', 'status', 'score', cfg.progress, cfg.total, 'genres', 'detailed_ratings', 'notes'];
    const rows = entries.map((e) =>
      [e.title, e.mal_id, e.status, e.score, e[cfg.progress], e[cfg.total], (e.genres || []).join('; '), Object.entries(e.ratings || {}).map(([k, v]) => `${k}=${v}`).join('; '), e.review].map(csvCell).join(',')
    );
    download(`anitrack-${kind}-list.csv`, [head.join(','), ...rows].join('\n'), 'text/csv');
  }

  // One workbook with an Anime sheet and a Manga sheet. Built in the browser from the lists already loaded.
  async function exportExcel() {
    setBusy(true);
    try {
      const { exportXlsxBuffer } = await import('../lib/exportXlsx.js');
      const buffer = await exportXlsxBuffer({ anime: animeList.entries, manga: mangaList.entries });
      download('anitrack-lists.xlsx', buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      toast('Could not build the Excel file. Try again.', 'error');
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      setImportSections(await parseFile(file));
    } catch (err) {
      toast(err instanceof SyntaxError ? 'That file is not valid JSON' : err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const body = () => {
    if (loading && entries.length === 0) return <ListSkeleton />;
    if (error && entries.length === 0) return <ErrorState message={error} onRetry={reload} />;
    return (
      <>
        <div className="stats-strip">
          <div className="stat"><strong><CountUp value={stats.total} /></strong><span>Titles</span></div>
          <div className="stat"><strong><CountUp value={stats.progress} /></strong><span>{cfg.unit}</span></div>
          <div className="stat"><strong><CountUp value={stats.mean} /></strong><span>Mean score</span></div>
        </div>

        {kind === 'anime' && <AiringWeek />}

        <div className="list-tools">
          <Roulette pool={pool} kind={kind} onStart={(entry) => save(entry.id, { status: cfg.activeStatus })} />
          <span className="tools-gap" />
          <button className="btn btn-line btn-sm" onClick={exportJson} disabled={entries.length === 0}>Export JSON</button>
          <button className="btn btn-line btn-sm" onClick={exportCsv} disabled={entries.length === 0}>Export CSV</button>
          <button className="btn btn-line btn-sm" onClick={exportExcel} disabled={busy || (animeList.entries.length === 0 && mangaList.entries.length === 0)} title="Both lists, one sheet each">Export Excel</button>
          <button className="btn btn-sm btn-import" onClick={() => fileInput.current?.click()} disabled={busy} title="Excel, Word, CSV or JSON">Import</button>
          <input ref={fileInput} type="file" accept=".xlsx,.docx,.csv,.json,.txt" onChange={importFile} hidden />
        </div>

        <div className="status-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              {t.label}
              <span className="count">{t.key === 'all' ? stats.total : stats.counts[t.key] || 0}</span>
            </button>
          ))}
        </div>

        <div className="list-filter">
          <input className="lf-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter this list" aria-label="Filter this list by title" />
          <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Filter by genre">
            <option value="">All genres</option>
            {genres.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={prefs.sort} onChange={(e) => setPref('sort', e.target.value)} aria-label="Sort by">
            {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <div className="view-switch" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" aria-pressed={prefs.view === v.key} className={prefs.view === v.key ? 'on' : ''} onClick={() => setPref('view', v.key)}>{v.label}</button>
            ))}
          </div>
          <button type="button" className={`btn btn-line btn-sm ${selecting ? 'is-on' : ''}`} onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
            {selecting ? 'Done' : 'Select'}
          </button>
        </div>
        <p className="muted lf-count" aria-live="polite">
          Showing {visible.length} of {entries.length}{(q || genre) && <> · <button type="button" className="lf-clear" onClick={() => { setQ(''); setGenre(''); }}>Clear filters</button></>}
        </p>

        {selecting && (
          <div className="bulk-bar" role="region" aria-label="Bulk actions">
            <strong>{picked.size} selected</strong>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPicked(new Set(visible.map((e) => e.id)))}>Select all {visible.length}</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPicked(new Set())} disabled={picked.size === 0}>Clear</button>
            <select value="" onChange={(e) => bulkStatus(e.target.value)} disabled={busy || picked.size === 0} aria-label="Move selected to status">
              <option value="">Move to…</option>
              {cfg.statuses.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
            </select>
            <button type="button" className="btn btn-sm btn-danger" onClick={bulkRemove} disabled={busy || picked.size === 0}>Remove</button>
          </div>
        )}

        {rowError && <p className="error-text">{rowError}</p>}

        {visible.length === 0 && (
          <div className="empty-state">
            {entries.length > 0 && (q || genre || tab !== 'all') ? 'No titles match these filters.' : <>Nothing here yet. <Link to={kind === 'manga' ? '/manga' : '/search'}>Find something to add</Link>.</>}
          </div>
        )}

        <div className={`list-rows view-${prefs.view}`}>
          {visible.map((entry) => {
            const total = entry[cfg.total];
            const done = entry[cfg.progress] ?? 0;
            const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
            return (
              <div className={`list-row ${picked.has(entry.id) ? 'is-picked' : ''}`} key={entry.id} onClick={selecting ? () => toggle(entry.id) : undefined}>
                {selecting && <input type="checkbox" className="lr-check" checked={picked.has(entry.id)} onChange={() => toggle(entry.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${entry.title}`} />}
                <Link to={`${cfg.path}/${entry.mal_id}`} className="list-cover">
                  {entry.image_url ? <img src={entry.image_url} alt="" loading="lazy" /> : <div className="img-fallback" />}
                </Link>
                <div className="list-main">
                  <Link to={`${cfg.path}/${entry.mal_id}`}><h3>{entry.title}</h3></Link>
                  <div className="progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
                  <div className="meta">
                    {done} {total ? `of ${total}` : ''} {cfg.unit.toLowerCase()}{total ? ` · ${pct}%` : ''}
                  </div>
                </div>
                <div className="list-controls">
                  <button
                    className="step-btn"
                    title={`One more ${cfg.unit.toLowerCase().slice(0, -1)}`}
                    aria-label={`Add one ${cfg.unit.toLowerCase().slice(0, -1)}`}
                    disabled={total ? done >= total : false}
                    onClick={() => save(entry.id, { [cfg.progress]: done + 1 })}
                  >+1</button>
                  <select value={entry.status} onChange={(e) => changeStatus(entry, e.target.value)} aria-label="Status">
                    {cfg.statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <select
                    value={entry.score ?? ''}
                    onChange={(e) => save(entry.id, { score: e.target.value === '' ? null : Number(e.target.value) })}
                    aria-label="Your score"
                  >
                    <option value="">Score</option>
                    {SCORE_OPTIONS.map((n) => <option key={n} value={n}>{n} ★</option>)}
                  </select>
                  <button className="btn btn-quiet btn-sm" onClick={() => remove(entry)}>Remove</button>
                </div>
              </div>
            );
          })}
        </div>

        <Insights entries={entries} kind={kind} />
      </>
    );
  };

  return (
    <div className="wrap page-pad">
      <div className="page-title">
        <p className="kicker">Your list</p>
        <h1 className="h1">My list</h1>
        <div className="kind-switch" role="tablist" aria-label="List type">
          {Object.values(KINDS).map((k) => (
            <button key={k.key} role="tab" aria-selected={kind === k.key} className={kind === k.key ? 'on' : ''} onClick={() => switchKind(k.key)}>
              {k.name}
            </button>
          ))}
        </div>
      </div>
      {body()}
      {importSections && <ImportDialog sections={importSections} defaultKind={kind} onClose={() => setImportSections(null)} />}
    </div>
  );
}
