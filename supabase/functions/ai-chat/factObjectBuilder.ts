import type {
  AIChatEntityResult,
  AIChatFactObject,
  AIChatIntentResult,
  ComparabilityResult,
  FactSource,
  FactValue,
  FactWarning,
} from './contracts.ts';
import {
  calculateCompatibleDifference,
  calculateTargetGap,
  findMaximumPillar,
  findMinimumPillar,
  formatFactValue,
  ROUNDING_POLICY,
  targetForIndicator,
} from './factCalculations.ts';
import {
  FactDataRepository,
  type IndicatorRow,
  normalizeTerritories,
  parseYear,
  rowPath,
  valueStatus,
} from './factDataRepository.ts';

export type FactObjectBuilderInput = {
  intent: AIChatIntentResult;
  entities: AIChatEntityResult;
  comparability: ComparabilityResult;
};

export type FactObjectBuilderOptions = {
  repository?: FactDataRepository;
};

export class FactObjectBuilder {
  private repository: FactDataRepository;

  constructor(options: FactObjectBuilderOptions = {}) {
    this.repository = options.repository || new FactDataRepository();
  }

  build(input: FactObjectBuilderInput): AIChatFactObject {
    const fact = this.baseFact(input);
    if (input.intent.intent !== 'DASHBOARD_DATA') return fact;

    if (input.comparability.decision === 'REJECT' || input.comparability.decision === 'NEEDS_CLARIFICATION') {
      fact.availability = 'BLOCKED';
      fact.conclusion = {
        code: `COMPARABILITY_${input.comparability.decision}`,
        text: input.comparability.reasons[0] || 'Comparability rules block this fact request.',
      };
      addWarnings(fact, input.comparability.reasons, 'blocking', 'COMPARABILITY_BLOCKED');
      return finalizeFact(fact);
    }

    if (fact.territories.length === 0 && fact.districts.length === 0) {
      fact.availability = 'UNAVAILABLE';
      addWarning(fact, 'NO_TERRITORY', 'No exact committed territory or district was resolved.', 'blocking');
      return finalizeFact(fact);
    }

    if (input.entities.operations.sdgProgress) {
      buildSdgCoverageFact(fact, this.repository);
    } else if (input.entities.operations.districtLevel || fact.districts.length) {
      buildDistrictFacts(fact, this.repository);
    } else if (input.entities.operations.trend) {
      buildTrendFacts(fact, this.repository);
    } else if (input.entities.operations.weakest || input.entities.operations.strongest) {
      buildPillarExtremumFact(fact, this.repository);
    } else if (input.entities.operations.targetGap) {
      buildTargetGapFact(fact, this.repository);
    } else if (fact.pillars.length) {
      buildPillarScoreFact(fact, this.repository);
    } else if (fact.indicators.length || fact.concepts.some((concept) => concept !== 'resilience')) {
      buildIndicatorFact(fact, this.repository);
    } else {
      buildResilienceFact(fact, this.repository);
    }

    if (input.entities.operations.comparison && input.comparability.decision !== 'DOWNGRADE') {
      buildComparisonFact(fact);
    }

    return finalizeFact(fact);
  }

  private baseFact(input: FactObjectBuilderInput): AIChatFactObject {
    const territories = normalizeTerritories(input.entities.regions.length ? input.entities.regions : input.entities.territories);
    return {
      availability: input.comparability.decision === 'DOWNGRADE' ? 'PARTIAL' : 'UNAVAILABLE',
      intent: input.intent.intent,
      territories,
      concepts: [...input.entities.concepts],
      indicators: [...input.entities.indicators],
      pillars: [...input.entities.pillars],
      districts: [...input.entities.districts],
      values: {
        rawValues: [],
        indicatorScores: [],
        pillarScores: [],
      },
      comparison: {
        requested: input.entities.operations.comparison || input.entities.operations.ranking,
        allowed: input.comparability.decision === 'ALLOW' || input.comparability.decision === 'ALLOW_WITH_WARNING',
        basis: input.comparability.normalizedComparisonBasis,
        decision: input.comparability.decision,
      },
      impact: { available: false },
      methodologyNotes: this.repository.getMethodologyNotes(),
      requiredDisclosures: [...input.comparability.requiredDisclosures],
      warnings: input.comparability.warnings.map((message) => ({
        code: 'COMPARABILITY_WARNING',
        message,
        severity: 'warning',
      })),
      sources: [],
      approvedNumericTokens: [],
      approvedYearTokens: [],
    };
  }
}

