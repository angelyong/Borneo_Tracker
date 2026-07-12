// Kept self-contained (not imported from the News feature's newsUtils.js)
// so the Community feature has no cross-feature coupling and can be moved,
// reused, or deleted independently.

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

  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function truncateText(text, maxLength = 220) {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

export function matchesCommunitySearch(post, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const searchable = [post.title, post.body, post.topic, post.territory, post.author]
    .join(' ')
    .toLowerCase();

  return searchable.includes(normalized);
}

export function initialOf(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

/** A shareable link to this post — the page reads `?post=<id>` on load and scrolls to it. */
export function buildPostShareUrl(postId) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('post', postId);
  return url.toString();
}
