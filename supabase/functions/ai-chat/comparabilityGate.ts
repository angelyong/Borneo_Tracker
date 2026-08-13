import type {
  AIChatEntityResult,
  ComparabilityInput,
  ComparabilityMetadataRow,
  ComparabilityOperation,
  ComparabilityResult,
  ConceptComparabilityRule,
} from './contracts.ts';

const TERRITORIES = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];
const MATERIAL_YEAR_GAP = 2;
const DEFAULT_DISTRICT_STALE_DAYS = 14;

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();
const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

export const CONCEPT_RULE_REGISTRY: Record<string, ConceptComparabilityRule> = {
  air_quality: {
    concept: 'air_quality',
    crossTerritoryComparable: false,
    requiresSameIndicator: true,
    requiresSameUnit: true,
    trendAvailable: false,
    blockedReasons: ['Air quality is currently represented by city-level AQI snapshots, not territory-wide annual exposure.'],
    disclosures: ['Air quality values are city-level readings and do not represent full-territory conditions.'],
  },
  clean_water_access: {
    concept: 'clean_water_access',
    crossTerritoryComparable: true,
    comparableBasis: 'percentage of population or households with access',
    requiresSameIndicator: true,
    requiresSameUnit: true,
    requiresSameDenominator: true,
    trendAvailable: true,
  },
  deforestation: {
    concept: 'deforestation',
    crossTerritoryComparable: true,
    comparableBasis: 'annual tree cover loss in hectares',
    requiresSameIndicator: true,
    requiresSameUnit: true,
    trendAvailable: true,
    disclosures: ['Headline cumulative values and annual series use different measures.'],
  },
  economy: {
    concept: 'economy',
    crossTerritoryComparable: false,
    requiresSameIndicator: true,
    requiresSameUnit: true,
    trendAvailable: true,
    blockedReasons: ['Economy mixes GDP growth rates, absolute GDP values, and currencies across territories.'],
  },
  education: {
    concept: 'education',
    crossTerritoryComparable: false,
    requiresSameIndicator: true,
    requiresSameUnit: true,
    inheritedNationalValue: true,
    trendAvailable: false,
    blockedReasons: [
      'Education mixes adult literacy, school enrolment, and mean-years-schooling measures.',
      'Some Sabah/Sarawak education estimates are reused or duplicated, so they cannot distinguish those territories.',
    ],
  },
  energy: {
    concept: 'energy',
    crossTerritoryComparable: false,
    requiresSameIndicator: true,
    requiresSameUnit: true,
    requiresSameDenominator: true,
    trendAvailable: false,
    blockedReasons: ['Energy mixes electricity access and electrification-ratio definitions.'],
  },
  entertainment: {
    concept: 'entertainment',
    crossTerritoryComparable: false,
    requiresSameIndicator: true,
    requiresSameUnit: true,
    requiresNormalization: 'population or same tourism-flow basis',
    trendAvailable: false,
    blockedReasons: ['Entertainment/tourism mixes visitor arrivals with resident trip counts.'],
  },
  fire_hotspots: {
    concept: 'fire_hotspots',
    crossTerritoryComparable: true,
    comparableBasis: 'area-normalized fire alerts per 1,000 km2',
    requiresSameIndicator: true,
    requiresSameUnit: true,
    requiresNormalization: 'area',
    trendAvailable: true,
    disclosures: ['Fire hotspot comparisons must use an area-normalized basis.'],
  },
  food: {
    concept: 'food',
    crossTerritoryComparable: true,
    comparableBasis: 'paddy production per capita',
    requiresSameIndicator: true,
    requiresSameUnit: true,
    requiresSameDenominator: true,
    trendAvailable: false,
    disclosures: ['Food resilience uses derived per-capita paddy production, not total crop volume.'],
  },
  food_percapita: {
    concept: 'food_percapita',
    crossTerritoryComparable: true,
    comparableBasis: 'paddy production per capita',
    requiresSameIndicator: true,
    requiresSameUnit: true,
    requiresSameDenominator: true,
    trendAvailable: false,
  },
  forest_cover: {
    concept: 'forest_cover',
    crossTerritoryComparable: false,
    requiresSameIndicator: true,
    requiresSameUnit: true,
    trendAvailable: false,
    blockedReasons: ['Forest cover mixes Brunei percentage-of-land values with 2000 hectare baselines for other territories.'],
  },
  governance: {
    concept: 'governance',
    crossTerritoryComparable: false,
    requiresSameIndicator: true,
    requiresSameUnit: true,
    inheritedNationalValue: true,
    trendAvailable: false,
    blockedReasons: ['Governance uses inherited national WGI values for subnational territories, so Sabah and Sarawak have no separate signal.'],
    disclosures: ['Governance values are national-level inherited values where subnational scores do not exist.'],
  },
  healthcare: {
    concept: 'healthcare',
    crossTerritoryComparable: true,
    comparableBasis: 'same health indicator and unit',
    requiresSameIndicator: true,
    requiresSameUnit: true,
    trendAvailable: true,
  },
  heritage: {
    concept: 'heritage',
    crossTerritoryComparable: true,
    comparableBasis: 'UNESCO World Heritage count',
    requiresSameIndicator: true,
    requiresSameUnit: true,
    trendAvailable: false,
    disclosures: ['Heritage counts are status indicators, not progress-to-target measures.'],
  },
  internet_use: {
    concept: 'internet_use',
    crossTerritoryComparable: true,
    comparableBasis: 'internet-use percentage with disclosed age denominator',
    requiresSameIndicator: true,
    requiresSameUnit: true,
    requiresSameDenominator: true,
    trendAvailable: false,
    disclosures: ['Internet-use denominators differ: Indonesia is 5+ while Malaysia is 15+; avoid ranking claims.'],
  },
  poverty: {
    concept: 'poverty',
    crossTerritoryComparable: false,
    requiresSameIndicator: true,
    requiresSameUnit: true,
    requiresSameDenominator: true,
    trendAvailable: true,
    methodologyBreaks: [2019],
    blockedReasons: ['Poverty mixes household-income PLI with per-capita consumption definitions, and Brunei is missing.'],
    disclosures: ['Malaysia poverty trends have a 2019 PLI methodology break.'],
  },
  protected_areas: {
    concept: 'protected_areas',
    crossTerritoryComparable: true,
    comparableBasis: 'protected area as percentage of land',
    requiresSameIndicator: true,
    requiresSameUnit: true,
    requiresNormalization: 'percentage_of_land',
    trendAvailable: false,
    disclosures: ['Protected-area count comparisons are misleading; use percentage-of-land basis.'],
  },
  resilience: {
    concept: 'resilience',
    crossTerritoryComparable: true,
    comparableBasis: 'Resilience Index score',
    requiresSameUnit: true,
    trendAvailable: false,
    disclosures: ['Resilience comparisons use committed territory-level index scores from the same resilience methodology.'],
  },
  shelter: {
    concept: 'shelter',
    crossTerritoryComparable: false,
    requiresSameIndicator: true,
    requiresSameUnit: true,
    requiresSameDenominator: true,
    trendAvailable: false,
    blockedReasons: ['Shelter mixes sanitation or clean-water percentages with household counts.'],
  },
  unemployment_rate: {
    concept: 'unemployment_rate',
    crossTerritoryComparable: true,
    comparableBasis: 'unemployment rate percentage with source caveats',
    requiresSameIndicator: true,
    requiresSameUnit: true,
    trendAvailable: true,
    disclosures: ['Unemployment sources include modelled or quarterly values in some territories; cite source years.'],
  },
};

