import indicatorsData from '../../../public/data/indicators.json';
import districtsData from '../../../public/data/districts.json';
import type { AIChatEntityResult, AIChatRequest } from './contracts.ts';

type Alias = {
  term: string;
  value: string;
  language?: 'en' | 'ms';
};

type RepositoryData = {
  indicators?: {
    rows?: Array<{
      indicator?: string;
      dashboard_concept?: string;
      hexagon_pillar?: string;
      sdg_goal?: string;
    }>;
  };
  districts?: {
    rows?: Array<{
      territory?: string;
      parent?: string;
      key?: string;
    }>;
  };
};

type ResolverOptions = Pick<AIChatRequest, 'region' | 'language'> & {
  repositoryData?: RepositoryData;
};

const TERRITORY_ALIASES: Alias[] = [
  { term: 'sabah', value: 'Sabah' },
  { term: 'sarawak', value: 'Sarawak' },
  { term: 'brunei', value: 'Brunei Darussalam' },
  { term: 'brunei darussalam', value: 'Brunei Darussalam' },
  { term: 'kalimantan', value: 'Kalimantan' },
  { term: 'indonesian borneo', value: 'Kalimantan' },
  { term: 'borneo indonesia', value: 'Kalimantan' },
  { term: 'borneo indonesia', value: 'Kalimantan', language: 'ms' },
  { term: 'malaysian borneo', value: 'Borneo Malaysia' },
  { term: 'borneo malaysia', value: 'Borneo Malaysia' },
  { term: 'borneo-wide', value: 'Borneo-wide' },
  { term: 'borneo wide', value: 'Borneo-wide' },
  { term: 'all borneo', value: 'Borneo-wide' },
  { term: 'seluruh borneo', value: 'Borneo-wide', language: 'ms' },
  { term: 'semua wilayah', value: 'Borneo-wide', language: 'ms' },
];

const CONCEPT_ALIASES: Alias[] = [
  { term: 'food', value: 'food', language: 'en' },
  { term: 'paddy', value: 'food', language: 'en' },
  { term: 'rice', value: 'food', language: 'en' },
  { term: 'makanan', value: 'food', language: 'ms' },
  { term: 'education', value: 'education', language: 'en' },
  { term: 'schooling', value: 'education', language: 'en' },
  { term: 'pendidikan', value: 'education', language: 'ms' },
  { term: 'shelter', value: 'shelter', language: 'en' },
  { term: 'housing', value: 'shelter', language: 'en' },
  { term: 'perlindungan', value: 'shelter', language: 'ms' },
  { term: 'perumahan', value: 'shelter', language: 'ms' },
  { term: 'energy', value: 'energy', language: 'en' },
  { term: 'electricity', value: 'energy', language: 'en' },
  { term: 'tenaga', value: 'energy', language: 'ms' },
  { term: 'elektrik', value: 'energy', language: 'ms' },
  { term: 'healthcare', value: 'healthcare', language: 'en' },
  { term: 'health care', value: 'healthcare', language: 'en' },
  { term: 'health', value: 'healthcare', language: 'en' },
  { term: 'penjagaan kesihatan', value: 'healthcare', language: 'ms' },
  { term: 'kesihatan', value: 'healthcare', language: 'ms' },
  { term: 'internet use', value: 'internet_use', language: 'en' },
  { term: 'internet', value: 'internet_use', language: 'en' },
  { term: 'penggunaan internet', value: 'internet_use', language: 'ms' },
  { term: 'forest cover', value: 'forest_cover', language: 'en' },
  { term: 'litupan hutan', value: 'forest_cover', language: 'ms' },
  { term: 'deforestation', value: 'deforestation', language: 'en' },
  { term: 'tree cover loss', value: 'deforestation', language: 'en' },
  { term: 'penebangan hutan', value: 'deforestation', language: 'ms' },
  { term: 'fire hotspots', value: 'fire_hotspots', language: 'en' },
  { term: 'fire alerts', value: 'fire_hotspots', language: 'en' },
  { term: 'hotspots', value: 'fire_hotspots', language: 'en' },
  { term: 'titik panas kebakaran', value: 'fire_hotspots', language: 'ms' },
  { term: 'air quality', value: 'air_quality', language: 'en' },
  { term: 'aqi', value: 'air_quality', language: 'en' },
  { term: 'kualiti udara', value: 'air_quality', language: 'ms' },
  { term: 'protected areas', value: 'protected_areas', language: 'en' },
  { term: 'national parks', value: 'protected_areas', language: 'en' },
  { term: 'kawasan perlindungan', value: 'protected_areas', language: 'ms' },
  { term: 'taman negara', value: 'protected_areas', language: 'ms' },
  { term: 'poverty', value: 'poverty', language: 'en' },
  { term: 'kemiskinan', value: 'poverty', language: 'ms' },
  { term: 'unemployment', value: 'unemployment_rate', language: 'en' },
  { term: 'unemployment rate', value: 'unemployment_rate', language: 'en' },
  { term: 'pengangguran', value: 'unemployment_rate', language: 'ms' },
  { term: 'economy', value: 'economy', language: 'en' },
  { term: 'gdp', value: 'economy', language: 'en' },
  { term: 'economic growth', value: 'economy', language: 'en' },
  { term: 'ekonomi', value: 'economy', language: 'ms' },
  { term: 'governance', value: 'governance', language: 'en' },
  { term: 'corruption', value: 'governance', language: 'en' },
  { term: 'tadbir urus', value: 'governance', language: 'ms' },
  { term: 'heritage', value: 'heritage', language: 'en' },
  { term: 'unesco', value: 'heritage', language: 'en' },
  { term: 'warisan', value: 'heritage', language: 'ms' },
  { term: 'entertainment', value: 'entertainment', language: 'en' },
  { term: 'tourism', value: 'entertainment', language: 'en' },
  { term: 'hiburan', value: 'entertainment', language: 'ms' },
  { term: 'pelancongan', value: 'entertainment', language: 'ms' },
  { term: 'clean water', value: 'clean_water_access', language: 'en' },
  { term: 'clean water access', value: 'clean_water_access', language: 'en' },
  { term: 'water access', value: 'clean_water_access', language: 'en' },
  { term: 'akses air bersih', value: 'clean_water_access', language: 'ms' },
  { term: 'air bersih', value: 'clean_water_access', language: 'ms' },
  { term: 'resilience', value: 'resilience', language: 'en' },
  { term: 'resilience score', value: 'resilience', language: 'en' },
  { term: 'resilience index', value: 'resilience', language: 'en' },
  { term: 'daya tahan', value: 'resilience', language: 'ms' },
  { term: 'skor daya tahan', value: 'resilience', language: 'ms' },
  { term: 'indeks daya tahan', value: 'resilience', language: 'ms' },
];

