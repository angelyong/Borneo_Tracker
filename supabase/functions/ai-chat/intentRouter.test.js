import { describe, expect, it } from 'vitest';
import { routeAiChatIntent } from './intentRouter.ts';

function route(message, options = {}) {
  return routeAiChatIntent(message, { language: 'en', currentPage: '/', region: '', ...options });
}

describe('ai-chat intent router: SITE_KNOWLEDGE', () => {
  it.each([
    ['What is Borneo Tracker?'],
    ['How do I generate a report?'],
    ['Bagaimana menggunakan laman ini?', { language: 'ms' }],
    ['Apakah maksud halaman ESG?', { language: 'ms' }],
  ])('routes %s', (message, options = {}) => {
    const result = route(message, options);
    expect(result.intent).toBe('SITE_KNOWLEDGE');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.matchedTerms.length).toBeGreaterThan(0);
  });
});

describe('ai-chat intent router: DASHBOARD_DATA', () => {
  it.each([
    ["What is Sabah's resilience score?"],
    ['Which pillar is weakest in Sarawak?'],
    ['Compare the energy indicator for Sabah and Brunei.'],
    ['Apakah skor daya tahan Sabah?', { language: 'ms' }],
    ['Penunjuk manakah paling lemah di Sarawak?', { language: 'ms' }],
  ])('routes %s', (message, options = {}) => {
    const result = route(message, options);
    expect(result.intent).toBe('DASHBOARD_DATA');
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('ai-chat intent router: BORNEO_NEWS', () => {
  it.each([
    ['What is the latest conservation news in Sabah?'],
    ['Show recent Borneo reports.'],
    ['Berita terkini mengenai hutan di Sarawak.', { language: 'ms' }],
    ['Ada kemas kini pemuliharaan di Kalimantan?', { language: 'ms' }],
  ])('routes %s', (message, options = {}) => {
    const result = route(message, options);
    expect(result.intent).toBe('BORNEO_NEWS');
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('ai-chat intent router: OUT_OF_SCOPE', () => {
  it.each([
    ['How do I debug this JavaScript promise?'],
    ['Who is the celebrity in that movie?'],
    ['Can you finish my algebra homework?'],
    ['Book a flight and hotel in Tokyo.'],
  ])('routes %s', (message) => {
    const result = route(message);
    expect(result.intent).toBe('OUT_OF_SCOPE');
  });
});

describe('ai-chat intent router edge cases', () => {
  it('does not let currentPage override explicit site-help wording', () => {
    const result = route('How do I generate a report?', { currentPage: '/news' });
    expect(result.intent).toBe('SITE_KNOWLEDGE');
    expect(result.reasons.some((reason) => reason.includes('weak context'))).toBe(false);
  });

  it('does not let selected region alone force dashboard data', () => {
    const result = route('Hello there', { region: 'Sabah' });
    expect(result.intent).toBe('OUT_OF_SCOPE');
  });

  it('avoids substring false positives', () => {
    const result = route('Can you explain quarterly articles about design?');
    expect(result.intent).toBe('OUT_OF_SCOPE');
    expect(result.matchedTerms).not.toContain('art');
  });

  it('normalizes punctuation, case, and apostrophes', () => {
    const result = route("WHAT'S SABAH'S RESILIENCE SCORE???");
    expect(result.intent).toBe('DASHBOARD_DATA');
  });

  it('handles empty or whitespace questions', () => {
    const result = route('   ');
    expect(result.intent).toBe('OUT_OF_SCOPE');
    expect(result.reasons).toContain('empty question');
  });

  it('returns strongest supported intent and ambiguity reason for dashboard plus news terms', () => {
    const result = route("Latest news about Sabah's resilience score?");
    expect(result.intent).toBe('DASHBOARD_DATA');
    expect(result.reasons).toContain('ambiguous dashboard/news signals; mixed intent deferred');
    expect(result.matchedTerms).toEqual(expect.arrayContaining(['latest news', 'resilience score']));
  });

  it('routes English and Malay mixed wording', () => {
    const result = route('Latest berita terkini about Sarawak forest', { language: 'en' });
    expect(result.intent).toBe('BORNEO_NEWS');
    expect(result.language).toBe('ms');
  });
});