export function getConceptRuleRegistry(): Record<string, ConceptComparabilityRule> {
  return CONCEPT_RULE_REGISTRY;
}

export function evaluateComparability(input: ComparabilityInput): ComparabilityResult {
  const result = baseResult();
  const entityResult = input.entities;
  const operations = resolveOperations(input);
  const concepts = unique(input.concepts || entityResult?.concepts || []);
  const territories = unique((input.territories || entityResult?.regions || entityResult?.territories || []).map(normalizeTerritory));
  const districts = unique(input.districts || entityResult?.districts || []);
  const years = input.years || entityResult?.years || [];
  const ambiguities = input.ambiguities || entityResult?.ambiguities || [];
  const rows = input.metadata?.rows || [];
  const resolvedInput = { ...input, concepts, territories, districts, years, operations, ambiguities };

  if (operations.every((operation) => operation === 'describe') && concepts.length <= 1) {
    allowOperation(result, 'describe');
  }

  if (
    operations.some((operation) => operation !== 'describe') &&
    !operations.includes('district_answer') &&
    concepts.length === 0 &&
    territories.length === 0
  ) {
    requireClarification(result, 'No resolved concept or entity was available for this data operation.', operations);
    return finalize(result);
  }

  const hasHardBlockedCrossTerritoryConcept = concepts.some((concept) => {
    const rule = CONCEPT_RULE_REGISTRY[concept];
    return rule && !rule.crossTerritoryComparable && territories.length > 1;
  });
  if (concepts.length > 1 && !input.indicators?.length && !hasHardBlockedCrossTerritoryConcept) {
    requireClarification(result, 'Multiple concepts were requested without selecting an exact indicator.', operations);
    return finalize(result);
  }

  evaluateDistricts(resolvedInput, result);
  if (result.decision === 'NEEDS_CLARIFICATION' || result.decision === 'REJECT') return finalize(result);

  if (operations.includes('sdg_progress')) {
    downgrade(result, 'Repository metadata has SDG mappings but no target fields, so progress-to-target cannot be calculated.', 'sdg_progress');
    result.requiredDisclosures.push('SDG progress-to-target cannot be calculated; only SDG coverage or indicator mapping can be explained.');
  }

  for (const concept of concepts) {
    const rule = CONCEPT_RULE_REGISTRY[concept];
    if (!rule) {
      if (operations.every((operation) => operation === 'describe')) {
        allowOperation(result, 'describe');
      } else {
        warn(result, `No concept comparability rule exists for ${concept}; answer descriptively only.`);
        downgrade(result, `Unsupported concept rule for ${concept}.`, concept);
      }
      continue;
    }
    result.requiredDisclosures.push(...(rule.disclosures || []));

    const conceptRows = filterRows(rows, concept, territories);
    if (operations.includes('compare') && territories.length > 1 && !rule.crossTerritoryComparable) {
      evaluateComparisonBasis(resolvedInput, result, rule, territories, conceptRows);
    } else {
      evaluateIndicatorChoice(resolvedInput, result, concept, conceptRows);
      if (result.decision === 'NEEDS_CLARIFICATION') break;
      evaluateComparisonBasis(resolvedInput, result, rule, territories, conceptRows);
    }
    evaluateRanking(resolvedInput, result, rule, territories, conceptRows);
    evaluateTrend(resolvedInput, result, rule, concept, territories, conceptRows);
    evaluateYears(resolvedInput, result, conceptRows);
    evaluateDerivedValues(result, conceptRows);
  }

  if (!result.allowedOperations.length && !result.blockedOperations.length) {
    allowOperation(result, 'describe');
  }

  return finalize(result);
}

