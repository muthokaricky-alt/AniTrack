import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { KINDS, STATUS_LABEL } from '../constants.js';
import { statusKey } from '../lib/importParse.js';
import { useList } from '../context/ListContext.jsx';
import { useMangaList } from '../context/MangaListContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const CHUNK = 16; // titles per catalogue request (the server accepts at most 25 and splits them further)
const MAX_LOOKUPS = 250; // keeps one import from hammering the catalogue API
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Group the parsed sections by list, drop repeated titles within the file
function groupSections(sections, defaultKind) {
  const groups = {};
  for (const { kind, rows } of sections) {
    const k = kind || defaultKind;
    const seen = (groups[k] ||= { kind: k, rows: [], keys: new Set() });
    for (const row of rows) {
      const key = row.mal_id ? `id:${row.mal_id}` : `t:${norm(row.title)}`;
      if (seen.keys.has(key)) continue;
      seen.keys.add(key);
      seen.rows.push(row);
    }
  }
  return Object.values(groups).map(({ kind, rows }) => ({ kind, rows }));
}

export default function ImportDialog({ sections, defaultKind, onClose }) {
  const toast = useToast();
  const lists = { anime: useList(), manga: useMangaList() };
  const [phase, setPhase] = useState('matching'); // matching | review | importing
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');
  const primary = useRef(null);
  const listsRef = useRef(lists);
  listsRef.current = lists;

  // Find a catalogue ID for every row: an ID already in the file, a title already on the list, or a catalogue lookup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = groupSections(sections, defaultKind);
      const toLookUp = [];
      const built = raw.map(({ kind, rows }) => {
        const entries = listsRef.current[kind].entries;
        const byId = new Map(entries.map((e) => [e.mal_id, e]));
        const byTitle = new Map(entries.map((e) => [norm(e.title), e]));
        const items = rows.map((row) => {
          const item = { row, kind, match: null, existing: null };
          if (row.mal_id) {
            item.existing = byId.get(row.mal_id) || null;
            item.match = { mal_id: row.mal_id, title: row.title, image_url: row.image_url || null };
          } else {
            const hit = byTitle.get(norm(row.title));
            if (hit) {
              item.existing = hit;
              item.match = { mal_id: hit.mal_id, title: hit.title, image_url: hit.image_url };
            } else toLookUp.push(item);
          }
          return item;
        });
        return { kind, items };
      });

      if (toLookUp.length > MAX_LOOKUPS) {
        setError(`${toLookUp.length} titles need matching and the limit is ${MAX_LOOKUPS} at a time. Split the file into smaller parts, or add a "MAL ID" column.`);
        setPhase('review');
        return;
      }
      setProgress({ done: 0, total: toLookUp.length });
      try {
        for (const kind of Object.keys(KINDS)) {
          const todo = toLookUp.filter((i) => i.kind === kind);
          for (let i = 0; i < todo.length; i += CHUNK) {
            const part = todo.slice(i, i + CHUNK);
            const { matches } = await api.list(kind).resolve(part.map((p) => p.row.title));
            if (cancelled) return;
            part.forEach((p, n) => {
              const m = matches[n];
              if (m?.failed) { p.failed = true; return; }
              if (!m) return;
              p.match = m;
              p.existing = listsRef.current[kind].entries.find((e) => e.mal_id === m.mal_id) || null;
            });
            setProgress((p) => ({ ...p, done: p.done + part.length }));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setPhase('review');
        }
        return;
      }
      if (cancelled) return;
      // two different titles can resolve to the same show; keep the first
      const final = built.map(({ kind, items }) => {
        const ids = new Set();
        return { kind, items: items.filter((it) => { if (!it.match) return true; if (ids.has(it.match.mal_id)) return false; ids.add(it.match.mal_id); return true; }) };
      });
      setGroups(final);
      setPhase('review');
    })();
    return () => { cancelled = true; };
  }, [sections, defaultKind]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && phase !== 'importing' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  useEffect(() => { if (phase === 'review') primary.current?.focus(); }, [phase]);

  const counts = useMemo(() => {
    let found = 0, missing = 0, updates = 0, failed = 0;
    for (const g of groups) for (const it of g.items) {
      if (it.match) { found += 1; if (it.existing) updates += 1; } else { missing += 1; if (it.failed) failed += 1; }
    }
    return { found, missing, updates, failed };
  }, [groups]);

  // Status: what the file says, else what is already on the list, else "completed" when the row has a score
  // (people rarely score things they haven't watched), else the plan-to list.
  function statusFor(it) {
    const cfg = KINDS[it.kind];
    return statusKey(it.row.status, it.kind) || it.existing?.status || (it.row.score != null ? 'completed' : cfg.defaultStatus);
  }

  // Blanks in the file never wipe what is already on the list
  function toEntry(it) {
    const cfg = KINDS[it.kind];
    const { row, match, existing: e } = it;
    const status = statusFor(it);
    const total = row.total ?? match[cfg.total] ?? e?.[cfg.total] ?? null;
    let done = row.progress ?? e?.[cfg.progress] ?? 0;
    if (status === 'completed' && total && row.progress == null) done = total;
    const genres = row.genres?.length ? row.genres : match.genres?.length ? match.genres : e?.genres || [];
    return {
      mal_id: match.mal_id,
      title: match.title || row.title,
      image_url: row.image_url || match.image_url || e?.image_url || null,
      status,
      score: row.score ?? e?.score ?? null,
      [cfg.progress]: done,
      [cfg.total]: total,
      review: row.review ?? e?.review ?? null,
      genres,
      ...(row.ratings ? { ratings: row.ratings } : {})
    };
  }

  async function commit() {
    setPhase('importing');
    try {
      let imported = 0;
      for (const g of groups) {
        const entries = g.items.filter((it) => it.match).map(toEntry);
        if (!entries.length) continue;
        const res = await api.list(g.kind).import(entries);
        imported += res.imported;
        await lists[g.kind].reload();
      }
      toast(`Imported ${imported} title${imported === 1 ? '' : 's'}${counts.missing ? `. ${counts.missing} could not be matched.` : ''}`);
      onClose();
    } catch (err) {
      setError(err.message);
      setPhase('review');
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && phase !== 'importing' && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="imp-title">
        <h2 id="imp-title" className="modal-title">Import to your list</h2>

        {phase === 'matching' && (
          <div className="imp-wait">
            <p>Matching titles to the catalogue{progress.total ? `… ${progress.done} of ${progress.total}` : '…'}</p>
            <div className="progress" aria-hidden="true"><span style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '15%' }} /></div>
          </div>
        )}

        {phase === 'importing' && <p className="muted">Importing…</p>}

        {phase === 'review' && (
          <>
            {error && <p className="error-text">{error}</p>}
            {groups.map((g) => {
              const ok = g.items.filter((i) => i.match).length;
              return (
                <section key={g.kind} className="imp-group">
                  <h3 className="mini-h">{KINDS[g.kind].name} <span className="muted">· {ok} of {g.items.length} matched</span></h3>
                  <div className="imp-table" role="table" aria-label={`${KINDS[g.kind].name} titles`}>
                    <div className="imp-row imp-head" role="row"><span>In your file</span><span>Matched to</span><span>Status</span><span>Score</span></div>
                    {g.items.map((it, n) => (
                      <div className={`imp-row ${it.match ? '' : 'is-miss'}`} role="row" key={n}>
                        <span>{it.row.title}</span>
                        <span>{it.match ? it.match.title : it.failed ? 'Lookup failed' : 'No match found'}</span>
                        <span>{STATUS_LABEL[statusFor(it)]}</span>
                        <span>{it.row.score ?? (it.existing?.score ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
            {counts.failed > 0 && (
              <p className="error-text">The catalogue was too busy to check {counts.failed} title{counts.failed === 1 ? '' : 's'}. Import the rest now, then import the file again later to pick up the others.</p>
            )}
            {groups.length > 0 && (
              <p className="muted imp-note">
                {counts.updates > 0 ? `${counts.updates} of these are already on your list and will be updated with the values in the file. Empty cells in the file leave existing values alone. ` : ''}
                Check the “Matched to” column: titles are matched by name, so look out for the wrong season or a similarly named show.
              </p>
            )}
          </>
        )}

        <div className="modal-actions">
          {phase === 'review' && counts.found > 0 && (
            <button ref={primary} className="btn btn-signal" onClick={commit}>Import {counts.found} title{counts.found === 1 ? '' : 's'}</button>
          )}
          {phase !== 'importing' && <button className="btn btn-line" onClick={onClose}>{phase === 'review' && counts.found > 0 ? 'Cancel' : 'Close'}</button>}
        </div>
      </div>
    </div>
  );
}
