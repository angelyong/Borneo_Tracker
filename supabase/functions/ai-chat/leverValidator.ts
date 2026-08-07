import type {
  LeverActor,
  LeverEvidenceStatus,
  LeverHorizon,
  LeverRecord,
} from './contracts.ts';

export const SUPPORTED_LEVER_CONCEPTS = [
  'air_quality',
  'clean_water_access',
  'deforestation',
  'economy',
  'education',
  'energy',
  'entertainment',
  'fire_hotspots',
  'food',
  'food_percapita',
  'forest_cover',
  'governance',
  'healthcare',
  'heritage',
  'internet_use',
  'poverty',
  'protected_areas',
  'shelter',
  'unemployment_rate',
];

export const SUPPORTED_LEVER_PILLARS = [
  'Food',
  'Energy',
  'Education',
  'Shelter',
  'Healthcare',
  'Entertainment',
];

export const SUPPORTED_LEVER_TERRITORIES = [
  'Sabah',
  'Sarawak',
  'Brunei',
  'Kalimantan',
  'Borneo-wide',
  'generic',
];

export const LEVER_ACTORS: LeverActor[] = [
  'government',
  'local_authority',
  'community',
  'private_sector',
  'civil_society',
  'research_institution',
  'multiple',
  'unspecified',
];

export const LEVER_HORIZONS: LeverHorizon[] = ['short', 'medium', 'long', 'unspecified'];
export const LEVER_STATUSES: LeverEvidenceStatus[] = ['VERIFIED', 'INCOMPLETE', 'PLACEHOLDER', 'REJECTED'];

const PLACEHOLDER_PATTERN = /\b(?:TODO|placeholder|lorem ipsum|example only|replace later|mock policy|unverified|dummy source)\b/i;
const GUARANTEED_EFFECT_PATTERN = /\b(?:will|guarantees?|guaranteed|proven to|ensures?|causes?)\b.{0,80}\b(?:increase|improve|reduce|raise|lower|boost|cut)\b/i;

export type LeverValidationIssue = {
  id?: string;
  code: string;
  message: string;
};

export type LeverValidationResult = {
  valid: boolean;
  issues: LeverValidationIssue[];
};

export type LeverCollectionValidationResult = {
  validRecords: LeverRecord[];
  invalidRecords: Array<{ record: Partial<LeverRecord>; errors: string[] }>;
  duplicateIds: string[];
};

export type LeverValidationOptions = {
  sourceFileExists?: (sourceFile: string) => boolean;
};

export function validateLeverRecord(
  record: Partial<LeverRecord>,
  options: LeverValidationOptions = {}
): LeverValidationResult {
  const issues: LeverValidationIssue[] = [];
  const id = typeof record.id === 'string' ? record.id : undefined;
  const add = (code: string, message: string) => issues.push({ id, code, message });

  if (!id?.trim()) add('MISSING_ID', 'Lever id is required.');
  if (!record.concept || !SUPPORTED_LEVER_CONCEPTS.includes(record.concept)) add('UNSUPPORTED_CONCEPT', 'Lever concept is unsupported.');
  if (!Array.isArray(record.pillars) || record.pillars.length === 0) {
    add('UNSUPPORTED_PILLAR', 'At least one supported pillar is required.');
  } else if (record.pillars.some((pillar) => !SUPPORTED_LEVER_PILLARS.includes(pillar))) {
    add('UNSUPPORTED_PILLAR', 'Lever contains an unsupported pillar.');
  }
  if (!Array.isArray(record.territories) || record.territories.length === 0) {
    add('UNSUPPORTED_TERRITORY', 'At least one supported territory is required.');
  } else if (record.territories.some((territory) => !SUPPORTED_LEVER_TERRITORIES.includes(territory))) {
    add('UNSUPPORTED_TERRITORY', 'Lever contains an unsupported territory.');
  }
  if (!String(record.title || '').trim()) add('EMPTY_TITLE', 'Lever title is required.');
  if (!String(record.summary || '').trim()) add('EMPTY_SUMMARY', 'Lever summary is required.');
  if (!String(record.mechanism || '').trim()) add('EMPTY_MECHANISM', 'Lever mechanism is required.');
  if (!Array.isArray(record.whoActs) || record.whoActs.length === 0 || record.whoActs.some((actor) => !LEVER_ACTORS.includes(actor))) {
    add('INVALID_ACTOR', 'Lever actor must be a supported value.');
  }
  if (!record.horizon || !LEVER_HORIZONS.includes(record.horizon)) add('INVALID_HORIZON', 'Lever horizon must be a supported value.');
  if (!record.evidenceStatus || !LEVER_STATUSES.includes(record.evidenceStatus)) add('INVALID_STATUS', 'Lever evidence status is invalid.');
  if (record.language !== 'en' && record.language !== 'ms') add('INVALID_LANGUAGE', 'Lever language must be en or ms.');
  if (!Array.isArray(record.appliesWhen) || record.appliesWhen.length === 0 || record.appliesWhen.some((item) => !String(item).trim())) {
    add('MISSING_APPLIES_WHEN', 'appliesWhen must contain explicit applicability text.');
  }
  if (!Array.isArray(record.doesNotApplyWhen) || record.doesNotApplyWhen.length === 0 || record.doesNotApplyWhen.some((item) => !String(item).trim())) {
    add('MISSING_DOES_NOT_APPLY_WHEN', 'doesNotApplyWhen must contain explicit exclusion text.');
  }
  if (!Array.isArray(record.keywords)) add('INVALID_KEYWORDS', 'keywords must be an array.');

  validateEvidence(record, add, options);
  validateTextClaims(record, add);

  return { valid: issues.length === 0, issues };
}

