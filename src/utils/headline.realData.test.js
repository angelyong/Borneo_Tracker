// BT-26 (Card 9a): buildHeadline against the real committed resilience.json
// for all 5 dashboard scopes (All-Borneo aggregate + 4 territories), in both
// supported languages. headline.test.js already covers buildHeadline's own
// key/values selection logic against synthetic fixtures — this file is the
// complementary "does it actually render a real, translated sentence for
// real data" check the card asks for, using the app's real i18next instance
// so a missing/renamed translation key would fail here even if the pure
// logic tests above still passed.
import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { buildHeadline } from './headline';
import { buildAggregateResilience } from './resiliencePresentation';
import resilience from '../../public/data/resilience.json';

const TERRITORIES = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];

function renderHeadline(headline) {
  return i18n.t(headline.key, {
    ...headline.values,
    rag: headline.values.rag ? i18n.t(`dashboard.ragBand_${headline.values.rag}`) : undefined,
    weakestPillar: headline.values.weakestPillar
      ? i18n.t(`dashboard.pillars.${headline.values.weakestPillar}`, { defaultValue: headline.values.weakestPillar })
      : undefined,
  });
}

describe('buildHeadline — all 5 real scopes, both languages', () => {
  const thresholds = resilience.ragThresholds || { green: 70, amber: 40 };

  for (const language of ['en', 'ms']) {
    describe(`language: ${language}`, () => {
      it('renders a real, non-empty, non-missing-key sentence for the All-Borneo aggregate', async () => {
        await i18n.changeLanguage(language);
        const aggregate = buildAggregateResilience(resilience.territories, thresholds);
        const headline = buildHeadline(aggregate);
        const text = renderHeadline(headline);

        expect(text).not.toBe(headline.key);
        expect(text.length).toBeGreaterThan(0);
        expect(text).toContain(String(aggregate.index));
      });

      for (const territory of TERRITORIES) {
        it(`renders a real, non-empty, non-missing-key sentence for ${territory}`, async () => {
          await i18n.changeLanguage(language);
          const scope = resilience.territories[territory];
          const headline = buildHeadline(scope);
          const text = renderHeadline(headline);

          expect(text).not.toBe(headline.key);
          expect(text.length).toBeGreaterThan(0);
          if (Number.isFinite(scope.index)) {
            expect(text).toContain(String(scope.index));
          }
        });
      }
    });
  }

  it('falls back to the honest "unavailable" headline for a scope with no index, in both languages', async () => {
    for (const language of ['en', 'ms']) {
      await i18n.changeLanguage(language);
      const headline = buildHeadline({ index: null });
      const text = renderHeadline(headline);
      expect(headline.key).toBe('dashboard.headline.unavailable');
      expect(text).not.toBe(headline.key);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});
