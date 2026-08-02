import { keywordize, normalizeSearchText, normalizeWhitespace, slugify } from './text.js';

const PAGE_URL_BY_CATEGORY = {
  'site-overview': '/about',
  dashboard: '/',
  regional: '/regions',
  regions: '/regions',
  'esg-indicators': '/esg',
  environmental: '/esg',
  esg: '/esg',
  'sdg-progress': '/sdg',
  sdg: '/sdg',
  'data-sources': '/data-sources',
  'generate-report': '/reports',
  'website-usage': '/about',
  faq: '/about',
  policies: '/data-policy',
  methodology: '/about',
  reports: '/reports',
  news: '/news',
  community: '/community',
};

function arrayFrom(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function detectStatus(raw, content) {
  if (raw.status) return raw.status;
  const text = `${raw.title || ''} ${content}`.toLowerCase();
  if (
    text.includes('placeholder content') ||
    text.includes('placeholder definition') ||
    text.includes('placeholder answer') ||
    text.includes('replace with approved') ||
    text.includes('replace with final') ||
    text.includes('not final legal advice') ||
    text.includes('mock content')
  ) {
    return 'placeholder';
  }
  if (text.includes('mock privacy policy') || text.includes('mock terms') || text.includes('mock data policy')) {
    return 'incomplete';
  }
  return 'verified';
}

export class KnowledgeRecordNormalizer {
  normalize(raw, source) {
    const title = normalizeWhitespace(raw.title || source.id);
    const content = normalizeWhitespace(raw.content || raw.body || raw.description || '');
    const sourceCategory = normalizeWhitespace(raw.category || source.category || 'site-overview');
    const category = sourceCategory === 'site' ? 'site-overview' : sourceCategory;
    const status = detectStatus(raw, content);
    const language = raw.language || source.language || 'en';
    const idBase = raw.id || `${source.id}-${language}-${category}-${title}`;
    const regions = arrayFrom(raw.regions || raw.region);
    const region = raw.region || regions[0] || null;
    const relatedSdgs = arrayFrom(raw.sdgTags || raw.relatedSdgs);
    const concept = raw.concept || raw.dashboardConcept || null;
    const keywords = Array.isArray(raw.keywords) && raw.keywords.length
      ? raw.keywords
      : keywordize([title, category, content, regions.join(' '), relatedSdgs.join(' '), concept || '']);
    const searchableText = normalizeSearchText([
      title,
      category,
      content,
      keywords.join(' '),
      regions.join(' '),
      relatedSdgs.join(' '),
      concept || '',
    ].join(' '));
    const pageUrl = raw.pageUrl || source.pageUrl || PAGE_URL_BY_CATEGORY[category] || '/about';
    const provenance = {
      sourceFile: source.repoPath,
      sourceType: raw.sourceType || source.type,
      sourceId: source.id,
      sourceName: raw.sourceName || source.name || 'Borneo Tracker',
      sourceUrl: raw.sourceUrl || '',
      pageUrl,
      route: raw.route || source.route || pageUrl,
      language,
      sourcePath: raw.sourcePath || raw.translationKey || null,
      extractedAt: null,
    };

    return {
      id: slugify(idBase),
      title,
      category,
      content,
      language,
      pageUrl,
      region,
      concept,
      sdgTags: relatedSdgs,
      keywords,
      regions,
      relatedSdgs,
      unit: raw.unit ?? null,
      sourceName: provenance.sourceName,
      sourceUrl: provenance.sourceUrl,
      sourceFile: source.repoPath,
      sourceType: provenance.sourceType,
      sourceId: source.id,
      sourcePath: provenance.sourcePath,
      sourceTypeDetail: raw.sourceTypeDetail || null,
      updatedAt: raw.updatedAt || null,
      status,
      placeholder: status === 'placeholder' || status === 'incomplete',
      runtimeIncluded: status === 'verified',
      provenance,
      searchableText,
    };
  }
}