export function buildAIChatFactObject(
  input: FactObjectBuilderInput,
  options: FactObjectBuilderOptions = {}
): AIChatFactObject {
  return new FactObjectBuilder(options).build(input);
}

function buildResilienceFact(fact: AIChatFactObject, repository: FactDataRepository): void {
  for (const territory of fact.territories) {
    const result = repository.getTerritoryResilience(territory);
    if (result.status !== 'found') {
      addLookupWarning(fact, result.reason, result.status);
      continue;
    }
    const sourcePath = `territories.${territory}.index`;
    fact.values.overallResilience = {
      label: `${territory} Resilience Index`,
      territory,
      concept: 'resilience',
      value: result.value.index as number,
      formattedValue: formatFactValue(result.value.index as number),
      unit: 'score/100',
      status: 'calculated',
      sourcePath,
    };
    addSource(fact, repository.getSourceForResilience(sourcePath));
    addPillarScores(fact, territory, result.value.pillarScores || {}, repository);
    fact.diagnosis = {
      weakestPillar: result.value.weakestPillar,
      strongestPillar: findMaximumPillar(pillarScoreInputs(result.value.pillarScores || {})).pillar,
    };
    fact.conclusion = {
      code: 'RESILIENCE_AVAILABLE',
      text: `${territory} resilience score is available from committed resilience data.`,
    };
  }
  markAvailabilityFromValues(fact);
}

function buildPillarExtremumFact(fact: AIChatFactObject, repository: FactDataRepository): void {
  for (const territory of fact.territories) {
    const result = repository.getPillarScores(territory);
    if (result.status !== 'found') {
      addLookupWarning(fact, result.reason, result.status);
      continue;
    }
    const scores = pillarScoreInputs(result.value);
    const minimum = findMinimumPillar(scores);
    const maximum = findMaximumPillar(scores);
    addPillarScores(fact, territory, result.value, repository);
    fact.diagnosis = {
      weakestPillar: minimum.pillar,
      strongestPillar: maximum.pillar,
      supportingPillars: fact.pillars.length ? fact.pillars : undefined,
    };
    if (minimum.ties.length > 1) {
      addWarning(fact, 'PILLAR_TIE', `Weakest pillar tie: ${minimum.ties.join(', ')}. First alphabetical pillar is primary.`, 'info');
    }
    if (maximum.ties.length > 1) {
      addWarning(fact, 'PILLAR_TIE', `Strongest pillar tie: ${maximum.ties.join(', ')}. First alphabetical pillar is primary.`, 'info');
    }
    fact.conclusion = {
      code: 'PILLAR_EXTREMUM_AVAILABLE',
      text: `${territory} pillar extrema are available from committed pillar scores.`,
    };
  }
  markAvailabilityFromValues(fact);
}

function buildPillarScoreFact(fact: AIChatFactObject, repository: FactDataRepository): void {
  for (const territory of fact.territories) {
    const scores = repository.getPillarScores(territory);
    if (scores.status !== 'found') {
      addLookupWarning(fact, scores.reason, scores.status);
      continue;
    }
    const requestedPillars = fact.pillars.length ? fact.pillars : Object.keys(scores.value);
    for (const pillar of requestedPillars) {
      const score = scores.value[pillar];
      if (typeof score !== 'number') {
        addWarning(fact, 'PILLAR_UNAVAILABLE', `${territory} ${pillar} pillar score is unavailable.`, 'warning');
        continue;
      }
      addPillarScore(fact, territory, pillar, score, repository);
      for (const detail of repository.getPillarDetails(territory, pillar)) {
        addRawValue(fact, detail, territory, detail.indicator, detail.indicator, `territories.${territory}.detail.${pillar}`);
        if (typeof detail.score === 'number') {
          fact.values.indicatorScores.push({
            label: `${territory} ${detail.indicator} score`,
            territory,
            indicator: detail.indicator,
            pillar,
            value: detail.score,
            formattedValue: formatFactValue(detail.score),
            unit: 'score/100',
            status: 'calculated',
            sourcePath: `territories.${territory}.detail.${pillar}`,
          });
        }
        addSource(fact, repository.getSourceForIndicator(detail, `territories.${territory}.detail.${pillar}`));
      }
    }
  }
  fact.conclusion = {
    code: 'PILLAR_SCORE_AVAILABLE',
    text: 'Requested pillar score facts were built from committed resilience data.',
  };
  markAvailabilityFromValues(fact);
}

