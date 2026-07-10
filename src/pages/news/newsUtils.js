export const TERRITORY_OPTIONS = ['All Territories', 'Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];
export const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
];

export function formatNewsDate(value) {
  return new Intl.DateTimeFormat('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatRelativeTime(value) {
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

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let duration = diffMs / 1000;

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return formatNewsDate(value);
}

export function truncateText(text, maxLength = 170) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export function matchesNewsSearch(article, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const searchable = [
    article.title,
    article.aiSummary,
    article.territory,
    article.category,
    ...(article.sdgTags || []),
    ...(article.indicatorTags || []),
  ]
    .join(' ')
    .toLowerCase();

  return searchable.includes(normalized);
}
