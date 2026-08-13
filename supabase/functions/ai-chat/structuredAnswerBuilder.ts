import type {
  AIChatEntityResult,
  AIChatFactObject,
  AIChatStructuredAnswer,
  AnswerLayer,
  AnswerLayerStatus,
  ComparabilityResult,
  EvidenceLeverLayer,
  FactSource,
  FactValue,
  FactWarning,
  LeverRecord,
  LeverRetrievalResult,
} from './contracts.ts';

export type StructuredAnswerTemplates = Partial<Record<SupportedLanguage, Partial<TemplateSet>>>;

export type StructuredAnswerBuilderInput = {
  language: string;
  factObject: AIChatFactObject;
  entities: AIChatEntityResult;
  comparability: ComparabilityResult;
  levers?: LeverRetrievalResult;
  templates?: StructuredAnswerTemplates;
};

type SupportedLanguage = 'en' | 'ms';

type TemplateSet = {
  headings: {
    conclusion: string;
    diagnosis: string;
    gap: string;
    impact: string;
    lever: string;
    honesty: string;
  };
  unavailableValue: string;
  blockedComparison: string;
  clarification: string;
  targetUnavailable: string;
  sdgDowngrade: string;
  trendUnavailable: string;
  impactUnavailable: string;
  leverUnavailable: string;
  limitationsAvailable: string;
  noSpecificDiagnosis: string;
  noVerifiedGap: string;
  sourceLimitations: string;
  languageFallback: string;
};

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'ms'];

const DEFAULT_TEMPLATES: Record<SupportedLanguage, TemplateSet> = {
  en: {
    headings: {
      conclusion: 'Conclusion',
      diagnosis: 'Diagnosis',
      gap: 'Gap',
      impact: 'Impact',
      lever: 'Recommended action',
      honesty: 'Limitations',
    },
    unavailableValue: 'The requested value is not available in the current Borneo Tracker dataset.',
    blockedComparison: 'This comparison cannot be made reliably using the available data.',
    clarification: 'Please specify the missing detail before this answer can be built safely.',
    targetUnavailable: 'No verified compatible target is available for this requested value.',
    sdgDowngrade: 'The system can describe SDG coverage or mapping only; progress-to-target cannot be calculated.',
    trendUnavailable: 'A compatible trend series is not available in the current dataset.',
    impactUnavailable: 'A quantified impact estimate is not available in the current dataset.',
    leverUnavailable: 'No verified intervention has been retrieved for this answer yet.',
    limitationsAvailable: 'Important limitations and disclosures are attached to this structured answer.',
    noSpecificDiagnosis: 'No additional deterministic diagnosis is available for this fact.',
    noVerifiedGap: 'No verified target gap was calculated for this answer.',
    sourceLimitations: 'Some source metadata is incomplete in the committed dataset.',
    languageFallback: 'Unsupported answer language requested; deterministic templates fell back to English.',
  },
  ms: {
    headings: {
      conclusion: 'Kesimpulan',
      diagnosis: 'Diagnosis',
      gap: 'Jurang',
      impact: 'Kesan',
      lever: 'Tindakan yang disyorkan',
      honesty: 'Batasan',
    },
    unavailableValue: 'Nilai yang diminta tidak tersedia dalam set data Borneo Tracker semasa.',
    blockedComparison: 'Perbandingan ini tidak boleh dibuat dengan andal menggunakan data yang tersedia.',
    clarification: 'Sila nyatakan butiran yang hilang sebelum jawapan ini boleh dibina dengan selamat.',
    targetUnavailable: 'Tiada sasaran serasi yang telah disahkan tersedia untuk nilai yang diminta.',
    sdgDowngrade: 'Sistem hanya boleh menerangkan liputan atau pemetaan SDG; kemajuan ke arah sasaran tidak boleh dikira.',
    trendUnavailable: 'Siri trend yang serasi tidak tersedia dalam set data semasa.',
    impactUnavailable: 'Anggaran kesan berangka tidak tersedia dalam set data semasa.',
    leverUnavailable: 'Tiada intervensi yang telah disahkan diperoleh untuk jawapan ini buat masa ini.',
    limitationsAvailable: 'Batasan dan pendedahan penting dilampirkan pada jawapan berstruktur ini.',
    noSpecificDiagnosis: 'Tiada diagnosis deterministik tambahan tersedia untuk fakta ini.',
    noVerifiedGap: 'Tiada jurang sasaran yang telah disahkan dikira untuk jawapan ini.',
    sourceLimitations: 'Sebahagian metadata sumber tidak lengkap dalam set data yang dikomit.',
    languageFallback: 'Bahasa jawapan yang diminta tidak disokong; templat deterministik menggunakan bahasa Inggeris.',
  },
};

