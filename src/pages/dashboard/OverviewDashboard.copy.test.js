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
