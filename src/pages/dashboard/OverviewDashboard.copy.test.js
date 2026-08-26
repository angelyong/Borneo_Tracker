import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

describe('OverviewDashboard weakest-link copy', () => {
  it('reuses the existing About resilience-by-pillar translation key', () => {
    const source = readFileSync(resolve(root, 'src/pages/dashboard/OverviewDashboard.jsx'), 'utf8');
    const en = readJson('src/i18n/locales/en.json');
    const ms = readJson('src/i18n/locales/ms.json');

    expect(source).toContain("'about.resilienceByPillarBody'");
    expect(en.about.resilienceByPillarBody).toBeTruthy();
    expect(ms.about.resilienceByPillarBody).toBeTruthy();
  });

  it('explains the Strict score where the Strict score is shown', () => {
    const source = readFileSync(resolve(root, 'src/pages/dashboard/OverviewDashboard.jsx'), 'utf8');
    const en = readJson('src/i18n/locales/en.json');
    const ms = readJson('src/i18n/locales/ms.json');

    // Client §1.2: an unexplained secondary metric costs credibility, and the
    // Dashboard is where both scores appear together.
    const strictIndex = source.indexOf("t('dashboard.strictTrueResilience')");
    const explainerIndex = source.indexOf('<ScoreExplainer labelKey="scoreExplainer.strictOpenLabel" />');
    expect(strictIndex).toBeGreaterThan(-1);
    expect(explainerIndex).toBeGreaterThan(strictIndex);
    expect(en.scoreExplainer.strictOpenLabel).toBeTruthy();
    expect(ms.scoreExplainer.strictOpenLabel).toBeTruthy();
    expect(en.scoreExplainer.title).toBe('Why are these scores different?');
  });

  it('states the weakest-link principle as a claim under the radar', () => {
    const source = readFileSync(resolve(root, 'src/pages/dashboard/OverviewDashboard.jsx'), 'utf8');
    const en = readJson('src/i18n/locales/en.json');
    const ms = readJson('src/i18n/locales/ms.json');

    expect(source).toContain("principle={t('dashboard.weakestLinkPrinciple')}");
    expect(en.dashboard.weakestLinkPrinciple).toBe(
      'Resilience is only as strong as its weakest essential pillar.'
    );
    expect(ms.dashboard.weakestLinkPrinciple).toBeTruthy();
  });

  it('groups the map layers and states the active one as a question', () => {
    const source = readFileSync(resolve(root, 'src/pages/dashboard/OverviewDashboard.jsx'), 'utf8');
    const en = readJson('src/i18n/locales/en.json');
    const ms = readJson('src/i18n/locales/ms.json');

    // Client §3.3: switching layers has to answer "where is the problem?".
    expect(source).toContain('LAYER_GROUPS.map((group)');
    expect(source).toContain('t(LAYER_CONFIG[activeLayer].captionKey)');
    expect(source).toContain('t(LAYER_CONFIG[activeLayer].directionKey)');
    // The old picker derived its labels from the object key, bypassing the
    // config and the locales entirely.
    expect(source).not.toContain("key.replace(/([A-Z])/g, ' $1')");

    Object.keys(en.dashboard.layerLabels).forEach((key) => {
      expect(en.dashboard.layerCaptions[key], `${key} caption`).toBeTruthy();
      expect(ms.dashboard.layerLabels[key], `${key} label (ms)`).toBeTruthy();
      expect(ms.dashboard.layerCaptions[key], `${key} caption (ms)`).toBeTruthy();
    });
    expect(en.dashboard.layerCaptions.deforestation).toBe('Where is tree-cover loss highest?');
  });

  it('shows the score, its direction and the biggest movers as one sequence', () => {
    const source = readFileSync(resolve(root, 'src/pages/dashboard/OverviewDashboard.jsx'), 'utf8');

    // Client §4.2 asked for score -> direction -> "then" the biggest positive
    // and negative changes, so the movers list must not be gated to a scope
    // that excludes the delta.
    const badge = source.indexOf('<MomentumBadge momentum={momentum}');
    const summary = source.indexOf('<MomentumSummary summary={movementCounts}');
    const moversRow = source.indexOf('<MomentumMovers movers={movers}');
    expect(badge).toBeGreaterThan(-1);
    expect(summary).toBeGreaterThan(badge);
    expect(moversRow).toBeGreaterThan(summary);
    expect(source).toContain('(isDistrict || !resilienceHistory?.territories ? null : biggestMovers(resilienceHistory))');
  });

  it('feeds the district radar coverage that distinguishes missing from zero', () => {
    const source = readFileSync(resolve(root, 'src/pages/dashboard/OverviewDashboard.jsx'), 'utf8');
    const en = readJson('src/i18n/locales/en.json');
    const ms = readJson('src/i18n/locales/ms.json');

    // getHexagonCoverage is a counter and returns 0 for "no rows", which is
    // correct there; the radar must not receive those zeros as scored axes.
    expect(source).toContain('count > 0 ? count : null');
    expect(source).toContain('pillars={districtCoverageAxes}');
    expect(source).toContain('max={districtCoverageMax}');
    expect(source).not.toContain('<HexRadar pillars={hexCoverage} />');

    // The accessible label must not call indicator counts "scores".
    expect(en.dashboard.districtCoverageAria).toContain('not resilience scores');
    expect(en.dashboard.districtCoverageAria).toContain('{{scope}}');
    expect(ms.dashboard.districtCoverageAria).toContain('{{scope}}');
    expect(ms.dashboard.districtCoverageIncomplete).toBeTruthy();
  });

  it('passes the active artifact to the trust-chain popover', () => {
    const source = readFileSync(resolve(root, 'src/pages/dashboard/OverviewDashboard.jsx'), 'utf8');

    expect(source).toContain('artifact={isDistrict ? districtData : data}');
  });

  it('keeps district no-data copy interpolated and exposes an honest no-boundary state in both languages', () => {
    const source = readFileSync(resolve(root, 'src/pages/dashboard/OverviewDashboard.jsx'), 'utf8');
    const en = readJson('src/i18n/locales/en.json');
    const ms = readJson('src/i18n/locales/ms.json');

    expect(source).toContain("districtBoundaryUnavailable");
    expect(source).toContain('boundaryUnavailable={selectedDistrictBoundaryUnavailable}');
    expect(source).toContain('district,\n                  parent: districtParent');
    expect(en.dashboard.districtBoundaryUnavailable).toContain('{{district}}');
    expect(en.dashboard.districtBoundaryUnavailable).toContain('{{parent}}');
    expect(ms.dashboard.districtBoundaryUnavailable).toContain('{{district}}');
    expect(ms.dashboard.districtBoundaryUnavailable).toContain('{{parent}}');
  });
});
