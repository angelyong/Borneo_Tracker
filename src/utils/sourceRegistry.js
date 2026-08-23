export const CADENCE_DAYS = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  annual: 365,
};

export function safeOfficialUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function registrySources(payload) {
  const sources = Array.isArray(payload?.sources) ? payload.sources : [];
  return [...sources]
    .filter((source) => source && typeof source.source_id === 'string' && typeof source.display_name === 'string')
    .sort((left, right) => left.display_name.localeCompare(right.display_name));
}
