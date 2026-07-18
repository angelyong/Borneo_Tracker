export function staticSourceFromRecord(record) {
  return {
    title: record.title,
    type: 'static',
    url: record.pageUrl || record.sourceUrl || '',
  };
}

export function dynamicSourceFromRow(row) {
  return {
    title: row?.source || 'Borneo Tracker dashboard data',
    type: 'dynamic',
    year: row?.year || null,
    region: row?.territory || null,
    updatedAt: row?.last_updated || null,
  };
}

export function uniqueSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = `${source.type}:${source.title}:${source.url || ''}:${source.year || ''}:${source.region || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