export function validateLeverCollection(
  records: Array<Partial<LeverRecord>>,
  options: LeverValidationOptions = {}
): LeverCollectionValidationResult {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const validRecords: LeverRecord[] = [];
  const invalidRecords: Array<{ record: Partial<LeverRecord>; errors: string[] }> = [];

  for (const record of records) {
    const result = validateLeverRecord(record, options);
    if (record.id) {
      if (seen.has(record.id)) {
        result.issues.push({ id: record.id, code: 'DUPLICATE_ID', message: `Duplicate lever id: ${record.id}` });
        duplicateIds.push(record.id);
      }
      seen.add(record.id);
    }
    if (result.valid && result.issues.length === 0) {
      validRecords.push(record as LeverRecord);
    } else {
      invalidRecords.push({ record, errors: result.issues.map((issue) => issue.message) });
    }
  }

  return { validRecords, invalidRecords, duplicateIds };
}

function validateEvidence(
  record: Partial<LeverRecord>,
  add: (code: string, message: string) => void,
  options: LeverValidationOptions
): void {
  if (!Array.isArray(record.evidence)) {
    add('MISSING_EVIDENCE', 'Lever evidence must be an array.');
    return;
  }
  if (record.evidenceStatus === 'VERIFIED' && record.evidence.length === 0) {
    add('MISSING_EVIDENCE', 'Verified levers require at least one evidence item.');
  }
  record.evidence.forEach((evidence, index) => {
    if (!String(evidence?.sourceFile || '').trim()) add('MISSING_SOURCE_FILE', `Evidence ${index} is missing sourceFile.`);
    if (evidence?.sourceFile && options.sourceFileExists && !options.sourceFileExists(evidence.sourceFile)) {
      add('MISSING_SOURCE_FILE', `Evidence sourceFile is not traceable: ${evidence.sourceFile}`);
    }
    if (!String(evidence?.whatItActuallySays || '').trim()) {
      add('MISSING_EVIDENCE_DESCRIPTION', `Evidence ${index} must state what the source actually supports.`);
    }
    if (evidence?.url && !/^https?:\/\/[^\s]+$/i.test(evidence.url)) add('MALFORMED_URL', `Evidence ${index} URL is malformed.`);
    if (evidence?.publisher && /\bgemini\b/i.test(evidence.publisher)) add('GEMINI_AS_EVIDENCE', 'Gemini cannot be used as lever evidence.');
  });
}

function validateTextClaims(record: Partial<LeverRecord>, add: (code: string, message: string) => void): void {
  const text = [
    record.title,
    record.summary,
    record.mechanism,
    ...(record.appliesWhen || []),
    ...(record.doesNotApplyWhen || []),
    ...(record.evidence || []).map((evidence) => evidence.whatItActuallySays),
  ].join(' ');
  if (record.evidenceStatus === 'VERIFIED' && PLACEHOLDER_PATTERN.test(text)) {
    add('PLACEHOLDER_VERIFIED', 'Verified lever contains placeholder or unverified wording.');
  }
  if (record.evidenceStatus === 'VERIFIED' && GUARANTEED_EFFECT_PATTERN.test(text)) {
    add('UNSUPPORTED_CAUSAL_EFFECT', 'Verified lever must not claim guaranteed causal effect.');
  }
  if (/\bscore\s*(?:increase|improvement|gain|uplift)\b/i.test(text)) {
    add('IMPACT_ESTIMATE', 'Lever must not estimate score impact.');
  }
}
