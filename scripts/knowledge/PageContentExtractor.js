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
  const policyRecords = POLICY_CONFIG.flatMap((policy) => (
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
  return [...policyRecords, ...curatedDataPolicyRecords(sourceText)];
}

function curatedDataPolicyRecords(sourceText) {
  const dataSections = parsePolicySections(sourceText, 'dataSections');
  const dataSources = dataSections.find((section) => section.id === 'data-sources');
  const collection = dataSections.find((section) => section.id === 'data-collection-integration');
  const updateFrequency = dataSections.find((section) => section.id === 'data-update-frequency');
  const attribution = dataSections.find((section) => section.id === 'data-source-attribution');
  if (!dataSources || !collection || !updateFrequency || !attribution) return [];

  return [{
    id: 'environmental-data-sources',
    title: 'Environmental Data Sources',
    category: 'data-sources',
    content: [
      'Environmental data in Borneo Tracker may come from official statistical, satellite, institutional, public open-data, and public or third-party sources where applicable.',
      'Repository-supported source families include World Bank, UN SDG resources, Global Forest Watch, NASA FIRMS, government open-data portals, and WAQI / aqicn.',
      'Individual indicators preserve source, year, and update context where available; imported or transformed data should preserve source labels, units, geography, and year information.',
    ].join(' '),
    pageUrl: '/data-policy',
    region: null,
    concept: null,
    sdgTags: [],
    relatedSdgs: [],
    keywords: [
      'environmental data',
      'data source',
      'data sources',
      'source of environmental data',
      'where data comes from',
      'environmental indicators',
      'methodology',
      'provenance',
      'source attribution',
      'update information',
    ],
    sourcePath: dataSources.id,
    sourceName: 'Borneo Tracker policy page',
    status: 'verified',
    language: 'en',
  }];
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

function recordsFromReportSections(sourceText) {
  const hasEsgSection = sourceText.includes('All tracked indicators, grouped Environment') &&
    sourceText.includes('Social') &&
    sourceText.includes('Governance');
  const hasSdgSection = sourceText.includes('The same indicators mapped to the UN Sustainable Development Goals they inform');
  if (!hasEsgSection || !hasSdgSection) return [];

  return [{
    id: 'esg-vs-sdg',
    title: 'ESG and SDG in Borneo Tracker',
    category: 'reports',
    content: [
      'ESG groups tracked indicators into the Environment, Social, and Governance pillars.',
      'SDG coverage maps the same tracked indicators to the UN Sustainable Development Goals they inform.',
      'The distinction is that ESG is the pillar-based view, while SDG is the goal-based view.',
      'They overlap because the same tracked indicator dataset can be interpreted through both frameworks.',
    ].join(' '),
    pageUrl: '/reports',
    region: null,
    concept: null,
    sdgTags: [],
    relatedSdgs: [],
    keywords: [
      'ESG vs SDG',
      'ESG and SDG',
      'difference between ESG and SDG',
      'ESG compared with SDG',
      'ESG pillars',
      'SDG goals',
      'pillar-based',
      'goal-based',
      'sustainability frameworks',
      'ESG SDG overlap',
    ],
    sourcePath: 'EsgIndicatorSection/SdgCoverageSection',
    sourceName: 'Borneo Tracker report sections',
    status: 'verified',
    language: 'en',
  }];
}

function parseSdgGoals(sourceText) {
  const arraySource = extractArraySource(sourceText, 'SDG_GOALS');
  if (!arraySource) return [];
  return [...arraySource.matchAll(/\{\s*goal:\s*'([^']+)'\s*,\s*label:\s*'((?:\\'|[^'])*)'\s*\}/g)]
    .map((match) => ({
      goal: normalizeWhitespace(match[1]),
      label: normalizeWhitespace(match[2].replace(/\\'/g, "'")),
    }))
    .filter((item) => /^SDG\d+$/.test(item.goal) && item.label);
}

function recordsFromIndicatorConfig(sourceText) {
  const goals = parseSdgGoals(sourceText);
  if (!goals.length) return [];
  const goalList = goals.map((item) => `${item.goal} - ${item.label}`).join('; ');
  return [{
    id: 'sdg-monitored-goals',
    title: 'SDGs Monitored by Borneo Tracker',
    category: 'sdg-progress',
    content: [
      `Borneo Tracker currently represents these repository-supported SDGs: ${goalList}.`,
      'This is the supported repository list, not a claim that all 17 UN SDGs are covered.',
    ].join(' '),
    pageUrl: '/sdg',
    region: null,
    concept: null,
    sdgTags: goals.map((item) => item.goal),
    relatedSdgs: goals.map((item) => item.goal),
    keywords: [
      'monitored SDGs',
      'which SDGs',
      'SDGs monitored',
      'tracked SDGs',
      'SDG coverage',
      'Sustainable Development Goals tracked',
      'goals monitored',
      'Borneo Tracker SDGs',
    ],
    sourcePath: 'SDG_GOALS',
    sourceName: 'Borneo Tracker indicator configuration',
    status: 'verified',
    language: 'en',
  }];
}

export class PageContentExtractor {
  extract(sourceText, source) {
    if (source.kind === 'policy') return recordsFromPolicyPage(sourceText);
    if (source.kind === 'report-content') return recordsFromReportContent(sourceText);
    if (source.kind === 'report-sections') return recordsFromReportSections(sourceText);
    if (source.kind === 'indicator-config') return recordsFromIndicatorConfig(sourceText);
    return [];
  }
}
