import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockNewsArticles } from '../../data/mockNews.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDICATORS_PATH = path.resolve(__dirname, '../../../public/data/indicators.json');
const TERRITORIES = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];

let cachedIndicators = null;

function loadIndicators() {
  if (cachedIndicators) return cachedIndicators;
  cachedIndicators = JSON.parse(fs.readFileSync(INDICATORS_PATH, 'utf8'));
  return cachedIndicators;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function inferRegion(text, fallback) {
  const lowered = normalize(text);
  return TERRITORIES.find((territory) => lowered.includes(territory.toLowerCase())) || fallback || null;
}

function inferIndicator(text) {
  const normalized = normalize(text).replace(/\s+/g, '_');
  const aliases = [
    ['forest_cover', ['forest_cover', 'forest']],
    ['deforestation', ['deforestation']],
    ['air_quality', ['air_quality', 'aqi']],
    ['fire_hotspots', ['fire_hotspots', 'fire_alerts', 'fire']],
    ['poverty', ['poverty']],
    ['clean_water_access', ['clean_water', 'water']],
    ['unemployment_rate', ['unemployment']],
  ];
  return aliases.find(([, terms]) => terms.some((term) => normalized.includes(term)))?.[0] || null;
}

function latestRow(rows) {
  return rows
    .slice()
    .sort((a, b) => Number(String(b.year).match(/\d{4}/)?.[0] || 0) - Number(String(a.year).match(/\d{4}/)?.[0] || 0))[0] || null;
}

function unavailable(reason, meta = {}) {
  return {
    status: 'unavailable',
    reason,
    rows: [],
    sources: [],
    meta,
    todo: 'TODO: Connect this adapter to the production database/API service when backend data access is available.',
  };
}

export class DynamicDataProvider {
  constructor({ allowRead = false } = {}) {
    this.allowRead = allowRead;
  }

  inferRequest(message, request = {}) {
    return {
      indicatorId: inferIndicator(message),
      regionId: inferRegion(message, request.region),
      year: String(message).match(/\b(20\d{2}|19\d{2})\b/)?.[1] || null,
    };
  }

  getIndicatorValue(indicatorId, regionId, year) {
    if (!this.allowRead) {
      return unavailable('Dynamic data connection is not configured yet.', { indicatorId, regionId, year });
    }
    if (!indicatorId || !regionId) {
      return unavailable('The indicator or region could not be identified from the question.', { indicatorId, regionId, year });
    }
    const rows = loadIndicators().rows.filter(
      (row) =>
        row.canonical === 1 &&
        normalize(row.territory) === normalize(regionId) &&
        row.dashboard_concept === indicatorId &&
        (!year || String(row.year).includes(String(year)))
    );
    const row = latestRow(rows);
    return row
      ? { status: 'ok', rows: [row], sources: [], meta: { indicatorId, regionId, year: row.year } }
      : unavailable('No matching dashboard row is available.', { indicatorId, regionId, year });
  }

  getIndicatorTrend(indicatorId, regionId, startYear, endYear) {
    if (!this.allowRead) return unavailable('Dynamic data connection is not configured yet.', { indicatorId, regionId, startYear, endYear });
    const series = loadIndicators().series?.[regionId]?.[indicatorId] || null;
    if (!series) return unavailable('Historical trend data is not available for this indicator and region.', { indicatorId, regionId });
    return { status: 'ok', rows: series, sources: [], meta: { indicatorId, regionId, startYear, endYear } };
  }

  compareRegions(indicatorId, regionIds = TERRITORIES, year = null) {
    if (!this.allowRead) return unavailable('Dynamic data connection is not configured yet.', { indicatorId, regionIds, year });
    if (!indicatorId) return unavailable('The indicator could not be identified from the question.', { indicatorId });
    const rows = regionIds
      .map((regionId) => this.getIndicatorValue(indicatorId, regionId, year).rows[0])
      .filter(Boolean);
    return rows.length
      ? { status: 'ok', rows, sources: [], meta: { indicatorId, regionIds, year } }
      : unavailable('No comparable dashboard rows are available.', { indicatorId, regionIds, year });
  }

  getRegionalSummary(regionId) {
    if (!this.allowRead) return unavailable('Dynamic data connection is not configured yet.', { regionId });
    const rows = loadIndicators().rows.filter((row) => row.canonical === 1 && normalize(row.territory) === normalize(regionId));
    return rows.length
      ? { status: 'ok', rows, sources: [], meta: { regionId } }
      : unavailable('No regional dashboard rows are available.', { regionId });
  }

  getSdgProgress(sdgId, regionId, year) {
    if (!this.allowRead) return unavailable('Dynamic data connection is not configured yet.', { sdgId, regionId, year });
    const rows = loadIndicators().rows.filter(
      (row) =>
        row.canonical === 1 &&
        (!sdgId || normalize(row.sdg_goal) === normalize(sdgId)) &&
        (!regionId || normalize(row.territory) === normalize(regionId)) &&
        (!year || String(row.year).includes(String(year)))
    );
    return rows.length
      ? { status: 'ok', rows, sources: [], meta: { sdgId, regionId, year } }
      : unavailable('No matching SDG dashboard rows are available.', { sdgId, regionId, year });
  }

  getLatestNews(limit = 5) {
    if (!this.allowRead) return unavailable('Dynamic data connection is not configured yet.', { limit });
    const rows = mockNewsArticles
      .filter((article) => article.status === 'published')
      .slice(0, limit);
    return rows.length
      ? { status: 'ok', rows, sources: [], meta: { limit } }
      : unavailable('No published news is available.', { limit });
  }

  answer(message, request) {
    const inferred = this.inferRequest(message, request);
    const text = normalize(message);
    if (text.includes('news') || text.includes('insight')) return this.getLatestNews(3);
    if (text.includes('compare') || text.includes('highest') || text.includes('lowest')) {
      return this.compareRegions(inferred.indicatorId, TERRITORIES, inferred.year);
    }
    if (text.includes('trend') || text.includes('historical')) {
      return this.getIndicatorTrend(inferred.indicatorId, inferred.regionId, null, null);
    }
    if (text.includes('sdg') && text.includes('progress')) {
      return this.getSdgProgress(null, inferred.regionId, inferred.year);
    }
    if (inferred.indicatorId || inferred.regionId) {
      return this.getIndicatorValue(inferred.indicatorId, inferred.regionId, inferred.year);
    }
    return unavailable('The dynamic data request could not be mapped to an available read-only adapter.', inferred);
  }
}
