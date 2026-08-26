import { describe, expect, it } from 'vitest';

import {
  LAYER_CONFIG,
  LAYER_GROUPS,
  buildDistrictChoropleth,
  districtIdentity,
  getDistrictLayerRows,
  getLayerRows,
  hasDistrictFallbackLayer,
  layerColorScale,
  layerComparability,
  shouldPreserveMapForNoBoundary,
} from './useIndicators';

describe('map layer score rows', () => {
  const resilience = {
    generatedAt: '2026-08-17',
    territories: {
      Sabah: {
        index: 72.1,
        pillarScores: {
          Food: 28.6,
          Energy: 98.5,
        },
      },
      Sarawak: {
        index: 79.3,
        pillarScores: {
          Food: 58,
          Energy: 98.1,
        },
      },
      Brunei: {
        index: 78,
        pillarScores: {
          Food: 7.9,
          Energy: 100,
          Education: 90.2,
        },
      },
      Kalimantan: {
        index: 67.7,
        pillarScores: {
          Food: 77.9,
          Energy: 99.3,
          Education: 51.3,
        },
      },
    },
  };

  it('builds the 7 score-based layer rows from resilience.json', () => {
    const rows = getLayerRows([], 'resilience', resilience);

    expect(rows).toHaveLength(4);
    expect(rows.map((entry) => entry.territory)).toEqual(['Sabah', 'Sarawak', 'Brunei', 'Kalimantan']);
    expect(rows[0].row).toMatchObject({
      indicator: 'Resilience',
      value: 72.1,
      unit: '/100',
      source: 'resilience.json',
      year: '2026-08-17',
    });
  });

  it('keeps unscored pillar territories as explicit no-data rows', () => {
    const rows = getLayerRows([], 'education', resilience);

    expect(rows.find((entry) => entry.territory === 'Sabah').row).toBeNull();
    expect(rows.find((entry) => entry.territory === 'Sarawak').row).toBeNull();
    expect(rows.find((entry) => entry.territory === 'Brunei').row.value).toBe(90.2);
  });
});

describe('map layer color scales', () => {
  it('uses absolute 0-100 thresholds for score layers', () => {
    const colorForScore = layerColorScale([], 'resilience');

    expect(colorForScore(70)).toBe('#16a34a');
    expect(colorForScore(40)).toBe('#f59e0b');
    expect(colorForScore(39.9)).toBe('#dc2626');
    expect(colorForScore(null)).toBe('#cbd5e1');
  });

  it('keeps existing indicator layers on their relative min/max scale', () => {
    const colorForForest = layerColorScale(
      [
        { territory: 'Sabah', row: { value: 10 } },
        { territory: 'Sarawak', row: { value: 20 } },
        { territory: 'Brunei', row: { value: 30 } },
      ],
      'forestCover'
    );

    expect(colorForForest(30)).toBe('#16a34a');
    expect(colorForForest(20)).toBe('#f59e0b');
    expect(colorForForest(10)).toBe('#dc2626');
  });
});

describe('map layer grouping and district fallbacks', () => {
  it('groups every map layer exactly once for the picker', () => {
    const groupedLayers = LAYER_GROUPS.flatMap((group) => group.layers);

    expect(new Set(groupedLayers).size).toBe(groupedLayers.length);
    expect(groupedLayers).toEqual(Object.keys(LAYER_CONFIG));
    expect(LAYER_GROUPS.map((group) => group.key)).toEqual(['scores', 'environment', 'society']);
  });

  it('uses raw education and healthcare district indicators only for deliberate score fallbacks', () => {
    const districtRows = [
      {
        parent: 'Kalimantan Barat',
        key: 'sambas',
        territory: 'Sambas',
        canonical: 1,
        dashboard_concept: 'education',
        indicator: 'Mean years schooling (RLS)',
        value: 7,
        unit: 'years',
      },
      {
        parent: 'Kalimantan Barat',
        key: 'landak',
        territory: 'Landak',
        canonical: 1,
        dashboard_concept: 'healthcare',
        indicator: 'Life expectancy',
        value: 69.08,
        unit: 'years',
      },
    ];

    expect(hasDistrictFallbackLayer('education')).toBe(true);
    expect(hasDistrictFallbackLayer('healthcare')).toBe(true);
    expect(hasDistrictFallbackLayer('food')).toBe(false);
    expect(getDistrictLayerRows(districtRows, 'Kalimantan Barat', 'education')).toHaveLength(1);
    expect(getDistrictLayerRows(districtRows, 'Kalimantan Barat', 'healthcare')).toHaveLength(1);
    expect(getDistrictLayerRows(districtRows, 'Kalimantan Barat', 'food')).toEqual([]);
  });

  it('does not color district polygons for territory-only score layers', () => {
    const choropleth = buildDistrictChoropleth(
      [
        {
          parent: 'Kalimantan Barat',
          key: 'sambas',
          territory: 'Sambas',
          canonical: 1,
          dashboard_concept: 'education',
          value: 7,
        },
      ],
      'food'
    );

    expect(choropleth.colorFor('Kalimantan Barat', 'sambas')).toBeNull();
  });

  it('keeps same district keys in different parents separate in the choropleth', () => {
    const choropleth = buildDistrictChoropleth(
      [
        {
          parent: 'Sabah',
          key: 'shared-key',
          territory: 'Sabah district',
          canonical: 1,
          dashboard_concept: 'deforestation',
          value: 10,
        },
        {
          parent: 'Sarawak',
          key: 'shared-key',
          territory: 'Sarawak district',
          canonical: 1,
          dashboard_concept: 'deforestation',
          value: 90,
        },
      ],
      'deforestation'
    );

    expect(districtIdentity('Sabah', 'shared-key')).not.toBe(districtIdentity('Sarawak', 'shared-key'));
    expect(choropleth.rowFor('Sabah', 'shared-key')?.territory).toBe('Sabah district');
    expect(choropleth.rowFor('Sarawak', 'shared-key')?.territory).toBe('Sarawak district');
    expect(choropleth.colorFor('Sabah', 'shared-key')).toBe('#16a34a');
    expect(choropleth.colorFor('Sarawak', 'shared-key')).toBe('#dc2626');
  });
});