export class StructuredAnswerIntegrityError extends Error {
  code = 'STRUCTURED_ANSWER_NUMERIC_INTEGRITY';

  constructor(message: string) {
    super(message);
    this.name = 'StructuredAnswerIntegrityError';
  }
}

export function buildStructuredAnswer(input: StructuredAnswerBuilderInput): AIChatStructuredAnswer {
  const language = resolveLanguage(input.language || input.entities.language);
  const templates = mergeTemplates(language, input.templates);
  const warnings = [...input.factObject.warnings];
  if (language.fallback) {
    warnings.push({
      code: 'LANGUAGE_FALLBACK',
      message: templates.languageFallback,
      severity: 'info',
    });
  }

  const context = {
    fact: input.factObject,
    entities: input.entities,
    comparability: input.comparability,
    levers: input.levers,
    templates,
    language: language.value,
    warnings,
  };
  const layers = {
    conclusion: buildConclusionLayer(context),
    diagnosis: buildDiagnosisLayer(context),
    gap: buildGapLayer(context),
    impact: buildImpactLayer(context),
    lever: buildLeverLayer(context),
    honesty: buildHonestyLayer(context),
  };
  const summaryText = buildSummaryText(layers);
  assertApprovedSummaryNumbers(
    summaryText,
    input.factObject.approvedNumericTokens,
    input.factObject.approvedYearTokens
  );

  return {
    availability: input.factObject.availability,
    language: language.value,
    intent: input.factObject.intent,
    layers,
    summaryText,
    requiredDisclosures: dedupe(input.factObject.requiredDisclosures),
    warnings: dedupeWarnings(warnings),
    sources: dedupeSources([
      ...input.factObject.sources,
      ...leverSources(input.levers?.records || []),
    ]),
    approvedNumericTokens: [...input.factObject.approvedNumericTokens],
    approvedYearTokens: [...input.factObject.approvedYearTokens],
    blocked: input.factObject.availability === 'BLOCKED',
    clarificationRequired: input.comparability.decision === 'NEEDS_CLARIFICATION',
  };
}

function buildConclusionLayer(context: BuilderContext): AnswerLayer {
  const { fact, comparability, templates } = context;
  const base = baseLayer('conclusion', 'UNAVAILABLE', templates.headings.conclusion);
  if (comparability.decision === 'NEEDS_CLARIFICATION') {
    return {
      ...base,
      status: 'BLOCKED',
      text: firstText([...comparability.reasons, ...fact.warnings.map((warning) => warning.message)], templates.clarification),
      codes: ['CLARIFICATION_REQUIRED'],
      factReferences: ['comparison.decision'],
      warnings: [...comparability.reasons],
    };
  }
  if (fact.availability === 'BLOCKED') {
    return {
      ...base,
      status: 'BLOCKED',
      text: templates.blockedComparison,
      codes: [fact.conclusion?.code || 'FACT_BLOCKED'],
      factReferences: ['comparison.decision', 'conclusion'],
      warnings: [...comparability.reasons],
    };
  }
  if (fact.availability === 'UNAVAILABLE') {
    return {
      ...base,
      text: fact.conclusion?.text || templates.unavailableValue,
      codes: [fact.conclusion?.code || 'FACT_UNAVAILABLE'],
      factReferences: ['availability'],
      warnings: fact.warnings.map((warning) => warning.message),
    };
  }

  const valueConclusion = conclusionFromValues(fact, context);
  return {
    ...base,
    status: fact.availability === 'PARTIAL' ? 'PARTIAL' : 'AVAILABLE',
    text: valueConclusion.text,
    codes: [fact.conclusion?.code || valueConclusion.code],
    factReferences: valueConclusion.references,
    warnings: [],
  };
}

function buildDiagnosisLayer(context: BuilderContext): AnswerLayer {
  const { fact, templates } = context;
  const base = baseLayer('diagnosis', 'UNAVAILABLE', templates.headings.diagnosis);
  if (fact.availability === 'BLOCKED') return blockedLayer(base, ['comparison.decision']);
  const tieWarning = fact.warnings.find((warning) => warning.code === 'PILLAR_TIE');
  if (tieWarning) {
    return {
      ...base,
      status: 'PARTIAL',
      text: tieWarning.message,
      codes: ['PILLAR_TIE'],
      factReferences: ['diagnosis.weakestPillar', 'values.pillarScores'],
      warnings: [tieWarning.message],
    };
  }
  if (fact.diagnosis?.weakestPillar || fact.diagnosis?.strongestPillar) {
    return {
      ...base,
      status: 'AVAILABLE',
      text: diagnosisText(fact),
      codes: ['DIAGNOSIS_AVAILABLE'],
      factReferences: ['diagnosis.weakestPillar', 'diagnosis.strongestPillar', 'values.pillarScores'],
      warnings: [],
    };
  }
  return {
    ...base,
    text: templates.noSpecificDiagnosis,
    codes: ['DIAGNOSIS_UNAVAILABLE'],
    factReferences: ['diagnosis'],
    warnings: [],
  };
}

