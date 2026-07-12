// Shared export helpers for the ESG and SDG pages (Phase 1 of the reporting
// feature — quick CSV/PNG export of whatever's currently on screen). Phase 2
// (a dedicated multi-section "Generate Report" PDF page) will build on top of
// the same CSV row shape, not replace it.

function escapeCsvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function triggerDownload(href, filename) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Indicator rows -> a CSV matching the canonical-indicator-table shape (indicator, value, year, source, confidence). */
export function downloadIndicatorsCsv(filename, rows) {
  const headers = ['Indicator', 'Territory', 'Value', 'Unit', 'Year', 'Source', 'Confidence'];
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      [row.indicator, row.territory, row.value, row.unit, row.year, row.source, row.confidence]
        .map(escapeCsvCell)
        .join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

// Elements marked with this attribute (e.g. the Export button itself) are
// left out of the captured image.
const EXPORT_IGNORE_ATTR = 'data-export-ignore';

/** Snapshots a DOM element to a downloaded PNG. Loaded on demand — most page loads never export. */
export async function downloadElementAsPng(element, filename) {
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    filter: (node) => node.getAttribute?.(EXPORT_IGNORE_ATTR) !== 'true',
  });
  triggerDownload(dataUrl, filename);
}