function buildIndicatorFact(fact: AIChatFactObject, repository: FactDataRepository): void {
  const concepts = fact.concepts.filter((concept) => concept !== 'resilience');
  for (const territory of fact.territories) {
    const filters = {
      territory,
      concept: concepts[0],
      indicator: fact.indicators[0],
      pillar: fact.pillars[0],
    };
    const result = repository.getIndicatorValue(filters);
    if (result.status !== 'found') {
      addLookupWarning(fact, result.reason, result.status);
      continue;
    }
    addIndicatorRowFact(fact, result.value, repository);
  }
  fact.conclusion = {
    code: 'INDICATOR_VALUE_AVAILABLE',
    text: 'Requested indicator values were built from committed indicator data.',
  };
  markAvailabilityFromValues(fact);
}

function buildTargetGapFact(fact: AIChatFactObject, repository: FactDataRepository): void {
  buildIndicatorFact(fact, repository);
  const current = fact.values.rawValues[0];
  if (!current) {
    fact.availability = 'UNAVAILABLE';
    return;
  }
  const bounds = targetForIndicator(current.indicator, current.unit);
  if (!bounds) {
    addWarning(fact, 'TARGET_UNAVAILABLE', 'No committed target bound exists for this indicator and unit.', 'warning');
    fact.requiredDisclosures.push('Target and gap are unavailable because the repository does not contain a compatible target.');
    fact.availability = 'PARTIAL';
    return;
  }
  const target: FactValue = {
    label: `${current.indicator} target`,
    territory: current.territory,
    indicator: current.indicator,
    value: bounds.best,
    formattedValue: formatFactValue(bounds.best, bounds.unit),
    unit: bounds.unit,
    status: 'calculated',
    sourcePath: 'compute_resilience.py.BOUNDS',
  };
  fact.values.target = target;
  const gap = calculateTargetGap(current, target);
  if (!gap.ok) {
    addWarning(fact, 'GAP_BLOCKED', gap.reason, 'blocking');
    fact.availability = 'BLOCKED';
    return;
  }
  fact.values.gap = {
    label: `${current.indicator} target gap`,
    territory: current.territory,
    indicator: current.indicator,
    value: gap.value,
    formattedValue: gap.formattedValue,
    unit: gap.unit,
    status: 'calculated',
    sourcePath: 'compute_resilience.py.BOUNDS',
  };
  fact.methodologyNotes.push(`Gap calculation: ${gap.method}. ${ROUNDING_POLICY}`);
  fact.conclusion = {
    code: 'TARGET_GAP_AVAILABLE',
    text: 'Target and gap were calculated from committed methodology bounds.',
  };
  addSource(fact, { sourceFile: 'compute_resilience.py', sourcePath: 'BOUNDS' });
  markAvailabilityFromValues(fact);
}

function buildComparisonFact(fact: AIChatFactObject): void {
  if (fact.values.rawValues.length < 2) return;
  const difference = calculateCompatibleDifference(fact.values.rawValues[0], fact.values.rawValues[1]);
  if (!difference.ok) {
    addWarning(fact, 'COMPARISON_DIFFERENCE_UNAVAILABLE', difference.reason, 'warning');
    fact.availability = 'PARTIAL';
    return;
  }
  fact.values.rawValues.push({
    label: 'compatible difference',
    value: difference.value,
    formattedValue: difference.formattedValue,
    unit: difference.unit,
    status: 'calculated',
    sourcePath: 'factCalculations.calculateCompatibleDifference',
  });
  fact.methodologyNotes.push(`Comparison calculation: ${difference.method}. ${ROUNDING_POLICY}`);
}

function buildTrendFacts(fact: AIChatFactObject, repository: FactDataRepository): void {
  const concept = fact.concepts.find((item) => item !== 'resilience');
  if (!concept) {
    addWarning(fact, 'TREND_CONCEPT_MISSING', 'Trend requested without an exact concept.', 'blocking');
    fact.availability = 'UNAVAILABLE';
    return;
  }
  for (const territory of fact.territories) {
    const result = repository.getTrendSeries(territory, concept);
    if (result.status !== 'found') {
      addLookupWarning(fact, result.reason, result.status);
      continue;
    }
    const sortedPoints = [...(result.value.points || [])].sort((a, b) => Number(a.year) - Number(b.year));
    for (const point of sortedPoints) {
      fact.values.trends ||= [];
      fact.values.trends.push({
        label: `${territory} ${concept} trend point`,
        territory,
        concept,
        indicator: result.value.indicator,
        value: point.value as number,
        formattedValue: formatFactValue(point.value as number, result.value.unit),
        unit: result.value.unit,
        year: parseYear(point.year),
        status: valueStatus(result.value as IndicatorRow, territory),
        sourcePath: `series.${territory}.${concept}`,
      });
    }
    addSource(fact, repository.getSourceForIndicator(result.value as IndicatorRow, `series.${territory}.${concept}`));
  }
  fact.conclusion = {
    code: 'TREND_AVAILABLE',
    text: 'Trend facts were built from committed ordered time-series data.',
  };
  markAvailabilityFromValues(fact);
}

