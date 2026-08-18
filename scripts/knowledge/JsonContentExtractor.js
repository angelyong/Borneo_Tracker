function asRecordArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.items)) return payload.items;
  return null;
}

import { normalizeWhitespace } from './text.js';

function joinFields(obj, keys) {
  return keys.map((key) => obj?.[key]).filter(Boolean).join(' ');
}

function record(sourcePath, title, category, content, pageUrl, extra = {}) {
  return {
    id: extra.id,
    title,
    category,
    content: normalizeWhitespace(content),
    pageUrl,
    sourcePath,
    translationKey: sourcePath,
    ...extra,
  };
}

function hasMeaningfulContent(item) {
  return normalizeWhitespace(item.content).length >= 60;
}

function recordsFromI18n(payload) {
  const records = [];
  const language = payload.__language;
  const about = payload.about || {};
  const dashboard = payload.dashboard || {};
  const esg = payload.esg || {};
  const sdg = payload.sdg || {};
  const regional = payload.regional || {};
  const community = payload.community || {};
  const news = payload.news || {};
  const reports = payload.reports || {};
  const sidebar = payload.sidebar || {};

  records.push(record('about.overview', about.heroTitle || 'Understanding Borneo Through Trusted Data', 'site-overview', joinFields(about, [
      'heroLede',
      'purposeBody',
      'monitorEnvironmentBody',
      'monitorSocialBody',
      'monitorSustainabilityBody',
      'transparentDataBody',
      'noticeBody',
    ]), '/about', {
      id: `about-borneo-tracker-${language}`,
      language,
      sourceName: 'Borneo Tracker interface copy',
      keywords: ['about', 'borneo', 'tracker', 'trusted data', 'resilience'],
    }));

  records.push(record('about.resilience', about.theResilienceScore || 'The Resilience Score', 'site-overview', joinFields(about, [
    'resilienceExplainerPart1',
    'resilienceScoreLabel',
    'resilienceExplainerPart2',
    'resilienceStatusBody',
    'resilienceByPillarBody',
  ]), '/about', {
    id: `about-resilience-score-${language}`,
    language,
    concept: 'resilience_index',
    sourceName: 'Borneo Tracker interface copy',
    keywords: ['resilience', 'true wealth', 'hexagon', 'food', 'energy', 'education', 'shelter', 'healthcare', 'entertainment'],
  }));

  records.push(record('about.regions', about.scopeTerritoriesTitle || 'Borneo Tracker Regions', 'regions', about.scopeTerritoriesBody || '', '/regions', {
    id: `borneo-tracker-regions-${language}`,
    language,
    regions: ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'],
    sourceName: 'Borneo Tracker interface copy',
  }));

  records.push(record('dashboard.resilience', dashboard.overallResilienceStatus || sidebar.dashboard || 'Dashboard', 'dashboard', joinFields(dashboard, [
    'overallResilienceStatus',
    'resilienceIndexCaption',
    'strictTrueResilience',
    'fragilityGap',
    'pillarCoverage',
    'resilienceByPillar',
    'hexagonSubRegion',
    'moneyVsResilience',
    'moneyVsResilienceSub',
    'pillarProvenance',
    'noComparableData',
  ]), '/', {
    id: `dashboard-resilience-${language}`,
    language,
    concept: 'resilience_index',
    sourceName: 'Borneo Tracker interface copy',
  }));

  records.push(record('dashboard.map_layers', dashboard.liveLayer || 'Dashboard map layers', 'dashboard', joinFields(dashboard, [
    'searchPlaceholder',
    'acrossDistricts',
    'colouredAcrossRegions',
    'region',
    'district',
    'liveLayer',
    'noDistrictDataForLayer',
    'hexagonNotMappedDistrict',
  ]), '/', {
    id: `dashboard-map-layers-${language}`,
    language,
    sourceName: 'Borneo Tracker interface copy',
  }));

  records.push(record('esg.overview', esg.title || sidebar.esgIndicators || 'ESG Indicators', 'esg-indicators', joinFields(esg, [
    'subtitle',
    'categoryEnvironment',
    'categorySocial',
    'categoryGovernance',
    'canonicalIndicatorsAvailable',
    'latestDataYear',
    'confidenceMix',
    'trendStatus',
    'historicalSeriesNotEnabled',
  ]), '/esg', {
    id: `esg-indicators-page-${language}`,
    language,
    sourceName: 'Borneo Tracker interface copy',
  }));

  records.push(record('sdg.overview', sdg.title || sidebar.sdgProgress || 'SDG Progress', 'sdg-progress', joinFields(sdg, [
    'subtitle',
  ]), '/sdg', {
    id: `sdg-progress-page-${language}`,
    language,
    sourceName: 'Borneo Tracker interface copy',
  }));

  records.push(record('regional.overview', sidebar.regionalDetails || 'Regional Details', 'regional', joinFields(regional, [
    'territory',
    'comparisonIndicator',
    'scoredPillarsTitle',
    'resilienceIndex',
    'weakestPillarsScored',
    'canonicalIndicators',
    'historicalTrend',
    'crossTerritorySnapshot',
    'latestCanonicalValue',
    'realAnnualSeries',
    'noHistoricalSeries',
    'confidenceByTerritory',
    'resilienceByPillarTitle',
    'resilienceComputedTerritoryLevelFull',
    'realYearlySeriesEnabled',
    'trendChartsHeldBack',
  ]), '/regions', {
    id: `regional-details-${language}`,
    language,
    sourceName: 'Borneo Tracker interface copy',
  }));

  records.push(record('reports.overview', sidebar.generateReport || 'Generate Report', 'generate-report', joinFields(reports, [
      'subtitle',
    ]), '/reports', {
      id: `generate-report-page-${language}`,
      language,
      sourceName: 'Borneo Tracker interface copy',
    }));

  records.push(record('community.overview', community.title || sidebar.community || 'Community', 'community', joinFields(community, [
    'subtitle',
    'startDiscussion',
    'noDiscussionsYet',
    'searchPlaceholder',
    'allTopics',
    'allRegions',
  ]), '/community', {
    id: `community-page-${language}`,
    language,
    sourceName: 'Borneo Tracker interface copy',
  }));

  records.push(record('news.overview', sidebar.newsInsights || 'News & Insights', 'news', joinFields(news, [
    'subtitle',
    'aiDisclaimer',
    'sourceUnavailable',
    'noNewsAvailable',
    'latestNews',
    'aiSummary',
    'originalSource',
    'aiGeneratedNotice',
  ]), '/news', {
    id: `news-page-${language}`,
    language,
    sourceName: 'Borneo Tracker interface copy',
  }));

  return records.filter(hasMeaningfulContent);
}

export class JsonContentExtractor {
  extract(payload, source) {
    const directRecords = asRecordArray(payload);
    if (directRecords) return directRecords;
    if (source.kind === 'i18n') return recordsFromI18n({ ...payload, __language: source.language || 'en' });
    return [];
  }
}
