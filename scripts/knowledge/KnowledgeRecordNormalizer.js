import { keywordize, normalizeSearchText, normalizeWhitespace, slugify } from './text.js';

const PAGE_URL_BY_CATEGORY = {
  'site-overview': '/about',
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
};

export class KnowledgeRecordNormalizer {
  normalize(raw, source) {
    const title = normalizeWhitespace(raw.title || source.id);
    const content = normalizeWhitespace(raw.content || raw.body || raw.description || '');
    const sourceCategory = normalizeWhitespace(raw.category || source.category || 'site-overview');
    const category = sourceCategory === 'site' ? 'site-overview' : sourceCategory;
    const status = raw.status || (content.toLowerCase().includes('placeholder content') || content.toLowerCase().includes('placeholder definition') ? 'placeholder' : 'verified');
    const idBase = raw.id || `${source.id}-${category}-${title}`;
    const regions = Array.isArray(raw.regions) ? raw.regions : [];
    const relatedSdgs = Array.isArray(raw.relatedSdgs) ? raw.relatedSdgs : [];
    const keywords = Array.isArray(raw.keywords) && raw.keywords.length
      ? raw.keywords
      : keywordize([title, category, content, regions.join(' '), relatedSdgs.join(' ')]);
    const searchableText = normalizeSearchText([
      title,
      category,
      content,
      keywords.join(' '),
      regions.join(' '),
      relatedSdgs.join(' '),
    ].join(' '));

    return {
      id: slugify(idBase),
      title,
      category,
      content,
      keywords,
      regions,
      relatedSdgs,
      unit: raw.unit ?? null,
      sourceName: raw.sourceName || 'Borneo Tracker',
      sourceUrl: raw.sourceUrl || '',
      pageUrl: raw.pageUrl || PAGE_URL_BY_CATEGORY[category] || '/about',
      sourceFile: source.repoPath,
      sourceType: source.type,
      updatedAt: raw.updatedAt || null,
      status,
      searchableText,
    };
  }
}
