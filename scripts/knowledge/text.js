export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['"]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

export function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/Â·/g, ' ')
    .replace(/â€¦/g, '...')
    .replace(/â€”/g, '-')
    .replace(/â€“/g, '-')
    .replace(/â€œ|â€�/g, '"')
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function keywordize(parts) {
  const text = normalizeSearchText(parts.filter(Boolean).join(' '));
  const seen = new Set();
  return text
    .split(' ')
    .filter((token) => token.length > 2)
    .filter((token) => {
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    })
    .slice(0, 24);
}

export function stripMarkdown(value) {
  return normalizeWhitespace(
    String(value || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^\s*\|.*\|\s*$/gm, ' ')
      .replace(/[#>*_-]+/g, ' ')
  );
}

export function hasSecretLikeText(value) {
  const text = String(value || '');
  return /(sk-[A-Za-z0-9_-]{20,}|BEGIN\s+(RSA|OPENSSH|PRIVATE)\s+KEY|password\s*=|api[_-]?key\s*=\s*[^<\s]|token\s*=\s*[^<\s])/i.test(text);
}

export function hasUnsupportedNumericalClaim(value) {
  return /\b\d+(?:\.\d+)?\s*(?:%|usd|rm|hectares?|ha|km2|aqi|count|score|people|households?|students?|beds?)\b/i.test(String(value || ''));
}
