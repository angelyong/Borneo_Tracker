function asRecordArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.items)) return payload.items;
  return null;
}

function joinFields(obj, keys) {
  return keys.map((key) => obj?.[key]).filter(Boolean).join(' ');
}

function recordsFromI18n(payload) {
  const records = [];
  const about = payload.about || {};
  const esg = payload.esg || {};
  const sdg = payload.sdg || {};
  const reports = payload.reports || {};
  const sidebar = payload.sidebar || {};

  records.push({
    id: 'about-borneo-tracker',
    title: 'Understanding Borneo Through Trusted Data',
    category: 'site-overview',
    content: joinFields(about, [
      'heroLede',
      'purposeBody',
      'monitorEnvironmentBody',
      'monitorSocialBody',
      'monitorSustainabilityBody',
      'transparentDataBody',
      'noticeBody',
    ]),
    pageUrl: '/about',
  });

  records.push({
    id: 'borneo-tracker-regions',
    title: about.scopeTerritoriesTitle || 'Borneo Tracker Regions',
    category: 'regions',
    content: about.scopeTerritoriesBody || '',
    pageUrl: '/regions',
  });

  records.push({
    id: 'esg-indicators-page',
    title: esg.title || sidebar.esgIndicators || 'ESG Indicators',
    category: 'esg-indicators',
    content: joinFields(esg, ['subtitle', 'categoryEnvironment', 'categorySocial', 'categoryGovernance']),
    pageUrl: '/esg',
  });

  records.push({
    id: 'sdg-progress-page',
    title: sdg.title || sidebar.sdgProgress || 'SDG Progress',
    category: 'sdg-progress',
    content: joinFields(sdg, ['subtitle', 'noCanonicalIndicatorsForRegion']),
    pageUrl: '/sdg',
  });

  records.push({
    id: 'generate-report-page',
    title: sidebar.generateReport || 'Generate Report',
    category: 'generate-report',
    content: joinFields(reports, [
      'subtitle',
      'selectTerritory',
      'includeSections',
      'sectionExecutiveSummary',
      'sectionSdgCoverage',
      'sectionCoverageLimitations',
      'sectionMethodologySources',
      'generateDownloadPdf',
    ]),
    pageUrl: '/reports',
  });

  records.push({
    id: 'website-navigation',
    title: 'Borneo Tracker Website Navigation',
    category: 'website-usage',
    content: [
      sidebar.dashboard,
      sidebar.regionalDetails,
      sidebar.esgIndicators,
      sidebar.sdgProgress,
      sidebar.newsInsights,
      sidebar.community,
      sidebar.generateReport,
      sidebar.dataSources,
      sidebar.aboutBorneoTracker,
    ].filter(Boolean).join(', '),
    pageUrl: '/about',
  });

  return records.map((record) => ({ ...record, sourceName: 'Borneo Tracker interface copy' }))
    .filter((record) => record.content);
}

export class JsonContentExtractor {
  extract(payload, source) {
    const directRecords = asRecordArray(payload);
    if (directRecords) return directRecords;
    if (source.path === 'src/i18n/locales/en.json') return recordsFromI18n(payload);
    return [];
  }
}