function baseResult(): ComparabilityResult {
  return {
    decision: 'ALLOW',
    reasons: [],
    warnings: [],
    blockedOperations: [],
    allowedOperations: [],
    requiredDisclosures: [],
  };
}

function finalize(result: ComparabilityResult): ComparabilityResult {
  result.reasons = unique(result.reasons);
  result.warnings = unique(result.warnings);
  result.blockedOperations = unique(result.blockedOperations);
  result.allowedOperations = unique(result.allowedOperations);
  result.requiredDisclosures = unique(result.requiredDisclosures);
  return result;
}

function setDecision(result: ComparabilityResult, decision: ComparabilityResult['decision']): void {
  const rank = { ALLOW: 0, ALLOW_WITH_WARNING: 1, DOWNGRADE: 2, REJECT: 3, NEEDS_CLARIFICATION: 4 };
  if (rank[decision] > rank[result.decision]) result.decision = decision;
}

function allowOperation(result: ComparabilityResult, operation: string): void {
  result.allowedOperations.push(operation);
}

function warn(result: ComparabilityResult, warning: string): void {
  setDecision(result, 'ALLOW_WITH_WARNING');
  result.warnings.push(warning);
}

function reject(result: ComparabilityResult, reason: string, operation: string): void {
  setDecision(result, 'REJECT');
  result.reasons.push(reason);
  result.blockedOperations.push(operation);
}