function buildGapLayer(context: BuilderContext): AnswerLayer {
  const { fact, templates } = context;
  const base = baseLayer('gap', 'UNAVAILABLE', templates.headings.gap);
  if (fact.availability === 'BLOCKED') return blockedLayer(base, ['comparison.decision']);
  if (fact.values.target && fact.values.gap) {
    const current = fact.values.rawValues[0];
    return {
      ...base,
      status: 'AVAILABLE',
      text: gapText(current, fact.values.target, fact.values.gap),
      codes: ['GAP_AVAILABLE'],
      factReferences: ['values.rawValues', 'values.target', 'values.gap'],
      warnings: [],
    };
  }
  const sdgDisclosure = fact.requiredDisclosures.find((text) => /SDG progress-to-target/i.test(text));
  return {
    ...base,
    text: sdgDisclosure ? templates.sdgDowngrade : templates.targetUnavailable,
    codes: [sdgDisclosure ? 'SDG_PROGRESS_DOWNGRADED' : 'TARGET_UNAVAILABLE'],
    factReferences: sdgDisclosure ? ['requiredDisclosures'] : ['values.target', 'values.gap'],
    warnings: [sdgDisclosure || templates.noVerifiedGap],
  };
}

function buildImpactLayer(context: BuilderContext): AnswerLayer {
  const { fact, templates } = context;
  const base = baseLayer('impact', 'UNAVAILABLE', templates.headings.impact);
  if (fact.availability === 'BLOCKED') return blockedLayer(base, ['comparison.decision']);
  if (fact.impact?.available && fact.impact.description) {
    return {
      ...base,
      status: 'AVAILABLE',
      text: fact.impact.description,
      codes: ['IMPACT_AVAILABLE'],
      factReferences: ['impact.description'],
      warnings: [],
    };
  }
  return {
    ...base,
    text: templates.impactUnavailable,
    codes: ['IMPACT_UNAVAILABLE'],
    factReferences: ['impact.available'],
    warnings: [templates.impactUnavailable],
  };
}

function buildLeverLayer(context: BuilderContext): EvidenceLeverLayer {
  const { fact, templates } = context;
  const base = baseLayer('lever', 'UNAVAILABLE', templates.headings.lever);
  const status = fact.availability === 'BLOCKED' ? 'NOT_APPLICABLE' : 'UNAVAILABLE';
  const verifiedLever = context.levers?.records[0];
  if (verifiedLever && fact.availability !== 'BLOCKED') {
    return {
      ...base,
      status: 'AVAILABLE',
      text: leverText(verifiedLever),
      codes: ['VERIFIED_LEVER_AVAILABLE'],
      factReferences: ['levers.records'],
      warnings: context.levers?.warnings || [],
      leverIds: [verifiedLever.id],
      requiresGeminiPhrasing: true,
    };
  }
  return {
    ...base,
    status,
    text: templates.leverUnavailable,
    codes: ['LEVER_RETRIEVAL_NOT_IMPLEMENTED'],
    factReferences: ['concepts', 'sources'],
    warnings: [templates.leverUnavailable],
    leverIds: [],
    requiresGeminiPhrasing: false,
  };
}

function buildHonestyLayer(context: BuilderContext): AnswerLayer {
  const { fact, comparability, templates, warnings } = context;
  const blocking = [
    ...comparability.reasons,
    ...warnings.filter((warning) => warning.severity === 'blocking').map((warning) => warning.message),
  ];
  const warningTexts = [
    ...blocking,
    ...warnings.filter((warning) => warning.severity !== 'blocking').map((warning) => warning.message),
    ...fact.requiredDisclosures,
  ];
  if (fact.sources.some((source) => !source.publisher || !source.title)) {
    warningTexts.push(templates.sourceLimitations);
  }
  if (!fact.impact?.available) warningTexts.push(templates.impactUnavailable);
  if (!context.levers?.records.length) warningTexts.push(templates.leverUnavailable);
  warningTexts.push(...(context.levers?.warnings || []));

  return {
    status: warningTexts.length ? (fact.availability === 'BLOCKED' ? 'BLOCKED' : 'PARTIAL') : 'AVAILABLE',
    heading: templates.headings.honesty,
    text: warningTexts.length ? templates.limitationsAvailable : '',
    codes: warningTexts.length ? ['LIMITATIONS_PRESENT'] : ['NO_LIMITATIONS'],
    factReferences: ['warnings', 'requiredDisclosures', 'sources', 'comparison.decision'],
    warnings: dedupe(warningTexts),
  };
}

