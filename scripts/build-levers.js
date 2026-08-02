#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INPUT_FILES = [
  'knowledge/levers/verified-levers.en.json',
  'knowledge/levers/verified-levers.ms.json',
];
const CANONICAL_OUTPUT = 'knowledge/generated/lever-library.json';
const EDGE_OUTPUT = 'supabase/functions/ai-chat/lever-library.json';
const REPORT_OUTPUT = 'knowledge/generated/lever-build-report.json';
const STATUSES = ['VERIFIED', 'INCOMPLETE', 'PLACEHOLDER', 'REJECTED'];
const CONCEPTS = new Set([
  'air_quality', 'clean_water_access', 'deforestation', 'economy', 'education', 'energy',
  'entertainment', 'fire_hotspots', 'food', 'food_percapita', 'forest_cover', 'governance',
  'healthcare', 'heritage', 'internet_use', 'poverty', 'protected_areas', 'shelter',
  'unemployment_rate',
]);
const PILLARS = new Set(['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment']);
const TERRITORIES = new Set(['Sabah', 'Sarawak', 'Brunei', 'Kalimantan', 'Borneo-wide', 'generic']);
const ACTORS = new Set(['government', 'local_authority', 'community', 'private_sector', 'civil_society', 'research_institution', 'multiple', 'unspecified']);
const HORIZONS = new Set(['short', 'medium', 'long', 'unspecified']);
const PLACEHOLDER_PATTERN = /\b(?:TODO|placeholder|lorem ipsum|example only|replace later|mock policy|unverified|dummy source)\b/i;
const GUARANTEED_EFFECT_PATTERN = /\b(?:will|guarantees?|guaranteed|proven to|ensures?|causes?)\b.{0,80}\b(?:increase|improve|reduce|raise|lower|boost|cut)\b/i;

const validateOnly = process.argv.includes('--validate-only');
const records = [];
const invalidRecords = [];
const excludedRecords = [];
const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));

for (const inputFile of INPUT_FILES) {
  const payload = readJson(inputFile);
  const language = payload.language;
  for (const record of payload.records || []) {
    const normalized = { ...record, language: record.language || language };
    counts[normalized.evidenceStatus] = (counts[normalized.evidenceStatus] || 0) + 1;
    const errors = validateRecord(normalized);
    if (errors.length) {
      invalidRecords.push({ id: normalized.id, sourceFile: inputFile, errors });
      continue;
    }
    if (normalized.evidenceStatus === 'VERIFIED') {
      records.push(normalized);
    } else {
      excludedRecords.push({
        id: normalized.id,
        evidenceStatus: normalized.evidenceStatus,
        reason: 'Only VERIFIED lever records enter the runtime artifact.',
      });
    }
  }
}

const duplicateIds = duplicateValues(records.map((record) => record.id));
for (const id of duplicateIds) {
  invalidRecords.push({ id, errors: [`Duplicate verified lever id: ${id}`] });
}

const runtimeRecords = duplicateIds.length ? [] : records.sort(compareRecords);
const artifact = {
  schemaVersion: 1,
  generatedAt: '1970-01-01T00:00:00.000Z',
  recordCount: runtimeRecords.length,
  records: runtimeRecords,
};
const warnings = runtimeRecords.length
  ? []
  : ['No verified lever records are committed yet; runtime retrieval returns NO_VERIFIED_APPLICABLE_LEVER.'];
const report = {
  buildTimestamp: '1970-01-01T00:00:00.000Z',
  inputFiles: INPUT_FILES,
  counts,
  runtimeRecords: runtimeRecords.length,
  invalidRecords,
  excludedRecords,
  warnings,
  outputFiles: [CANONICAL_OUTPUT, EDGE_OUTPUT, REPORT_OUTPUT],
};

if (!validateOnly) {
  writeJson(CANONICAL_OUTPUT, artifact);
  writeJson(EDGE_OUTPUT, artifact);
  writeJson(REPORT_OUTPUT, report);
}

console.log(`${validateOnly ? 'Lever validation' : 'Lever build'}: ${invalidRecords.length ? 'failed' : 'passed'}`);
console.log(`Verified records: ${counts.VERIFIED}`);
console.log(`Runtime records: ${runtimeRecords.length}`);
console.log(`Invalid records: ${invalidRecords.length}`);
console.log(`Excluded records: ${excludedRecords.length}`);

if (invalidRecords.length) process.exitCode = 1;

function validateRecord(record) {
  const errors = [];
  if (!record.id) errors.push('Missing id');
  if (!CONCEPTS.has(record.concept)) errors.push(`Unsupported concept: ${record.concept}`);
  if (!Array.isArray(record.pillars) || !record.pillars.length || record.pillars.some((pillar) => !PILLARS.has(pillar))) errors.push('Unsupported or missing pillar');
  if (!Array.isArray(record.territories) || !record.territories.length || record.territories.some((territory) => !TERRITORIES.has(territory))) errors.push('Unsupported or missing territory');
  if (!record.title) errors.push('Missing title');
  if (!record.summary) errors.push('Missing summary');
  if (!record.mechanism) errors.push('Missing mechanism');
  if (!Array.isArray(record.whoActs) || !record.whoActs.length || record.whoActs.some((actor) => !ACTORS.has(actor))) errors.push('Invalid actor');
  if (!HORIZONS.has(record.horizon)) errors.push('Invalid horizon');
  if (!STATUSES.includes(record.evidenceStatus)) errors.push('Invalid evidenceStatus');
  if (!['en', 'ms'].includes(record.language)) errors.push('Invalid language');
  if (!Array.isArray(record.appliesWhen) || !record.appliesWhen.length) errors.push('Missing appliesWhen');
  if (!Array.isArray(record.doesNotApplyWhen) || !record.doesNotApplyWhen.length) errors.push('Missing doesNotApplyWhen');
  if (!Array.isArray(record.evidence)) errors.push('Evidence must be an array');
  if (record.evidenceStatus === 'VERIFIED' && !record.evidence?.length) errors.push('Verified record requires evidence');
  for (const evidence of record.evidence || []) {
    if (!evidence.sourceFile) errors.push('Evidence missing sourceFile');
    if (evidence.sourceFile && !fs.existsSync(path.join(ROOT, evidence.sourceFile))) errors.push(`Evidence sourceFile is not traceable: ${evidence.sourceFile}`);
    if (!evidence.whatItActuallySays) errors.push('Evidence missing whatItActuallySays');
    if (evidence.url && !/^https?:\/\/[^\s]+$/i.test(evidence.url)) errors.push('Malformed evidence URL');
    if (/\bgemini\b/i.test(evidence.publisher || '')) errors.push('Gemini cannot be evidence');
  }
  const text = [record.title, record.summary, record.mechanism, ...(record.appliesWhen || []), ...(record.doesNotApplyWhen || [])].join(' ');
  if (record.evidenceStatus === 'VERIFIED' && PLACEHOLDER_PATTERN.test(text)) errors.push('Verified record contains placeholder wording');
  if (record.evidenceStatus === 'VERIFIED' && GUARANTEED_EFFECT_PATTERN.test(text)) errors.push('Verified record claims guaranteed causal effect');
  return errors;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, file), `${JSON.stringify(value, null, 2)}\n`);
}

function compareRecords(a, b) {
  return a.concept.localeCompare(b.concept) || a.language.localeCompare(b.language) || a.id.localeCompare(b.id);
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return [...duplicates];
}
