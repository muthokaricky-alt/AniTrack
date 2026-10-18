import { KINDS, STATUS_LABEL } from '../constants.js';

// One workbook, one sheet per list. The columns match what the importer understands,
// so the file can be edited in Excel and imported straight back.
export async function buildWorkbook({ anime, manga }) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AniTrack';
  wb.created = new Date();

  for (const [kind, entries] of [['anime', anime], ['manga', manga]]) {
    const cfg = KINDS[kind];
    const ws = wb.addWorksheet(cfg.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Title', key: 'title', width: 44 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Score', key: 'score', width: 9, style: { numFmt: '0.0' } },
      { header: cfg.progressLabel, key: 'progress', width: 18 },
      { header: `Total ${cfg.unit.toLowerCase()}`, key: 'total', width: 16 },
      { header: 'Genres', key: 'genres', width: 30 },
      { header: 'Detailed ratings', key: 'ratings', width: 34 },
      { header: 'Notes', key: 'notes', width: 50, style: { alignment: { wrapText: true, vertical: 'top' } } },
      { header: 'MAL ID', key: 'mal_id', width: 10 }
    ];
    for (const e of entries) {
      ws.addRow({
        title: e.title,
        status: STATUS_LABEL[e.status] || e.status,
        score: e.score ?? null,
        progress: e[cfg.progress] ?? 0,
        total: e[cfg.total] ?? null,
        genres: (e.genres || []).join('; '),
        ratings: Object.entries(e.ratings || {}).map(([k, v]) => `${k}=${v}`).join('; '),
        notes: e.review || '',
        mal_id: e.mal_id
      });
    }
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFF4F1EA' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15130F' } };
    head.alignment = { vertical: 'middle' };
    head.height = 22;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

    // A dropdown on Status so edits in Excel stay importable
    const options = cfg.statuses.map((s) => s.label).join(',');
    for (let r = 2; r <= Math.max(entries.length + 1, 2); r += 1) {
      ws.getCell(r, 2).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${options}"`] };
    }
  }
  return wb;
}

export async function exportXlsxBuffer(lists) {
  const wb = await buildWorkbook(lists);
  return wb.xlsx.writeBuffer();
}
