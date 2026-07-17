export const TERRITORY_OPTIONS = ['All Territories', 'Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];
export const COUNTRY_OPTIONS = ['All Countries', 'Malaysia', 'Brunei', 'Indonesia'];
export const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
];

const COUNTRY_FLAGS = {
  Malaysia: '🇲🇾',
  Brunei: '🇧🇳',
  Indonesia: '🇮🇩',
};

export function formatNewsDate(value, locale = 'en') {
  return new Intl.DateTimeFormat(locale === 'ms' ? 'ms-MY' : 'en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatRelativeTime(value, locale = 'en') {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.345, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ];

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  let duration = diffMs / 1000;

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return formatNewsDate(value, locale);
}

export function truncateText(text, maxLength = 170) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export function formatCountryLabel(country) {
  const flag = COUNTRY_FLAGS[country];
  return flag ? `${flag} ${country}` : country;
}

export function formatSourceCount(count, t) {
  const total = Number(count) || 0;
  return t('news.reportedBySource', { count: total });
}

export function matchesNewsSearch(article, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const searchable = [
    article.title,
    article.body,
    ...(article.territories || []),
    article.beatLabel,
    article.country,
    ...(article.sdg || []),
    ...(article.sources || []).map((source) => source.name),
  ]
    .join(' ')
    .toLowerCase();

  return searchable.includes(normalized);
}