describe('district boundary map focus', () => {
  it('preserves the current view only for a no-boundary selection in the same parent', () => {
    expect(
      shouldPreserveMapForNoBoundary({
        boundaryUnavailable: true,
        enteringDistrict: false,
        parentChanged: false,
      })
    ).toBe(true);
  });

  it('returns to the Borneo overview when a no-boundary selection changes parent', () => {
    expect(
      shouldPreserveMapForNoBoundary({
        boundaryUnavailable: true,
        enteringDistrict: false,
        parentChanged: true,
      })
    ).toBe(false);
    expect(
      shouldPreserveMapForNoBoundary({
        boundaryUnavailable: true,
        enteringDistrict: true,
        parentChanged: false,
      })
    ).toBe(false);
  });
});

describe('layerComparability', () => {
  const entry = (territory, value, unit) => ({ territory, row: { territory, value, unit } });

  it('refuses to rank a layer whose territories report different units', () => {
    // The live defect: Brunei publishes forest cover as "% land" while the
    // other three publish forest extent in "ha". On a relative ramp that ranks
    // the most-forested territory in Borneo last.
    const entries = [
      entry('Brunei', 72.1, '% land'),
      entry('Sabah', 6684138, 'ha'),
      entry('Sarawak', 11643005, 'ha'),
      entry('Kalimantan', 49925040, 'ha'),
    ];

    const verdict = layerComparability(entries, 'forestCover');
    expect(verdict.rankable).toBe(false);
    expect(verdict.reason).toBe('unitMismatch');
    expect(verdict.units).toEqual(['% land', 'ha']);

    // And the scale must not paint a ranking.
    const color = layerColorScale(entries, 'forestCover');
    const painted = entries.map((item) => color(item.row.value));
    expect(new Set(painted).size).toBe(1);
    expect(painted).not.toContain('#16a34a');
    expect(painted).not.toContain('#dc2626');
  });

  it('still ranks a declared national-definition mismatch, but flags it', () => {
    // Malaysia's absolute poverty line and Indonesia's P0 line are both "%",
    // so no unit check can catch this — it has to be declared.
    const entries = [
      entry('Sabah', 17.7, '%'),
      entry('Sarawak', 8.4, '%'),
      entry('Kalimantan', 4.73, '%'),
    ];

    const verdict = layerComparability(entries, 'poverty');
    expect(verdict.rankable).toBe(true);
    expect(verdict.reason).toBe('nationalDefinitions');

    const color = layerColorScale(entries, 'poverty');
    expect(color(17.7)).not.toBe(color(4.73));
  });

  it('reports nothing to disclose for a single-unit layer', () => {
    const entries = [entry('Sabah', 120, 'count'), entry('Sarawak', 90, 'count')];
    const verdict = layerComparability(entries, 'fireHotspots');
    expect(verdict).toEqual({ rankable: true, reason: null, units: ['count'] });
  });

  it('tolerates missing rows and unknown layers without inventing a verdict', () => {
    expect(layerComparability([{ territory: 'Sabah', row: null }], 'poverty').units).toEqual([]);
    expect(layerComparability([], 'notALayer').rankable).toBe(false);
  });
});