const PILLAR_ALIASES: Alias[] = [
  { term: 'food', value: 'Food', language: 'en' },
  { term: 'makanan', value: 'Food', language: 'ms' },
  { term: 'education', value: 'Education', language: 'en' },
  { term: 'pendidikan', value: 'Education', language: 'ms' },
  { term: 'shelter', value: 'Shelter', language: 'en' },
  { term: 'perlindungan', value: 'Shelter', language: 'ms' },
  { term: 'energy', value: 'Energy', language: 'en' },
  { term: 'tenaga', value: 'Energy', language: 'ms' },
  { term: 'healthcare', value: 'Healthcare', language: 'en' },
  { term: 'health care', value: 'Healthcare', language: 'en' },
  { term: 'penjagaan kesihatan', value: 'Healthcare', language: 'ms' },
  { term: 'entertainment', value: 'Entertainment', language: 'en' },
  { term: 'hiburan', value: 'Entertainment', language: 'ms' },
];

const OPERATION_ALIASES: Record<keyof AIChatEntityResult['operations'], string[]> = {
  comparison: ['compare', 'versus', 'vs', 'difference', 'between', 'bandingkan', 'berbanding', 'perbezaan'],
  ranking: ['rank', 'ranking', 'highest', 'lowest', 'kedudukan', 'tertinggi', 'terendah'],
  trend: ['trend', 'over time', 'from year to year', 'dari tahun ke tahun', 'siri sejarah'],
  weakest: ['weakest', 'weakest pillar', 'paling lemah', 'terlemah'],
  strongest: ['strongest', 'strongest pillar', 'paling kuat', 'terkuat'],
  targetGap: ['target', 'gap', 'target gap', 'sasaran', 'jurang'],
  sdgProgress: ['sdg progress', 'sdg', 'sustainable development goal', 'kemajuan sdg', 'matlamat pembangunan mampan'],
  districtLevel: ['district', 'district level', 'daerah', 'peringkat daerah'],
  latest: ['latest', 'current', 'recent', 'terkini', 'semasa', 'baru-baru ini'],
};

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’`]/g, "'")
    .replace(/[-_/]+/g, ' ')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function phrasePattern(phrase: string): RegExp {
  const normalized = normalizeText(phrase);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i');
}

function addUnique(target: string[], value: string): void {
  if (value && !target.includes(value)) target.push(value);
}

function orderedAliases(aliases: Alias[]): Alias[] {
  return [...aliases].sort((a, b) => normalizeText(b.term).length - normalizeText(a.term).length);
}

function matchAliases(question: string, aliases: Alias[], matchedTerms: string[], ambiguities: string[]): string[] {
  const byTerm = new Map<string, Set<string>>();
  for (const alias of aliases) {
    const term = normalizeText(alias.term);
    if (!phrasePattern(term).test(question)) continue;
    if (!byTerm.has(term)) byTerm.set(term, new Set());
    byTerm.get(term)?.add(alias.value);
  }

  const values: string[] = [];
  for (const [term, foundValues] of byTerm) {
    matchedTerms.push(term);
    if (foundValues.size > 1) {
      ambiguities.push(`Ambiguous term "${term}" could mean ${[...foundValues].join(', ')}.`);
      continue;
    }
    addUnique(values, [...foundValues][0]);
  }
  return values;
}

function indicatorAliases(rows: RepositoryData['indicators']['rows'] = []): Alias[] {
  const aliases: Alias[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.indicator) continue;
    const indicator = row.indicator;
    const terms = [
      indicator,
      indicator.replace(/\([^)]*\)/g, ''),
      indicator.replace(/\b(rate|ratio|gross|annual|cumulative|live|count)\b/gi, ''),
    ].map(normalizeText).filter((term) => term.length >= 3);
    for (const term of terms) {
      const key = `${term}|${indicator}`;
      if (seen.has(key)) continue;
      seen.add(key);
      aliases.push({ term, value: indicator, language: 'en' });
    }
  }
  return aliases;
}

function districtAliases(rows: RepositoryData['districts']['rows'] = []): Alias[] {
  const districtByName = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.territory) continue;
    const name = row.territory.trim();
    const normalized = normalizeText(name);
    if (!districtByName.has(normalized)) districtByName.set(normalized, new Set());
    districtByName.get(normalized)?.add(name);
  }

  return [...districtByName.entries()].map(([term, values]) => ({
    term,
    value: values.size === 1 ? [...values][0] : [...values].sort().join('|'),
  }));
}

function resolveDistricts(question: string, rows: RepositoryData['districts']['rows'], matchedTerms: string[], ambiguities: string[]): string[] {
  const found: string[] = [];
  for (const alias of orderedAliases(districtAliases(rows))) {
    if (!phrasePattern(alias.term).test(question)) continue;
    matchedTerms.push(alias.term);
    const values = alias.value.split('|');
    if (values.length > 1) {
      ambiguities.push(`Ambiguous district "${alias.term}" could mean ${values.join(', ')}.`);
      continue;
    }
    addUnique(found, values[0]);
  }
  return found;
}

function detectYears(question: string): { years: number[]; yearRange?: { start: number; end: number } } {
  const years = [...question.matchAll(/\b(19\d{2}|20\d{2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year >= 1900 && year <= 2099);
  const uniqueYears = [...new Set(years)];
  const range = /\b(19\d{2}|20\d{2})\s*(?:to|until|through|-|hingga|ke)\s*(19\d{2}|20\d{2})\b/.exec(question);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    return {
      years: uniqueYears,
      yearRange: { start: Math.min(start, end), end: Math.max(start, end) },
    };
  }
  return { years: uniqueYears };
}

function detectOperations(question: string, matchedTerms: string[]): AIChatEntityResult['operations'] {
  const operations = {
    comparison: false,
    ranking: false,
    trend: false,
    weakest: false,
    strongest: false,
    targetGap: false,
    sdgProgress: false,
    districtLevel: false,
    latest: false,
  };

  for (const [operation, terms] of Object.entries(OPERATION_ALIASES) as Array<[keyof typeof operations, string[]]>) {
    for (const term of terms) {
      if (!phrasePattern(term).test(question)) continue;
      operations[operation] = true;
      matchedTerms.push(normalizeText(term));
      break;
    }
  }
  return operations;
}

function detectLanguage(explicitLanguage: string | undefined, question: string, matchedTerms: string[]): string {
  const hasMalay = /\b(apakah|bagaimana|bandingkan|berbanding|perbezaan|trend|tahun|paling|lemah|kuat|kedudukan|sasaran|jurang|terkini|semasa|wilayah|daerah|penunjuk|daya|tahan|makanan|pendidikan|tenaga|kesihatan|hiburan|hutan|kemiskinan)\b/.test(question);
  if (hasMalay) return 'ms';
  if (explicitLanguage === 'ms') return 'ms';
  if (matchedTerms.some((term) => /terkini|wilayah|daerah|penunjuk|daya|tahan/.test(term))) return 'ms';
  return 'en';
}

function weakRegionContext(explicitTerritories: string[], region: string | undefined): string[] {
  if (explicitTerritories.length || !region) return [];
  const normalizedRegion = normalizeText(region);
  const alias = TERRITORY_ALIASES.find((item) => normalizeText(item.term) === normalizedRegion);
  return alias && !['Borneo-wide', 'Borneo Malaysia'].includes(alias.value) ? [alias.value] : [];
}

export function resolveAiChatEntities(
  question: string,
  options: Partial<ResolverOptions> = {}
): AIChatEntityResult {
  const repositoryData = {
    indicators: indicatorsData,
    districts: districtsData,
    ...options.repositoryData,
  };
  const normalizedQuestion = normalizeText(question);
  const matchedTerms: string[] = [];
  const ambiguities: string[] = [];
  const years = detectYears(normalizedQuestion);
  const operations = detectOperations(normalizedQuestion, matchedTerms);

  if (!normalizedQuestion) {
    return {
      territories: [],
      regions: [],
      concepts: [],
      indicators: [],
      pillars: [],
      districts: [],
      years: [],
      operations,
      ambiguities: ['Empty question; no entities resolved.'],
      matchedTerms: [],
      language: options.language === 'ms' ? 'ms' : 'en',
    };
  }

  const territories = matchAliases(normalizedQuestion, orderedAliases(TERRITORY_ALIASES), matchedTerms, ambiguities);
  for (const territory of weakRegionContext(territories, options.region)) addUnique(territories, territory);

  const repositoryConcepts = new Set((repositoryData.indicators?.rows || []).map((row) => row.dashboard_concept).filter(Boolean));
  const concepts = matchAliases(
    normalizedQuestion,
    orderedAliases(CONCEPT_ALIASES.filter((alias) => alias.value === 'resilience' || repositoryConcepts.has(alias.value))),
    matchedTerms,
    ambiguities
  );
  const indicators = matchAliases(
    normalizedQuestion,
    orderedAliases(indicatorAliases(repositoryData.indicators?.rows)),
    matchedTerms,
    ambiguities
  );
  const pillars = matchAliases(normalizedQuestion, orderedAliases(PILLAR_ALIASES), matchedTerms, ambiguities);
  const districts = resolveDistricts(normalizedQuestion, repositoryData.districts?.rows || [], matchedTerms, ambiguities);

  if (districts.length) operations.districtLevel = true;
  if (years.yearRange) operations.trend = true;

  const regions = territories.map((territory) => (
    territory === 'Brunei Darussalam' ? 'Brunei' : territory
  ));

  const result: AIChatEntityResult = {
    territories,
    regions: [...new Set(regions)],
    concepts,
    indicators,
    pillars,
    districts,
    years: years.years,
    operations,
    ambiguities,
    matchedTerms: [...new Set(matchedTerms)],
    language: detectLanguage(options.language, normalizedQuestion, matchedTerms),
  };
  if (years.yearRange) result.yearRange = years.yearRange;
  return result;
}

export function getEntityAliasStats(repositoryData: RepositoryData = { indicators: indicatorsData, districts: districtsData }) {
  const allAliases = {
    territories: TERRITORY_ALIASES,
    concepts: CONCEPT_ALIASES,
    indicators: indicatorAliases(repositoryData.indicators?.rows),
    pillars: PILLAR_ALIASES,
    districts: districtAliases(repositoryData.districts?.rows),
    operations: Object.values(OPERATION_ALIASES).flat().map((term) => ({ term, value: term })),
  };
  return Object.fromEntries(
    Object.entries(allAliases).map(([key, aliases]) => [
      key,
      {
        total: aliases.length,
        en: aliases.filter((alias) => alias.language === 'en' || !alias.language).length,
        ms: aliases.filter((alias) => alias.language === 'ms').length,
      },
    ])
  );
}