function conclusionFromValues(fact: AIChatFactObject, context: BuilderContext): {
  text: string;
  code: string;
  references: string[];
} {
  const { language } = context;
  if (fact.comparison.requested) {
    const comparison = comparisonConclusion(fact, language);
    if (comparison) return comparison;
  }
  if (fact.values.overallResilience) {
    const value = fact.values.overallResilience;
    return {
      text: language === 'ms'
        ? `Skor daya tahan keseluruhan ${value.territory} ialah ${value.formattedValue}.`
        : `${value.territory}'s overall resilience score is ${value.formattedValue}.`,
      code: 'OVERALL_RESILIENCE_CONCLUSION',
      references: ['values.overallResilience'],
    };
  }
  if (fact.diagnosis?.weakestPillar && context.entities.operations.weakest) {
    return {
      text: `${fact.diagnosis.weakestPillar} is the weakest resilience pillar in ${fact.territories[0] || 'the selected territory'}.`,
      code: 'WEAKEST_PILLAR_CONCLUSION',
      references: ['diagnosis.weakestPillar'],
    };
  }
  if (fact.diagnosis?.strongestPillar && context.entities.operations.strongest) {
    const pillar = fact.diagnosis.strongestPillar;
    return {
      text: `${pillar} is the strongest resilience pillar in ${fact.territories[0] || 'the selected territory'}.`,
      code: 'PILLAR_EXTREMUM_CONCLUSION',
      references: ['diagnosis.strongestPillar'],
    };
  }
  const pillarScore = firstRelevantValue(fact.values.pillarScores, fact);
  if (pillarScore) {
    return {
      text: `${pillarScore.territory}'s ${pillarScore.pillar} score is ${pillarScore.formattedValue}.`,
      code: 'PILLAR_SCORE_CONCLUSION',
      references: ['values.pillarScores'],
    };
  }
  const raw = firstRelevantValue(fact.values.rawValues, fact) || firstRelevantValue(fact.values.districtValues || [], fact);
  if (raw) {
    return {
      text: `${raw.indicator || raw.label} for ${raw.territory} is ${raw.formattedValue}${raw.year ? ` in ${raw.year}` : ''}.`,
      code: 'RAW_VALUE_CONCLUSION',
      references: raw.sourcePath ? [raw.sourcePath] : ['values.rawValues'],
    };
  }
  return {
    text: fact.conclusion?.text || 'The requested value is available only as supporting metadata.',
    code: fact.conclusion?.code || 'FACT_AVAILABLE',
    references: ['conclusion'],
  };
}

function comparisonConclusion(fact: AIChatFactObject, language: SupportedLanguage): {
  text: string;
  code: string;
  references: string[];
} | undefined {
  const comparableValues = fact.values.rawValues
    .filter((value) => value.territory && value.label !== 'compatible difference')
    .slice(0, 2);
  if (comparableValues.length < 2) return undefined;

  const [left, right] = comparableValues;
  const basis = fact.comparison.basis || left.unit || right.unit || 'same committed basis';
  const valueText = language === 'ms'
    ? `${left.territory}: ${left.formattedValue}; ${right.territory}: ${right.formattedValue}`
    : `${left.territory}: ${left.formattedValue}; ${right.territory}: ${right.formattedValue}`;
  return {
    text: language === 'ms'
      ? `Perbandingan menggunakan ${basis}. ${valueText}.`
      : `Comparison uses ${basis}. ${valueText}.`,
    code: 'COMPARISON_CONCLUSION',
    references: ['values.rawValues', 'comparison.basis'],
  };
}

function diagnosisText(fact: AIChatFactObject): string {
  const parts: string[] = [];
  if (fact.diagnosis?.weakestPillar) parts.push(`Weakest pillar: ${fact.diagnosis.weakestPillar}.`);
  if (fact.diagnosis?.strongestPillar) parts.push(`Strongest pillar: ${fact.diagnosis.strongestPillar}.`);
  if (fact.diagnosis?.supportingPillars?.length) {
    parts.push(`Supporting pillars: ${fact.diagnosis.supportingPillars.join(', ')}.`);
  }
  return parts.join(' ');
}

