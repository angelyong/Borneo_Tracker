// BT-25: i18n key parity check, plural-aware.
//
// A naive "flatten both locale files and diff the key sets" check would
// permanently red-flag every Intl.PluralRules `_one` key, because Malay's
// plural rules have no "one" category (English does) — so en.json correctly
// has keys like `news.articlesCount_one` that ms.json correctly does not.
// This test strips plural suffixes using each locale's ACTUAL
// Intl.PluralRules categories before comparing, so it only fails on a
// genuinely missing translation, never on a correct plural-category absence.
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ms from '../locales/ms.json';

const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out[path] = value;
    }
  }
  return out;
}

function stripPluralSuffix(key) {
  const suffix = PLURAL_SUFFIXES.find((candidate) => key.endsWith(candidate));
  return suffix ? key.slice(0, -suffix.length) : key;
}

function pluralCategoriesFor(locale) {
  return new Set(new Intl.PluralRules(locale).resolvedOptions().pluralCategories);
}

describe('i18n key parity (en.json vs ms.json), plural-suffix aware', () => {
  const enFlat = flatten(en);
  const msFlat = flatten(ms);
  const enKeys = Object.keys(enFlat);
  const msKeys = Object.keys(msFlat);
  const enKeySet = new Set(enKeys);
  const msKeySet = new Set(msKeys);

  const enCategories = pluralCategoriesFor('en');
  const msCategories = pluralCategoriesFor('ms');

  // Sanity-check the environment's own CLDR data matches what this test's
  // logic assumes — if this ever fails, the stripping logic below needs
  // revisiting, not just the locale files.
  it('en has an "one" plural category and ms does not (CLDR assumption this test relies on)', () => {
    expect(enCategories.has('one')).toBe(true);
    expect(msCategories.has('one')).toBe(false);
  });

  function isCorrectlyAbsentPlural(key, presentIn, missingFrom) {
    const base = stripPluralSuffix(key);
    if (base === key) return false; // not a plural-suffixed key at all
    const suffix = key.slice(base.length + 1); // e.g. "one" from "_one"
    const presentCategories = presentIn === 'en' ? enCategories : msCategories;
    const missingCategories = missingFrom === 'en' ? enCategories : msCategories;
    // Correct absence: the source locale has this plural category, the
    // target locale doesn't — AND the target locale has some form of the
    // same base key (so it isn't missing the whole message, just this one
    // grammatical variant of it).
    if (!presentCategories.has(suffix) || missingCategories.has(suffix)) return false;
    const targetKeys = missingFrom === 'en' ? enKeySet : msKeySet;
    return [...targetKeys].some((k) => stripPluralSuffix(k) === base);
  }

  it('every en.json key has a real ms.json counterpart (missing plural categories aside)', () => {
    const missing = enKeys.filter((key) => {
      if (msKeySet.has(key)) return false;
      return !isCorrectlyAbsentPlural(key, 'en', 'ms');
    });
    expect(missing).toEqual([]);
  });

  it('every ms.json key has a real en.json counterpart (no orphaned Malay-only keys)', () => {
    const missing = msKeys.filter((key) => {
      if (enKeySet.has(key)) return false;
      return !isCorrectlyAbsentPlural(key, 'ms', 'en');
    });
    expect(missing).toEqual([]);
  });

  it('documents the current key counts and confirms the only en/ms gap is the expected _one-category difference', () => {
    const enOneKeys = enKeys.filter((k) => k.endsWith('_one'));
    const msOneKeys = msKeys.filter((k) => k.endsWith('_one'));

    // Every en `_one` key must have a corresponding `_other` (or bare) form
    // in ms — i.e. the ONLY reason en has more leaf keys than ms is the
    // extra plural category, not a real missing translation.
    for (const key of enOneKeys) {
      const base = stripPluralSuffix(key);
      const hasMsCounterpart = msKeys.some((k) => stripPluralSuffix(k) === base);
      expect(hasMsCounterpart, `expected ms.json to have some form of "${base}"`).toBe(true);
    }

    expect(enOneKeys.length).toBeGreaterThan(0);
    expect(enKeys.length - msKeys.length).toBe(enOneKeys.length - msOneKeys.length);
  });
});
