// Phase 2 of the reporting feature: renders a set of DOM sections into a
// paginated PDF. Each section starts on its own page; a section taller than
// one page is sliced across as many pages as it needs. This reuses the same
// html-to-image snapshot approach Phase 1's PNG export already relies on
// (src/utils/exportReport.js) rather than hand-drawing text/tables in jsPDF.

const PAGE_MARGIN_PT = 28;

export async function generatePdfFromSections(sectionElements, filename) {
  const [{ jsPDF }, { toCanvas }] = await Promise.all([import('jspdf'), import('html-to-image')]);

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - PAGE_MARGIN_PT * 2;
  const usableHeight = pageHeight - PAGE_MARGIN_PT * 2;

  let isFirstPage = true;

  for (const element of sectionElements) {
    if (!element) continue;

    // pixelRatio 1.5 + JPEG keeps the text crisp enough to read while keeping
    // a multi-section report small enough to actually email — PNG at 2x
    // produced ~28MB for a 7-page report, unusable for a compliance filing.
    const canvas = await toCanvas(element, { pixelRatio: 1.5, backgroundColor: '#ffffff' });
    const ptPerSourcePx = usableWidth / canvas.width;
    const sliceHeightPx = Math.floor(usableHeight / ptPerSourcePx);

    let renderedPx = 0;
    while (renderedPx < canvas.height) {
      const chunkHeightPx = Math.min(sliceHeightPx, canvas.height - renderedPx);
      const chunkDataUrl = sliceCanvas(canvas, renderedPx, chunkHeightPx);

      if (!isFirstPage) pdf.addPage();
      isFirstPage = false;

      pdf.addImage(
        chunkDataUrl,
        'JPEG',
        PAGE_MARGIN_PT,
        PAGE_MARGIN_PT,
        usableWidth,
        chunkHeightPx * ptPerSourcePx,
        undefined,
        'MEDIUM'
      );

      renderedPx += chunkHeightPx;
    }
  }

  pdf.save(filename);
}

function sliceCanvas(sourceCanvas, sourceY, sliceHeight) {
  const slice = document.createElement('canvas');
  slice.width = sourceCanvas.width;
  slice.height = sliceHeight;
  slice
    .getContext('2d')
    .drawImage(sourceCanvas, 0, sourceY, sourceCanvas.width, sliceHeight, 0, 0, sourceCanvas.width, sliceHeight);
  return slice.toDataURL('image/jpeg', 0.9);
}