function gapText(current: FactValue | undefined, target: FactValue, gap: FactValue): string {
  const subject = current?.indicator || target.indicator || 'The requested value';
  const territory = current?.territory || target.territory || 'the selected territory';
  const currentText = current ? `current ${current.formattedValue}` : 'current value unavailable';
  return `${subject} for ${territory} has ${currentText}, target ${target.formattedValue}, and gap ${gap.formattedValue}.`;
}

function buildSummaryText(layers: AIChatStructuredAnswer['layers']): string {
  return [
    layers.conclusion,
    layers.diagnosis,
    layers.gap,
    layers.impact,
    layers.lever,
    layers.honesty,
  ]
    .filter((layer) => layer.status !== 'NOT_APPLICABLE' && layer.text)
    .map((layer) => `${layer.heading}: ${layer.text}`)
    .join('\n');
}

function leverText(record: LeverRecord): string {
  const actors = record.whoActs.join(', ');
  return `${record.title}: ${record.summary} Mechanism: ${record.mechanism} Actor: ${actors}. Horizon: ${record.horizon}.`;
}

function leverSources(records: LeverRecord[]): FactSource[] {
  return records.flatMap((record) => record.evidence.map((evidence) => ({
    publisher: evidence.publisher,
    title: evidence.title,
    year: evidence.year,
    url: evidence.url,
    sourceFile: evidence.sourceFile,
    sourcePath: evidence.sourcePath,
  })));
}

export function assertApprovedSummaryNumbers(
  summaryText: string,
  approvedNumericTokens: string[],
  approvedYearTokens: string[]
): void {
  if (/https?:\/\//i.test(summaryText)) {
    throw new StructuredAnswerIntegrityError('Summary text must not contain URLs.');
  }
  const approved = new Set([...approvedNumericTokens, ...approvedYearTokens]);
  const tokens = extractNumericTokens(summaryText);
  const unapproved = tokens.filter((token) => !approved.has(token) && !approved.has(token.replace(/%$/, '')));
  if (unapproved.length) {
    throw new StructuredAnswerIntegrityError(`Summary text contains unapproved numeric tokens: ${dedupe(unapproved).join(', ')}`);
  }
}

export function extractNumericTokens(text: string): string[] {
  return [...text.matchAll(/\b\d+(?:\.\d+)?%?\b/g)].map((match) => match[0]);
}

function firstRelevantValue(values: FactValue[], fact: AIChatFactObject): FactValue | undefined {
  if (!values.length) return undefined;
  if (fact.pillars.length) {
    const byPillar = values.find((value) => fact.pillars.includes(value.pillar || ''));
    if (byPillar) return byPillar;
  }
  if (fact.indicators.length) {
    const byIndicator = values.find((value) => fact.indicators.includes(value.indicator || ''));
    if (byIndicator) return byIndicator;
  }
  return values[0];
}

function baseLayer(kind: keyof AIChatStructuredAnswer['layers'], status: AnswerLayerStatus, heading: string): AnswerLayer {
  return {
    status,
    heading,
    text: '',
    codes: [`${String(kind).toUpperCase()}_${status}`],
    factReferences: [],
    warnings: [],
  };
}

function blockedLayer(layer: AnswerLayer, factReferences: string[]): AnswerLayer {
  return {
    ...layer,
    status: 'BLOCKED',
    text: 'This layer is blocked by the comparability decision.',
    codes: ['LAYER_BLOCKED'],
    factReferences,
  };
}

function firstText(values: string[], fallback: string): string {
  return values.find((value) => value.trim()) || fallback;
}

function resolveLanguage(language: string): { value: SupportedLanguage; fallback: boolean } {
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
    ? { value: language as SupportedLanguage, fallback: false }
    : { value: 'en', fallback: true };
}

function mergeTemplates(language: { value: SupportedLanguage }, overrides?: StructuredAnswerTemplates): TemplateSet {
  const base = DEFAULT_TEMPLATES[language.value];
  const override = overrides?.[language.value] || {};
  return {
    ...base,
    ...override,
    headings: {
      ...base.headings,
      ...(override.headings || {}),
    },
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function dedupeWarnings(warnings: FactWarning[]): FactWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}|${warning.message}|${warning.severity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

type BuilderContext = {
  fact: AIChatFactObject;
  entities: AIChatEntityResult;
  comparability: ComparabilityResult;
  levers?: LeverRetrievalResult;
  templates: TemplateSet;
  language: SupportedLanguage;
  warnings: FactWarning[];
};