function buildSdgCoverageFact(fact: AIChatFactObject, repository: FactDataRepository): void {
  const rows = repository.getIndicatorRows({
    territories: fact.territories,
    concepts: fact.concepts.filter((concept) => concept !== 'resilience'),
    canonicalOnly: true,
  }).filter((row) => row.sdg_goal);
  for (const row of rows) addIndicatorRowFact(fact, row, repository);
  fact.requiredDisclosures.push('SDG progress-to-target cannot be calculated because committed indicator data has no target field.');
  fact.conclusion = {
    code: 'SDG_PROGRESS_DOWNGRADED',
    text: 'Only SDG mapping or coverage facts are available; progress-to-target is unavailable.',
  };
  fact.availability = rows.length ? 'PARTIAL' : 'UNAVAILABLE';
}

function buildDistrictFacts(fact: AIChatFactObject, repository: FactDataRepository): void {
  const concept = fact.concepts.find((item) => item !== 'resilience');
  for (const district of fact.districts) {
    const result = repository.getDistrictRows(district, concept, fact.indicators[0]);
    if (result.status !== 'found') {
      addLookupWarning(fact, result.reason, result.status);
      continue;
    }
    for (const row of result.value) {
      const sourcePath = rowPath('districts', row);
      fact.values.districtValues ||= [];
      fact.values.districtValues.push(rowToFactValue(row, sourcePath));
      addSource(fact, repository.getSourceForDistrict(row, sourcePath));
    }
  }
  const generatedAt = repository.getDistrictGeneratedAt();
  if (generatedAt) {
    fact.requiredDisclosures.push(`District metadata freshness date: ${generatedAt}.`);
  }
  fact.conclusion = {
    code: 'DISTRICT_FACT_AVAILABLE',
    text: 'District facts were built from committed district data.',
  };
  markAvailabilityFromValues(fact);
}

function addIndicatorRowFact(fact: AIChatFactObject, row: IndicatorRow, repository: FactDataRepository): void {
  const sourcePath = rowPath('indicators', row);
  fact.values.rawValues.push(rowToFactValue(row, sourcePath));
  addSource(fact, repository.getSourceForIndicator(row, sourcePath));
  if (row.sdg_goal && !fact.concepts.includes(row.sdg_goal)) {
    fact.requiredDisclosures.push(`${row.dashboard_concept || row.indicator} maps to ${row.sdg_goal}.`);
  }
  if (valueStatus(row, row.territory) === 'derived') {
    fact.requiredDisclosures.push(`${row.indicator} is marked as a derived or aggregated value in committed metadata.`);
  }
  if (valueStatus(row, row.territory) === 'inherited') {
    fact.requiredDisclosures.push(`${row.indicator} is an inherited national-level value for ${row.territory}.`);
  }
}

function addRawValue(
  fact: AIChatFactObject,
  row: IndicatorRow,
  territory: string,
  concept?: string,
  indicator?: string,
  sourcePath?: string
): void {
  if (row.value === null || row.value === undefined) return;
  fact.values.rawValues.push({
    label: `${territory} ${indicator || row.indicator || 'value'}`,
    territory,
    concept,
    indicator: indicator || row.indicator,
    value: row.value as number | string,
    formattedValue: formatFactValue(row.value as number | string, row.unit),
    unit: row.unit,
    year: parseYear(row.year),
    status: valueStatus(row, territory),
    sourcePath,
  });
}

function addPillarScores(
  fact: AIChatFactObject,
  territory: string,
  scores: Record<string, number>,
  repository: FactDataRepository
): void {
  for (const [pillar, score] of Object.entries(scores)) addPillarScore(fact, territory, pillar, score, repository);
}

