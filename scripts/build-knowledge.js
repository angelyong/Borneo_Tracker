#!/usr/bin/env node
import { KnowledgeBuilder } from './knowledge/KnowledgeBuilder.js';

const validateOnly = process.argv.includes('--validate-only');
const builder = new KnowledgeBuilder();
const result = builder.run({ validateOnly });

const label = validateOnly ? 'Knowledge validation' : 'Knowledge build';
console.log(`${label}: ${result.ok ? 'passed' : 'failed'}`);
console.log(`Valid records: ${result.records.length}`);
console.log(`Invalid records: ${result.report.invalidRecords.length}`);
console.log(`Duplicates skipped: ${result.report.duplicateRecords.length}`);
console.log(`Placeholders/incomplete: ${result.report.placeholderRecords.length}`);

if (result.report.errors.length) {
  console.error(result.report.errors.join('\n'));
}

if (!result.ok) {
  process.exitCode = 1;
}
