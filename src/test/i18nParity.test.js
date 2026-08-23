import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en.json';
import ms from '../i18n/locales/ms.json';

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function translationRoots(value, path = '', roots = new Set()) {
  Object.entries(value).forEach(([key, child]) => {
    const nextPath = path ? `${path}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      translationRoots(child, nextPath, roots);
    } else {
      roots.add(nextPath.replace(PLURAL_SUFFIX, ''));
    }
  });
  return roots;
}

function placeholders(value, path = '', entries = new Map()) {
  Object.entries(value).forEach(([key, child]) => {
    const nextPath = path ? `${path}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      placeholders(child, nextPath, entries);
    } else {
      const root = nextPath.replace(PLURAL_SUFFIX, '');
      const tokens = String(child).match(/{{\s*[^}\s]+\s*}}/g) || [];
      const current = entries.get(root) || [];
      current.push(tokens.map((token) => token.replace(/\s/g, '')).sort());
      entries.set(root, current);
    }
  });
  return entries;
}

function pluralCategoriesByRoot(value, path = '', entries = new Map()) {
  Object.entries(value).forEach(([key, child]) => {
    const nextPath = path ? `${path}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      pluralCategoriesByRoot(child, nextPath, entries);
      return;
    }
    const match = nextPath.match(PLURAL_SUFFIX);
    if (!match) return;
    const root = nextPath.replace(PLURAL_SUFFIX, '');
    const categories = entries.get(root) || new Set();
    categories.add(match[1]);
    entries.set(root, categories);
  });
  return entries;
}

function expectedPluralCategories(locale) {
  return new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
}

describe('English and Bahasa Melayu i18n parity', () => {
  it('has the same plural-normalised translation roots in both locales', () => {
    expect(translationRoots(en)).toEqual(translationRoots(ms));
  });

  it('supplies every plural category required by each locale for every plural root', () => {
    const locales = { en, ms };
    Object.entries(locales).forEach(([locale, dictionary]) => {
      const expected = expectedPluralCategories(locale);
      pluralCategoriesByRoot(dictionary).forEach((actual, root) => {
        expect(actual, `${locale}.${root} must define every required plural variant`).toEqual(expected);
      });
    });
  });

  it('uses the same plural roots in English and Bahasa Melayu', () => {
    expect([...pluralCategoriesByRoot(en).keys()].sort()).toEqual([...pluralCategoriesByRoot(ms).keys()].sort());
  });

  it('keeps interpolation placeholders aligned after plural variants are normalised', () => {
    const english = placeholders(en);
    const malay = placeholders(ms);
    expect([...english.keys()].sort()).toEqual([...malay.keys()].sort());
    english.forEach((sets, key) => {
      expect(new Set(sets.map((tokens) => tokens.join('|'))).size, `${key} has inconsistent English plural placeholders`).toBe(1);
      expect(new Set(malay.get(key).map((tokens) => tokens.join('|'))).size, `${key} has inconsistent Malay plural placeholders`).toBe(1);
      expect(malay.get(key)[0], key).toEqual(sets[0]);
    });
  });
});