function downgrade(result: ComparabilityResult, reason: string, operation: string): void {
  setDecision(result, 'DOWNGRADE');
  result.reasons.push(reason);
  result.blockedOperations.push(operation);
  result.allowedOperations.push('describe');
}

function requireClarification(result: ComparabilityResult, reason: string, operations: string[]): void {
  setDecision(result, 'NEEDS_CLARIFICATION');
  result.reasons.push(reason);
  result.blockedOperations.push(...operations);
}

function resolveOperations(input: ComparabilityInput): ComparabilityOperation[] {
  if (input.operations?.length) return input.operations;
  if (!input.entities) return ['describe'];
  const operations = entityOperationsToComparabilityOperations(input.entities);
  return operations.length ? operations : ['describe'];
}

function entityOperationsToComparabilityOperations(entityResult: AIChatEntityResult): ComparabilityOperation[] {
  const operations: ComparabilityOperation[] = [];
  if (entityResult.operations.comparison) operations.push('compare');
  if (entityResult.operations.ranking) operations.push('rank');
  if (entityResult.operations.trend) operations.push('trend');
  if (entityResult.operations.sdgProgress) operations.push('sdg_progress');
  if (entityResult.operations.districtLevel || entityResult.districts.length) operations.push('district_answer');
  return operations;
}

function normalizeTerritory(value: string): string {
  if (value === 'Brunei Darussalam') return 'Brunei';
  if (value === 'Borneo Malaysia' || value === 'Borneo-wide') return value;
  return value;
}

function filterRows(rows: ComparabilityMetadataRow[], concept: string, territories: string[]): ComparabilityMetadataRow[] {
  return rows.filter((row) => {
    const conceptMatches = row.dashboard_concept === concept;
    const territoryMatches = territories.length === 0 || territories.includes(String(row.territory || ''));
    return conceptMatches && territoryMatches;
  });
}

function canonicalRows(rows: ComparabilityMetadataRow[]): ComparabilityMetadataRow[] {
  return rows.filter((row) => row.canonical === 1 || row.canonical === '1' || row.canonical === true);
}

function evaluateIndicatorChoice(
  input: ComparabilityInput,
  result: ComparabilityResult,
  concept: string,
  rows: ComparabilityMetadataRow[]
): void {
  if (input.indicators?.length || rows.length === 0) return;
  const indicators = unique(canonicalRows(rows).map((row) => String(row.indicator || '')));
  if (indicators.length > 1 && input.operations?.includes('compare')) {
    requireClarification(result, `Multiple ${concept} indicators are available; choose the exact indicator before comparing.`, input.operations || ['compare']);
  }
}

function evaluateComparisonBasis(
  input: ComparabilityInput,
  result: ComparabilityResult,
  rule: ConceptComparabilityRule,
  territories: string[],
  rows: ComparabilityMetadataRow[]
): void {
  if (!input.operations?.includes('compare') || territories.length < 2) return;
  const basis = input.options?.normalizedComparisonBasis || '';
  const rowUnits = unique(canonicalRows(rows).map((row) => String(row.unit || '')));
  const rowIndicators = unique(canonicalRows(rows).map((row) => String(row.indicator || '')));

  if (!rule.crossTerritoryComparable) {
    reject(result, rule.blockedReasons?.[0] || `${rule.concept} is not cross-territory comparable.`, 'compare');
    return;
  }

  if (rule.requiresNormalization && basis !== rule.requiresNormalization) {
    const units = unique(canonicalRows(rows).map((row) => String(row.unit || '')));
    if (units.some((unit) => /%|percent/i.test(unit)) && units.some((unit) => /count/i.test(unit))) {
      requireClarification(result, `Specify the comparison basis for ${rule.concept}; both count and percentage measures are present.`, input.operations || ['compare']);
      return;
    }
    downgrade(result, `${rule.concept} comparisons require ${rule.requiresNormalization} normalization.`, 'compare');
    return;
  }

  if (rule.requiresSameUnit && rowUnits.length > 1) {
    reject(result, `${rule.concept} comparison has incompatible units: ${rowUnits.join(', ')}.`, 'compare');
    return;
  }
  if (rule.requiresSameIndicator && rowIndicators.length > 1) {
    reject(result, `${rule.concept} comparison has incompatible indicator definitions: ${rowIndicators.join(', ')}.`, 'compare');
    return;
  }

  allowOperation(result, 'compare');
  if (rule.comparableBasis) result.normalizedComparisonBasis = rule.comparableBasis;
}

