import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useList } from '../context/ListContext.jsx';
import { useMangaList } from '../context/MangaListContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { KINDS, SCORE_OPTIONS } from '../constants.js';
import Insights from '../components/Insights.jsx';
import Roulette from '../components/Roulette.jsx';
import ImportDialog from '../components/ImportDialog.jsx';
import { parseFile } from '../lib/importParse.js';

function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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

  const tabs = useMemo(() => [{ key: 'all', label: 'All' }, ...cfg.statuses], [cfg]);
  const visible = useMemo(() => (tab === 'all' ? entries : entries.filter((e) => e.status === tab)), [entries, tab]);
  const pool = useMemo(() => entries.filter((e) => e.status === cfg.defaultStatus), [entries, cfg]);

  function switchKind(next) {
    setKind(next);
    setTab('all');
    setRowError('');
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
    if (loading && entries.length === 0) return <p className="muted">Loading your list…</p>;
    if (error && entries.length === 0) {
      return (
        <div className="empty-state">
          <p>{error}</p>
          <button className="btn btn-line" onClick={reload}>Try again</button>
        </div>
      );
    }
    return (
      <>
        <div className="stats-strip">
          <div className="stat"><strong>{stats.total}</strong><span>Titles</span></div>
          <div className="stat"><strong>{stats.progress}</strong><span>{cfg.unit}</span></div>
          <div className="stat"><strong>{stats.mean ?? '—'}</strong><span>Mean score</span></div>
        </div>

        <div className="list-tools">
          <Roulette pool={pool} kind={kind} onStart={(entry) => save(entry.id, { status: cfg.activeStatus })} />
          <span className="tools-gap" />
          <button className="btn btn-quiet btn-sm" onClick={exportJson} disabled={entries.length === 0}>Export JSON</button>
          <button className="btn btn-quiet btn-sm" onClick={exportCsv} disabled={entries.length === 0}>Export CSV</button>
          <button className="btn btn-quiet btn-sm" onClick={exportExcel} disabled={busy || (animeList.entries.length === 0 && mangaList.entries.length === 0)} title="Both lists, one sheet each">Export Excel</button>
          <button className="btn btn-quiet btn-sm" onClick={() => fileInput.current?.click()} disabled={busy} title="Excel, Word, CSV or JSON">Import</button>
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

        {rowError && <p className="error-text">{rowError}</p>}

        {visible.length === 0 && (
          <div className="empty-state">
            Nothing here yet. <Link to={kind === 'manga' ? '/manga' : '/search'}>Find something to add</Link>.
          </div>
        )}

        <div className="list-rows">
          {visible.map((entry) => {
            const total = entry[cfg.total];
            const done = entry[cfg.progress] ?? 0;
            const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
            return (
              <div className="list-row" key={entry.id}>
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
