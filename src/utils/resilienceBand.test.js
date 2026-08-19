import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import ms from '../i18n/locales/ms.json';
import { bandLabelKeyForRag } from './resilienceBand';

describe('resilience band labels', () => {
  it('maps existing RAG statuses to bare dashboard band label keys', () => {
    expect(bandLabelKeyForRag('green')).toBe('dashboard.bandGood');
    expect(bandLabelKeyForRag('amber')).toBe('dashboard.bandModerate');
    expect(bandLabelKeyForRag('red')).toBe('dashboard.bandPoor');
  });

  it('does not invent a band for missing or unknown scores', () => {
    expect(bandLabelKeyForRag()).toBeNull();
    expect(bandLabelKeyForRag(null)).toBeNull();
    expect(bandLabelKeyForRag('unknown')).toBeNull();
  });

  it('uses bare English and Malay band words, separate from threshold-copy strings', () => {
    expect(en.dashboard.bandGood).toBe('Good');
    expect(en.dashboard.bandModerate).toBe('Moderate');
    expect(en.dashboard.bandPoor).toBe('Poor');

    expect(ms.dashboard.bandGood).toBe('Baik');
    expect(ms.dashboard.bandModerate).toBe('Sederhana');
    expect(ms.dashboard.bandPoor).toBe('Lemah');
  });
});