function evaluateRanking(
  input: ComparabilityInput,
  result: ComparabilityResult,
  rule: ConceptComparabilityRule,
  territories: string[],
  rows: ComparabilityMetadataRow[]
): void {
  if (!input.operations?.includes('rank')) return;
  const canon = canonicalRows(rows);
  const units = unique(canon.map((row) => String(row.unit || '')));
  const indicators = unique(canon.map((row) => String(row.indicator || '')));
  const years = unique(canon.map((row) => String(row.year || '')));
  const incomplete = territories.length > 0 && canon.length < territories.length;

  if (!rule.crossTerritoryComparable || rule.inheritedNationalValue) {
    downgrade(result, rule.blockedReasons?.[0] || `${rule.concept} cannot support ranking.`, 'rank');
    return;
  }
  if (rule.requiresNormalization && input.options?.normalizedComparisonBasis !== rule.requiresNormalization) {
    downgrade(result, `${rule.concept} ranking requires ${rule.requiresNormalization} normalization.`, 'rank');
    return;
  }
  if (units.length > 1 || indicators.length > 1 || yearsDifferMaterially(years.map(Number)) || incomplete) {
    downgrade(result, `${rule.concept} ranking lacks aligned units, definitions, years, or complete source metadata.`, 'rank');
    return;
  }
  if (rule.concept === 'internet_use') {
    downgrade(result, 'Internet-use denominators differ by age threshold, so ranking claims are unsafe.', 'rank');
    return;
  }
  allowOperation(result, 'rank');
}

function evaluateTrend(
  input: ComparabilityInput,
  result: ComparabilityResult,
  rule: ConceptComparabilityRule,
  concept: string,
  territories: string[],
  rows: ComparabilityMetadataRow[]
): void {
  if (!input.operations?.includes('trend')) return;
  const series = input.metadata?.series || {};
  const hasSeries = territories.length
    ? territories.some((territory) => Boolean(series[territory]?.[concept]))
    : rule.trendAvailable;

  if (!rule.trendAvailable || !hasSeries) {
    reject(result, `${concept} has no real ordered series available for trend analysis.`, 'trend');
    return;
  }

  if (concept === 'poverty' && crossesMethodologyBreak(input.years || [], rule.methodologyBreaks || [])) {
    reject(result, 'Poverty trends crossing the 2019 PLI methodology break must be split into separate periods.', 'trend');
    return;
  }

  const headlineIndicators = unique(canonicalRows(rows).map((row) => String(row.indicator || '')));
  const seriesIndicators = unique(territories.map((territory) => {
    const value = series[territory]?.[concept];
    return typeof value === 'object' && value && 'indicator' in value ? String((value as { indicator?: string }).indicator || '') : '';
  }));
  if (headlineIndicators.length && seriesIndicators.length && headlineIndicators.some((indicator) => !seriesIndicators.includes(indicator))) {
    warn(result, `${concept} headline values and time-series values may represent different measures.`);
  }

  result.requiredDisclosures.push('Trend answers require source years and methodology notes.');
  allowOperation(result, 'trend');
}

function evaluateYears(input: ComparabilityInput, result: ComparabilityResult, rows: ComparabilityMetadataRow[]): void {
  const years = input.years?.length ? input.years.map(Number) : canonicalRows(rows).map((row) => Number(row.year));
  const cleanYears = years.filter((year) => Number.isFinite(year));
  if (cleanYears.length < 2) return;
  const gap = Math.max(...cleanYears) - Math.min(...cleanYears);
  if (gap > MATERIAL_YEAR_GAP && !input.options?.explicitHistoricalComparison) {
    reject(result, `Requested years differ materially (${Math.min(...cleanYears)} vs ${Math.max(...cleanYears)}).`, 'year_alignment');
  } else if (gap > MATERIAL_YEAR_GAP) {
    warn(result, `Historical comparison uses different years (${Math.min(...cleanYears)} and ${Math.max(...cleanYears)}); definitions still need to match.`);
  } else if (gap > 0) {
    warn(result, `Comparison uses nearby but non-identical years (${Math.min(...cleanYears)} and ${Math.max(...cleanYears)}).`);
  }
}

