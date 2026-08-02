import { normalizeWhitespace, slugify } from './text.js';

function findMatchingBracket(text, startIndex) {
  let depth = 0;
  let inString = null;
  let escaped = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === inString) {
        inString = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractArraySource(source, variableName) {
  const marker = `const ${variableName} = [`;
  const start = source.indexOf(marker);
  if (start === -1) return null;
  const arrayStart = source.indexOf('[', start);
  const arrayEnd = findMatchingBracket(source, arrayStart);
  return arrayEnd === -1 ? null : source.slice(arrayStart, arrayEnd + 1);
}

function extractStringArray(objectSource) {
  const bodyMatch = /body:\s*\[([\s\S]*?)\]\s*,?\s*}/.exec(objectSource);
  if (!bodyMatch) return [];
  return [...bodyMatch[1].matchAll(/'((?:\\'|[^'])*)'/g)]
    .map((match) => normalizeWhitespace(match[1].replace(/\\'/g, "'")))
    .filter(Boolean);
}

function parsePolicySections(source, variableName) {
  const arraySource = extractArraySource(source, variableName);
  if (!arraySource) return [];
  const objectSources = [];
  let depth = 0;
  let objectStart = -1;
  let inString = null;
  let escaped = false;

  for (let i = 0; i < arraySource.length; i += 1) {
    const char = arraySource[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === inString) inString = null;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }
    if (char === '{') {
      if (depth === 0) objectStart = i;
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0 && objectStart !== -1) {
        objectSources.push(arraySource.slice(objectStart, i + 1));
        objectStart = -1;
      }
    }
  }

  return objectSources
    .map((objectSource) => {
      const id = /id:\s*'([^']+)'/.exec(objectSource)?.[1];
      const title = /title:\s*('((?:\\'|[^'])*)'|"((?:\\"|[^"])*)")/.exec(objectSource);
      return {
        id,
        title: normalizeWhitespace((title?.[2] || title?.[3] || '').replace(/\\'/g, "'").replace(/\\"/g, '"')),
        body: extractStringArray(objectSource),
      };
    })
    .filter((section) => section.id && section.title)
    .filter((section) => section.body.length);
}

const POLICY_CONFIG = [
  {
    variableName: 'privacySections',
    title: 'Privacy Policy',
    category: 'policies',
    pageUrl: '/privacy-policy',
    concept: 'privacy',
  },
  {
    variableName: 'termsSections',
    title: 'Terms of Use',
    category: 'policies',
    pageUrl: '/terms-of-use',
    concept: 'terms',
  },
  {
    variableName: 'dataSections',
    title: 'Data Policy',
    category: 'policies',
    pageUrl: '/data-policy',
    concept: 'data_policy',
  },
];

function recordsFromPolicyPage(sourceText) {
  return POLICY_CONFIG.flatMap((policy) => (
    parsePolicySections(sourceText, policy.variableName).map((section) => ({
      id: `${policy.concept}-${section.id}`,
      title: `${policy.title}: ${section.title}`,
      category: policy.category,
      content: section.body.join(' '),
      pageUrl: policy.pageUrl,
      concept: policy.concept,
      sourcePath: section.id,
      sourceName: 'Borneo Tracker policy page',
      status: 'incomplete',
      language: 'en',
    }))
  ));
}

function parseObjectKeys(sourceText, objectName) {
  const exportMarker = `export const ${objectName} = {`;
  const constMarker = `const ${objectName} = {`;
  const start = sourceText.indexOf(exportMarker) !== -1
    ? sourceText.indexOf(exportMarker)
    : sourceText.indexOf(constMarker);
  if (start === -1) return [];
  const objectStart = sourceText.indexOf('{', start);
  let depth = 0;
  let inString = null;
  let escaped = false;
  let end = -1;
  for (let i = objectStart; i < sourceText.length; i += 1) {
    const char = sourceText[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === inString) inString = null;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];
  const objectBody = sourceText.slice(objectStart, end);
  const quoted = [...objectBody.matchAll(/'([^']+)':\s*'((?:\\'|[^'])*)'/g)]
    .map((match) => ({
      key: match[1],
      value: normalizeWhitespace(match[2].replace(/\\'/g, "'")),
    }))
    .filter((item) => item.value.length >= 40);
  const unquoted = [...objectBody.matchAll(/(?:^|[\r\n])\s*([a-zA-Z0-9_]+):\s*'((?:\\'|[^'])*)'/g)]
    .map((match) => ({
      key: match[1],
      value: normalizeWhitespace(match[2].replace(/\\'/g, "'")),
    }))
    .filter((item) => item.value.length >= 40);
  return [...quoted, ...unquoted];
}

function recordsFromReportContent(sourceText) {
  const indicatorRecords = parseObjectKeys(sourceText, 'INDICATOR_EXPLANATIONS').map((item) => ({
    id: `report-indicator-${slugify(item.key)}`,
    title: item.key,
    category: 'reports',
    content: item.value,
    pageUrl: '/reports',
    concept: null,
    sourcePath: `INDICATOR_EXPLANATIONS.${item.key}`,
    sourceName: 'Borneo Tracker report content',
    language: 'en',
  }));

  const conceptRecords = parseObjectKeys(sourceText, 'CONCEPT_EXPLANATIONS').map((item) => ({
    id: `report-concept-${slugify(item.key)}`,
    title: item.key,
    category: 'reports',
    content: item.value,
    pageUrl: '/reports',
    concept: item.key,
    sourcePath: `CONCEPT_EXPLANATIONS.${item.key}`,
    sourceName: 'Borneo Tracker report content',
    language: 'en',
  }));

  return [...indicatorRecords, ...conceptRecords];
}

export class PageContentExtractor {
  extract(sourceText, source) {
    if (source.kind === 'policy') return recordsFromPolicyPage(sourceText);
    if (source.kind === 'report-content') return recordsFromReportContent(sourceText);
    return [];
  }
}
