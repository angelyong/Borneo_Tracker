import indicatorsData from '../../../public/data/indicators.json' with { type: 'json' };
import resilienceData from '../../../public/data/resilience.json' with { type: 'json' };
import districtsData from '../../../public/data/districts.json' with { type: 'json' };
import manifestData from '../../../public/data/manifest.json' with { type: 'json' };
import type { FactSource, FactValueStatus } from './contracts.ts';

export type IndicatorRow = {
  territory?: string;
  source_territory?: string;
  indicator?: string;
  dashboard_concept?: string;
  year?: string | number;
  value?: number | string | null;
  unit?: string;
  source?: string;
  data_level?: string;
  esg_pillar?: string;
  sdg_goal?: string;
  hexagon_pillar?: string;
  confidence?: string;
  last_updated?: string;
  canonical?: string | number | boolean;
  is_derived?: string | number | boolean;
  derived_from?: string;
  source_count?: number;
};

export type ResilienceDetailRow = {
  indicator?: string;
  value?: number | string | null;
  unit?: string;
  score?: number;
  confidence?: string;
  source?: string;
  year?: string | number;
};

export type TerritoryResilienceRecord = {
  index?: number;
  rag?: string;
  indexStrict?: number;
  ragStrict?: string;
  weakestPillar?: string;
  pillarScores?: Record<string, number>;
  scoredPillars?: string[];
  unscoredPillars?: string[];
  detail?: Record<string, ResilienceDetailRow[]>;
};

export type DistrictRow = IndicatorRow & {
  parent?: string;
  key?: string;
  code?: string;
};

export type TrendSeries = {
  indicator?: string;
  unit?: string;
  source?: string;
  data_level?: string;
  confidence?: string;
  points?: Array<{
    year?: string | number;
    value?: number | string | null;
  }>;
};

export type FactRepositoryData = {
  indicators?: {
    generatedAt?: string;
    territories?: string[];
    rows?: IndicatorRow[];
    series?: Record<string, Record<string, TrendSeries>>;
  };
  resilience?: {
    generatedAt?: string;
    method?: string;
    territories?: Record<string, TerritoryResilienceRecord>;
  };
  districts?: {
    generatedAt?: string;
    parents?: Record<string, string[]>;
    rows?: DistrictRow[];
  };
  manifest?: {
    generatedAt?: string;
    files?: Record<string, { generatedAt?: string; sha256?: string; bytes?: number }>;
  };
};

export type LookupResult<T> =
  | { status: 'found'; value: T }
  | { status: 'missing'; reason: string }
  | { status: 'malformed'; reason: string; sourcePath?: string };

const RUNTIME_DATA: FactRepositoryData = {
  indicators: indicatorsData,
  resilience: resilienceData,
  districts: districtsData,
  manifest: manifestData,
};

const SOURCE_FILES = {
  indicators: 'public/data/indicators.json',
  resilience: 'public/data/resilience.json',
  districts: 'public/data/districts.json',
  manifest: 'public/data/manifest.json',
} as const;

export class FactDataRepository {
  private data: FactRepositoryData;

  constructor(data: FactRepositoryData = RUNTIME_DATA) {
    this.data = data;
  }

  getSupportedTerritories(): string[] {
    return [...new Set([
      ...(this.data.indicators?.territories || []),
      ...Object.keys(this.data.resilience?.territories || {}),
    ])].sort();
  }

  getTerritoryResilience(territory: string): LookupResult<TerritoryResilienceRecord> {
    const record = this.data.resilience?.territories?.[territory];
    if (!record) return { status: 'missing', reason: `No resilience record for ${territory}.` };
    if (typeof record.index !== 'number' || !record.pillarScores || typeof record.pillarScores !== 'object') {
      return { status: 'malformed', reason: `Malformed resilience record for ${territory}.`, sourcePath: `territories.${territory}` };
    }
    return { status: 'found', value: record };
  }

  getPillarScores(territory: string): LookupResult<Record<string, number>> {
    const resilience = this.getTerritoryResilience(territory);
    if (resilience.status !== 'found') return resilience as LookupResult<Record<string, number>>;
    return { status: 'found', value: resilience.value.pillarScores || {} };
  }

  getPillarDetails(territory: string, pillar?: string): ResilienceDetailRow[] {
    const record = this.data.resilience?.territories?.[territory];
    const detail = record?.detail || {};
    if (pillar) return detail[pillar] || [];
    return Object.values(detail).flat();
  }

  getIndicatorRows(filters: {
    territories?: string[];
    concepts?: string[];
    indicators?: string[];
    pillars?: string[];
    canonicalOnly?: boolean;
  } = {}): IndicatorRow[] {
    const territories = normalizeTerritories(filters.territories || []);
    return (this.data.indicators?.rows || []).filter((row) => {
      if (filters.canonicalOnly && !isCanonical(row)) return false;
      if (territories.length && !territories.includes(normalizeTerritory(row.territory || ''))) return false;
      if (filters.concepts?.length && !filters.concepts.includes(row.dashboard_concept || '')) return false;
      if (filters.indicators?.length && !filters.indicators.includes(row.indicator || '')) return false;
      if (filters.pillars?.length && !filters.pillars.includes(row.hexagon_pillar || '')) return false;
      return true;
    });
  }