function addPillarScore(
  fact: AIChatFactObject,
  territory: string,
  pillar: string,
  score: number,
  repository: FactDataRepository
): void {
  const sourcePath = `territories.${territory}.pillarScores.${pillar}`;
  fact.values.pillarScores.push({
    label: `${territory} ${pillar} score`,
    territory,
    pillar,
    value: score,
    formattedValue: formatFactValue(score),
    unit: 'score/100',
    status: 'calculated',
    sourcePath,
  });
  addSource(fact, repository.getSourceForResilience(sourcePath));
}

function rowToFactValue(row: IndicatorRow, sourcePath: string): FactValue {
  return {
    label: `${row.territory || ''} ${row.indicator || ''}`.trim(),
    territory: row.territory,
    concept: row.dashboard_concept,
    indicator: row.indicator,
    pillar: row.hexagon_pillar,
    value: row.value as number | string,
    formattedValue: formatFactValue(row.value as number | string, row.unit),
    unit: row.unit,
    year: parseYear(row.year),
    status: valueStatus(row, row.territory),
    sourcePath,
  };
}

function markAvailabilityFromValues(fact: AIChatFactObject): void {
  const valueCount = fact.values.rawValues.length +
    fact.values.indicatorScores.length +
    fact.values.pillarScores.length +
    (fact.values.overallResilience ? 1 : 0) +
    (fact.values.target ? 1 : 0) +
    (fact.values.gap ? 1 : 0) +
    (fact.values.trends?.length || 0) +
    (fact.values.districtValues?.length || 0);
  if (fact.availability === 'BLOCKED') return;
  if (valueCount > 0 && fact.warnings.some((warning) => warning.severity === 'blocking')) {
    fact.availability = 'PARTIAL';
  } else if (valueCount > 0 && fact.availability !== 'PARTIAL') {
    fact.availability = 'AVAILABLE';
  } else if (valueCount === 0) {
    fact.availability = 'UNAVAILABLE';
  }
}

function finalizeFact(fact: AIChatFactObject): AIChatFactObject {
  fact.requiredDisclosures = [...new Set(fact.requiredDisclosures)];
  fact.methodologyNotes = [...new Set(fact.methodologyNotes)];
  fact.sources = dedupeSources(fact.sources);
  const numericTokens = new Set<string>();
  const yearTokens = new Set<string>();
  const values = [
    ...fact.values.rawValues,
    ...fact.values.indicatorScores,
    ...fact.values.pillarScores,
    ...(fact.values.overallResilience ? [fact.values.overallResilience] : []),
    ...(fact.values.target ? [fact.values.target] : []),
    ...(fact.values.gap ? [fact.values.gap] : []),
    ...(fact.values.trends || []),
    ...(fact.values.districtValues || []),
  ];
  for (const value of values) {
    addApprovedTokens(numericTokens, value);
    if (value.year) yearTokens.add(String(value.year));
  }
  fact.approvedNumericTokens = [...numericTokens].sort();
  fact.approvedYearTokens = [...yearTokens].sort();
  return fact;
}

function addApprovedTokens(tokens: Set<string>, value: FactValue): void {
  if (typeof value.value !== 'number') return;
  tokens.add(String(value.value));
  tokens.add(value.formattedValue);
  if (!Number.isInteger(value.value)) tokens.add(value.value.toFixed(1));
  if (value.unit === '%') {
    tokens.add(`${value.value}`);
    tokens.add(value.value.toFixed(1));
    tokens.add(`${value.value.toFixed(1)}%`);
  }
}

function addLookupWarning(fact: AIChatFactObject, message: string, status: 'missing' | 'malformed'): void {
  addWarning(
    fact,
    status === 'malformed' ? 'MALFORMED_RECORD' : 'FACT_UNAVAILABLE',
    message,
    status === 'malformed' ? 'blocking' : 'warning'
  );
}

function addWarnings(
  fact: AIChatFactObject,
  messages: string[],
  severity: FactWarning['severity'],
  code: string
): void {
  for (const message of messages) addWarning(fact, code, message, severity);
}

function addWarning(
  fact: AIChatFactObject,
  code: string,
  message: string,
  severity: FactWarning['severity']
): void {
  fact.warnings.push({ code, message, severity });
}

function addSource(fact: AIChatFactObject, source: FactSource): void {
  fact.sources.push(source);
}

function dedupeSources(sources: FactSource[]): FactSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = JSON.stringify(source);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pillarScoreInputs(scores: Record<string, number>) {
  return Object.entries(scores).map(([pillar, score]) => ({ pillar, score }));
}