function evaluateDerivedValues(result: ComparabilityResult, rows: ComparabilityMetadataRow[]): void {
  const derivedTerritories = canonicalRows(rows)
    .filter((row) => row.territory === 'Kalimantan' && (row.is_derived === 1 || row.is_derived === '1' || row.is_derived === true || /derived|mean|sum of/i.test(String(row.source || ''))))
    .map((row) => row.territory || '');
  if (derivedTerritories.length) {
    warn(result, 'Kalimantan regional aggregate values are derived from provincial data and must be disclosed.');
    result.requiredDisclosures.push('Kalimantan is a derived regional aggregate where repository metadata marks it as derived or aggregated.');
  }
}

function evaluateDistricts(input: ComparabilityInput, result: ComparabilityResult): void {
  if (!input.operations?.includes('district_answer')) return;
  const requested = unique(input.districts || []);
  const districts = input.metadata?.districts;
  const districtRows = districts?.rows || [];
  if (input.ambiguities?.length) {
    requireClarification(result, input.ambiguities[0], ['district_answer']);
    return;
  }
  if (!requested.length) {
    requireClarification(result, 'District-level answer requested without a resolved district name.', ['district_answer']);
    return;
  }

  for (const name of requested) {
    if (TERRITORIES.includes(name)) continue;
    const matches = resolveDistrict(name, districtRows);
    if (matches.status === 'unknown') {
      reject(result, `Unknown district "${name}" was not found in committed district metadata.`, 'district_answer');
      return;
    }
    if (matches.status === 'ambiguous') {
      requireClarification(result, `District name "${name}" is ambiguous; choose one exact district.`, ['district_answer']);
      return;
    }
  }

  const generatedAt = input.freshness?.districtsGeneratedAt || districts?.generatedAt;
  if (generatedAt) {
    result.requiredDisclosures.push(`District metadata freshness date: ${generatedAt}.`);
    const age = dateAgeDays(generatedAt, input.freshness?.now || '2026-08-02');
    if (age > (input.freshness?.staleAfterDays || DEFAULT_DISTRICT_STALE_DAYS)) {
      warn(result, `District metadata is stale: ${age} days old, above the ${input.freshness?.staleAfterDays || DEFAULT_DISTRICT_STALE_DAYS}-day threshold.`);
    }
  } else {
    warn(result, 'District metadata freshness date is unavailable.');
  }
  allowOperation(result, 'district_answer');
}

function resolveDistrict(name: string, rows: ComparabilityMetadataRow[]): { status: 'exact' | 'ambiguous' | 'unknown' } {
  const target = compactKey(name);
  const uniqueDistricts = new Map<string, ComparabilityMetadataRow>();
  rows.forEach((row) => {
    const key = `${row.territory}|${row.parent || ''}`;
    if (!uniqueDistricts.has(key)) uniqueDistricts.set(key, row);
  });
  const districts = [...uniqueDistricts.values()];
  const exact = districts.filter((row) => compactKey(row.territory) === target);
  if (exact.length === 1) return { status: 'exact' };
  if (exact.length > 1) return { status: 'ambiguous' };
  const partial = districts.filter((row) => compactKey(row.territory).includes(target));
  if (partial.length > 1) return { status: 'ambiguous' };
  return partial.length === 1 ? { status: 'exact' } : { status: 'unknown' };
}

function compactKey(value: unknown): string {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function dateAgeDays(date: string, now: string): number {
  const start = Date.parse(`${date}T00:00:00Z`);
  const end = Date.parse(`${now}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.floor((end - start) / 86_400_000);
}

function yearsDifferMaterially(years: number[]): boolean {
  const clean = years.filter((year) => Number.isFinite(year));
  if (clean.length < 2) return false;
  return Math.max(...clean) - Math.min(...clean) > MATERIAL_YEAR_GAP;
}

function crossesMethodologyBreak(years: Array<string | number>, breaks: number[]): boolean {
  const clean = years.map(Number).filter((year) => Number.isFinite(year));
  if (clean.length < 2) return false;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  return breaks.some((year) => min < year && max >= year);
}
