export type AIChatNewsTopic = 'fire' | 'conservation' | 'restoration' | 'peat' | 'biodiversity';

const TOPIC_ALIASES: Record<AIChatNewsTopic, string[]> = {
  fire: [
    'fire',
    'fires',
    'forest fire',
    'forest fires',
    'land fire',
    'land fires',
    'wildfire',
    'wildfires',
    'fire related',
    'fire-related',
    'hotspot',
    'hotspots',
  ],
  conservation: ['conservation', 'pemuliharaan', 'conserve', 'conserving'],
  restoration: ['restoration', 'restore', 'restoring', 'rehabilitation', 'pemulihan'],
  peat: ['peat', 'peatland', 'peatlands', 'gambut'],
  biodiversity: ['biodiversity', 'biodiverse', 'species', 'habitat'],
};

const ALIAS_POLICY =
  'News topics are controlled aliases only. Fire aliases collapse forest/land/wildfire wording into fire; other topics remain distinct.';

type SearchableNewsRecord = {
  title?: unknown;
  summary?: unknown;
  body?: unknown;
  beat?: unknown;
  beatLabel?: unknown;
  beat_label?: unknown;
  sdg?: unknown;
  country?: unknown;
};

export function newsTopicAliasPolicy(): string {
  return ALIAS_POLICY;
}

export function extractNewsTopics(text: string): AIChatNewsTopic[] {
  const normalized = normalizeSearchText(text);
  if (!normalized) return [];

  return dedupe((Object.keys(TOPIC_ALIASES) as AIChatNewsTopic[])
    .filter((topic) => TOPIC_ALIASES[topic].some((alias) => containsAlias(normalized, alias))));
}

export function normalizeNewsTopics(values: readonly string[] | undefined): AIChatNewsTopic[] {
  if (!values?.length) return [];
  return dedupe(values.flatMap((value) => {
    const direct = normalizeTopic(value);
    return direct ? [direct] : extractNewsTopics(value);
  }));
}

export function matchesNewsTopics(record: SearchableNewsRecord, topics: readonly string[] | undefined): boolean {
  const normalizedTopics = normalizeNewsTopics(topics);
  if (!normalizedTopics.length) return true;
  const searchable = searchableText(record);
  return normalizedTopics.every((topic) => TOPIC_ALIASES[topic].some((alias) => containsAlias(searchable, alias)));
}

function normalizeTopic(value: string): AIChatNewsTopic | undefined {
  const normalized = normalizeSearchText(value);
  return (Object.keys(TOPIC_ALIASES) as AIChatNewsTopic[]).find((topic) => topic === normalized);
}

function searchableText(record: SearchableNewsRecord): string {
  return normalizeSearchText([
    record.title,
    record.summary,
    record.body,
    record.beat,
    record.beatLabel,
    record.beat_label,
    record.country,
    ...(Array.isArray(record.sdg) ? record.sdg : []),
  ].filter((value): value is string => typeof value === 'string').join(' '));
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAlias(searchable: string, alias: string): boolean {
  const normalizedAlias = normalizeSearchText(alias);
  if (!normalizedAlias) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(normalizedAlias)}(\\s|$)`).test(searchable);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}
