import { INTENTS } from '../../shared/aiChatContracts.js';

const STATIC_TERMS = [
  'difference', 'define', 'definition', 'explain', 'how do i',
  'how to', 'where does', 'source', 'sources', 'faq', 'website', 'report',
  'esg', 'sdg', 'indicator', 'region', 'regions', 'borneo tracker',
];

const DYNAMIC_TERMS = [
  'latest', 'current', 'value', 'values', 'compare', 'comparison', 'trend',
  'highest', 'lowest', 'rank', 'progress', 'news', 'insights', 'sabah',
  'sarawak', 'brunei', 'kalimantan', 'year', '2024', '2025', '2026',
];

const DOMAIN_TERMS = [
  'borneo', 'sabah', 'sarawak', 'brunei', 'kalimantan', 'esg', 'sdg',
  'forest', 'deforestation', 'indicator', 'report', 'source', 'data',
  'news', 'region', 'air quality', 'fire', 'poverty',
];

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

export function classifyIntent(message) {
  const text = message.toLowerCase();
  const inDomain = hasAny(text, DOMAIN_TERMS);
  if (!inDomain) return INTENTS.UNKNOWN;

  const staticMatch = hasAny(text, STATIC_TERMS);
  const dynamicMatch = hasAny(text, DYNAMIC_TERMS);

  if (staticMatch && dynamicMatch) return INTENTS.MIXED;
  if (dynamicMatch) return INTENTS.DYNAMIC_DATA;
  if (staticMatch) return INTENTS.STATIC_KNOWLEDGE;
  return INTENTS.UNKNOWN;
}
