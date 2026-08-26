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

  it('gives the all-Borneo drill-down the rows behind the average', () => {
    const source = readFileSync(resolve(root, 'src/pages/dashboard/OverviewDashboard.jsx'), 'utf8');
    const en = readJson('src/i18n/locales/en.json');
    const ms = readJson('src/i18n/locales/ms.json');

    // Client §3.4 asks to drill into the underlying indicators, and the
    // Dashboard opens on the aggregate scope — which used to return [].
    expect(source).not.toContain('const drilldownIndicators = !isDistrict && !isOverall');
    expect(source).toContain('TERRITORIES.flatMap((territory)');
    expect(source).toContain('contributors={drilldownContributors}');
    // A territory with no score for the pillar must contribute no rows.
    expect(source).toContain("if (!Number.isFinite(entry?.pillarScores?.[drilldownPillar])) return [];");

    // `count` is reserved by i18next for plural resolution; Malay has only
    // `other`, so the method line must not use it as a token.
    expect(en.pillarDrilldown.aggregateMethod).toContain('{{territories}}');
    expect(en.pillarDrilldown.aggregateMethod).not.toContain('{{count}}');
    expect(ms.pillarDrilldown.aggregateMethod).toContain('{{territories}}');
  });

  it('discloses when a map layer cannot be ranked across territories', () => {
    const source = readFileSync(resolve(root, 'src/pages/dashboard/OverviewDashboard.jsx'), 'utf8');
    const indicators = readFileSync(resolve(root, 'src/data/useIndicators.js'), 'utf8');
    const en = readJson('src/i18n/locales/en.json');
    const ms = readJson('src/i18n/locales/ms.json');

    expect(source).toContain('layerComparability(layerEntries, activeLayer)');
    expect(source).toContain("t('dashboard.layerNotComparableUnits'");
    expect(source).toContain("t('dashboard.layerNationalDefinitions')");

    // Poverty is the same unit on both sides of the border, so the mismatch
    // has to be declared rather than detected.
    expect(indicators).toContain('crossBorderDefinitions: true');

    expect(en.dashboard.layerNotComparableUnits).toContain('{{units}}');
    expect(ms.dashboard.layerNotComparableUnits).toContain('{{units}}');
    expect(ms.dashboard.layerNationalDefinitions).toBeTruthy();
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