  getIndicatorValue(filters: {
    territory?: string;
    concept?: string;
    indicator?: string;
    pillar?: string;
  }): LookupResult<IndicatorRow> {
    const rows = this.getIndicatorRows({
      territories: filters.territory ? [filters.territory] : [],
      concepts: filters.concept ? [filters.concept] : [],
      indicators: filters.indicator ? [filters.indicator] : [],
      pillars: filters.pillar ? [filters.pillar] : [],
      canonicalOnly: true,
    });
    if (!rows.length) return { status: 'missing', reason: 'No committed canonical indicator row matched the request.' };
    if (rows.length > 1 && !filters.indicator) return { status: 'missing', reason: 'Multiple indicator rows matched; an exact indicator is required.' };
    const row = rows[0];
    if (row.value === null || row.value === undefined || !row.indicator || !row.unit || !row.year) {
      return { status: 'malformed', reason: 'Indicator row is missing value, indicator, unit, or year.', sourcePath: rowPath('indicators', row) };
    }
    return { status: 'found', value: row };
  }

  getTrendSeries(territory: string, concept: string): LookupResult<TrendSeries> {
    const series = this.data.indicators?.series?.[normalizeTerritory(territory)]?.[concept];
    if (!series) return { status: 'missing', reason: `No trend series for ${territory} ${concept}.` };
    const points = series.points || [];
    if (points.length < 3 || points.some((point) => !point.year || point.value === null || point.value === undefined)) {
      return { status: 'malformed', reason: `Trend series for ${territory} ${concept} has fewer than three valid points.`, sourcePath: `series.${territory}.${concept}` };
    }
    return { status: 'found', value: series };
  }

  getDistrictRows(district: string, concept?: string, indicator?: string): LookupResult<DistrictRow[]> {
    const target = compactKey(district);
    const rows = (this.data.districts?.rows || []).filter((row) => {
      if (compactKey(row.territory || '') !== target) return false;
      if (concept && row.dashboard_concept !== concept) return false;
      if (indicator && row.indicator !== indicator) return false;
      return isCanonical(row);
    });
    if (!rows.length) return { status: 'missing', reason: `No committed district fact for ${district}.` };
    if (rows.some((row) => row.value === null || row.value === undefined || !row.year || !row.unit)) {
      return { status: 'malformed', reason: `Malformed district row for ${district}.`, sourcePath: `rows[territory=${district}]` };
    }
    return { status: 'found', value: rows };
  }

  getDistrictGeneratedAt(): string | undefined {
    return this.data.districts?.generatedAt;
  }

  getMethodologyNotes(): string[] {
    const method = this.data.resilience?.method;
    return [
      ...(method ? [method] : []),
      'Rounding policy: calculations preserve raw values and format answer-facing numbers to one decimal place unless the source value is an integer.',
      'Target bounds are committed in compute_resilience.py and mirrored by Stage 4A for deterministic fact building.',
    ];
  }

  getSourceForIndicator(row: IndicatorRow | ResilienceDetailRow, sourcePath: string): FactSource {
    return sourceFromText(row.source || '', SOURCE_FILES.indicators, sourcePath, row.year);
  }

  getSourceForResilience(sourcePath: string): FactSource {
    return {
      sourceFile: SOURCE_FILES.resilience,
      sourcePath,
      year: parseYear(this.data.resilience?.generatedAt),
    };
  }

  getSourceForDistrict(row: DistrictRow, sourcePath: string): FactSource {
    return sourceFromText(row.source || '', SOURCE_FILES.districts, sourcePath, row.year);
  }

  getManifestSource(): FactSource {
    return {
      sourceFile: SOURCE_FILES.manifest,
      sourcePath: 'files',
      year: parseYear(this.data.manifest?.generatedAt),
    };
  }
}

export function createDefaultFactDataRepository(): FactDataRepository {
  return new FactDataRepository();
}

export function isCanonical(row: IndicatorRow): boolean {
  return row.canonical === 1 || row.canonical === '1' || row.canonical === true;
}

export function valueStatus(row: IndicatorRow | ResilienceDetailRow, territory?: string): FactValueStatus {
  const source = String(row.source || '');
  if ('is_derived' in row && (row.is_derived === 1 || row.is_derived === '1' || row.is_derived === true)) return 'derived';
  if (/^derived:|unweighted mean|sum of|approx/i.test(source)) return 'derived';
  if ('data_level' in row && row.data_level === 'national' && territory && territory !== 'Brunei') return 'inherited';
  if (/applied to state|inherited national/i.test(source)) return 'inherited';
  return 'direct';
}

export function normalizeTerritory(value: string): string {
  if (value === 'Brunei Darussalam') return 'Brunei';
  return value;
}

export function normalizeTerritories(values: string[]): string[] {
  return values.map(normalizeTerritory).filter((value) => value && value !== 'Borneo-wide' && value !== 'Borneo Malaysia');
}

export function parseYear(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value || '').match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

export function rowPath(kind: 'indicators' | 'districts', row: IndicatorRow): string {
  const territory = row.territory || 'unknown';
  const concept = row.dashboard_concept || 'unknown';
  const indicator = row.indicator || 'unknown';
  return `rows[territory=${territory}][concept=${concept}][indicator=${indicator}]`;
}

function sourceFromText(source: string, sourceFile: string, sourcePath: string, year: unknown): FactSource {
  const url = source.match(/https?:\/\/\S+/)?.[0];
  const cleanSource = source.replace(/https?:\/\/\S+/g, '').trim();
  const [publisherPart, titlePart] = cleanSource.split(/\s+[—-]\s+/, 2);
  const publisher = publisherPart && !/^manual report:?$/i.test(publisherPart) ? publisherPart.replace(/^Manual report:\s*/i, '').trim() : undefined;
  const title = titlePart ? titlePart.trim() : undefined;
  return {
    ...(publisher ? { publisher } : {}),
    ...(title ? { title } : {}),
    ...(url ? { url } : {}),
    sourceFile,
    sourcePath,
    year: parseYear(year),
  };
}

function compactKey(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
