import { useEffect, useState } from 'react';

export const TERRITORIES = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];

// Region-mode fill: the district/boundary GeoJSON is keyed by province (`parent`),
// but the Overview map colours the 4 top-level territories. Kalimantan is split
// across 5 Indonesian provinces, so they all roll up to one "Kalimantan".
export const PROVINCE_TO_TERRITORY = {
  Sabah: 'Sabah',
  Sarawak: 'Sarawak',
  Brunei: 'Brunei',
  'Kalimantan Barat': 'Kalimantan',
  'Kalimantan Selatan': 'Kalimantan',
  'Kalimantan Tengah': 'Kalimantan',
  'Kalimantan Timur': 'Kalimantan',
  'Kalimantan Utara': 'Kalimantan',
};

// Map a boundary polygon's `parent` (province/state) to its top-level territory.
export function territoryForParent(parent) {
  return PROVINCE_TO_TERRITORY[parent] || parent || null;
}

export const CATEGORY_TO_PILLAR = {
  Environment: 'E',
  Social: 'S',
  Governance: 'G',
};

export const LAYER_GROUPS = [
  { key: 'scores', labelKey: 'dashboard.layerGroupScores', layers: ['resilience', 'food', 'energy', 'healthcare', 'education', 'shelter', 'entertainment'] },
  { key: 'environment', labelKey: 'dashboard.layerGroupEnvironment', layers: ['forestCover', 'deforestation', 'airQuality', 'fireHotspots'] },
  { key: 'society', labelKey: 'dashboard.layerGroupSociety', layers: ['poverty'] },
];

export const LAYER_CONFIG = {
  resilience: {
    label: 'Resilience',
    labelKey: 'dashboard.layerLabels.resilience',
    captionKey: 'dashboard.layerCaptions.resilience',
    unitKey: 'dashboard.layerUnits.score',
    directionKey: 'dashboard.layerDirections.higherBetter',
    source: 'resilience',
    scoreKey: 'index',
    better: 'higher',
    scale: 'absolute',
  },
  food: {
    label: 'Food',
    labelKey: 'dashboard.layerLabels.food',
    captionKey: 'dashboard.layerCaptions.food',
    unitKey: 'dashboard.layerUnits.score',
    directionKey: 'dashboard.layerDirections.higherBetter',
    source: 'resilience',
    pillar: 'Food',
    better: 'higher',
    scale: 'absolute',
  },
  energy: {
    label: 'Energy',
    labelKey: 'dashboard.layerLabels.energy',
    captionKey: 'dashboard.layerCaptions.energy',
    unitKey: 'dashboard.layerUnits.score',
    directionKey: 'dashboard.layerDirections.higherBetter',
    source: 'resilience',
    pillar: 'Energy',
    better: 'higher',
    scale: 'absolute',
  },
  healthcare: {
    label: 'Healthcare',
    labelKey: 'dashboard.layerLabels.healthcare',
    captionKey: 'dashboard.layerCaptions.healthcare',
    unitKey: 'dashboard.layerUnits.score',
    directionKey: 'dashboard.layerDirections.higherBetter',
    source: 'resilience',
    pillar: 'Healthcare',
    better: 'higher',
    scale: 'absolute',
    districtFallbackConcept: 'healthcare',
    districtFallbackKey: 'dashboard.districtFallbackHealthcare',
    districtUnitKey: 'dashboard.layerUnits.years',
  },
  education: {
    label: 'Education',
    labelKey: 'dashboard.layerLabels.education',
    captionKey: 'dashboard.layerCaptions.education',
    unitKey: 'dashboard.layerUnits.score',
    directionKey: 'dashboard.layerDirections.higherBetter',
    source: 'resilience',
    pillar: 'Education',
    better: 'higher',
    scale: 'absolute',
    districtFallbackConcept: 'education',
    districtFallbackKey: 'dashboard.districtFallbackEducation',
    districtUnitKey: 'dashboard.layerUnits.years',
  },
  shelter: {
    label: 'Shelter',
    labelKey: 'dashboard.layerLabels.shelter',
    captionKey: 'dashboard.layerCaptions.shelter',
    unitKey: 'dashboard.layerUnits.score',
    directionKey: 'dashboard.layerDirections.higherBetter',
    source: 'resilience',
    pillar: 'Shelter',
    better: 'higher',
    scale: 'absolute',
  },
  entertainment: {
    label: 'Entertainment',
    labelKey: 'dashboard.layerLabels.entertainment',
    captionKey: 'dashboard.layerCaptions.entertainment',
    unitKey: 'dashboard.layerUnits.score',
    directionKey: 'dashboard.layerDirections.higherBetter',
    source: 'resilience',
    pillar: 'Entertainment',
    better: 'higher',
    scale: 'absolute',
  },
  forestCover: {
    label: 'Forest Cover',
    labelKey: 'dashboard.layerLabels.forestCover',
    captionKey: 'dashboard.layerCaptions.forestCover',
    unitKey: 'dashboard.layerUnits.reportedArea',
    directionKey: 'dashboard.layerDirections.higherBetter',
    source: 'indicators',
    concept: 'forest_cover',
    better: 'higher',
    scale: 'relative',
  },
  deforestation: {
    label: 'Deforestation',
    labelKey: 'dashboard.layerLabels.deforestation',
    captionKey: 'dashboard.layerCaptions.deforestation',
    unitKey: 'dashboard.layerUnits.hectares',
    directionKey: 'dashboard.layerDirections.lowerBetter',
    source: 'indicators',
    concept: 'deforestation',
    better: 'lower',
    scale: 'relative',
  },
  airQuality: {
    label: 'Air Quality',
    labelKey: 'dashboard.layerLabels.airQuality',
    captionKey: 'dashboard.layerCaptions.airQuality',
    unitKey: 'dashboard.layerUnits.aqi',
    directionKey: 'dashboard.layerDirections.lowerBetter',
    source: 'indicators',
    concept: 'air_quality',
    better: 'lower',
    scale: 'relative',
  },
  fireHotspots: {
    label: 'Fire Hotspots',
    labelKey: 'dashboard.layerLabels.fireHotspots',
    captionKey: 'dashboard.layerCaptions.fireHotspots',
    unitKey: 'dashboard.layerUnits.count',
    directionKey: 'dashboard.layerDirections.lowerBetter',
    source: 'indicators',
    concept: 'fire_hotspots',
    better: 'lower',
    scale: 'relative',
  },
  poverty: {
    label: 'Poverty',
    labelKey: 'dashboard.layerLabels.poverty',
    captionKey: 'dashboard.layerCaptions.poverty',
    unitKey: 'dashboard.layerUnits.percent',
    directionKey: 'dashboard.layerDirections.lowerBetter',
    source: 'indicators',
    concept: 'poverty',
    better: 'lower',
    scale: 'relative',
  },
};

// `generatedAt` is the top-level date the daily rebuild pipeline stamps into
// each JSON file. It is surfaced alongside the data (never instead of it) so the
// UI can state how old the snapshot is — see components/DataFreshness.jsx.
export function useIndicators() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    generatedAt: null,
  });

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await fetch('/data/indicators.json');
        if (!response.ok) {
          throw new Error(`Failed to load indicators (${response.status})`);
        }
        const payload = await response.json();
        if (!ignore) {
          setState({ data: payload, loading: false, error: null, generatedAt: payload?.generatedAt ?? null });
        }
      } catch (error) {
        if (!ignore) {
          setState({ data: null, loading: false, error: error.message, generatedAt: null });
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return state;
}

export function useResilience() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    generatedAt: null,
  });

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await fetch('/data/resilience.json');
        if (!response.ok) {
          throw new Error(`Failed to load resilience scores (${response.status})`);
        }
        const payload = await response.json();
        if (!ignore) {
          setState({ data: payload, loading: false, error: null, generatedAt: payload?.generatedAt ?? null });
        }
      } catch (error) {
        if (!ignore) {
          setState({ data: null, loading: false, error: error.message, generatedAt: null });
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return state;
}

// Impact Simulator model contract — bounds, indicator->pillar mapping,
// scoring metadata and the per-territory baseline that
// src/utils/resilienceModel.js mirrors client-side. Fetched at runtime
// (same pattern as useResilience() above) rather than statically imported,
// so a missing/broken resilience_model.json surfaces as a normal loading/
// error state on the page instead of a build-time failure — see
// docs/IMPACT_SIMULATOR_SPEC.md §2 and Stage IS-3D's edge-case handling.
export function useResilienceModel() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    generatedAt: null,
  });

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await fetch('/data/resilience_model.json');
        if (!response.ok) {
          throw new Error(`Failed to load resilience model (${response.status})`);
        }
        const payload = await response.json();
        if (!ignore) {
          setState({ data: payload, loading: false, error: null, generatedAt: payload?.generatedAt ?? null });
        }
      } catch (error) {
        if (!ignore) {
          setState({ data: null, loading: false, error: error.message, generatedAt: null });
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return state;
}

// District-level (ADM2) drill-down data — parallel to indicators.json. Rows use
// the district name as `territory`, so all the territory helpers below (
// getCanonicalRows, getRowsForPillar, getHexagonCoverage, summarizeRows…) work
// unchanged when passed a district name.
//
// Its `generatedAt` is deliberately reported separately from the territory data:
// the district build runs on its own (much slower) cadence, so the two dates
// differ and the UI must show whichever one is actually on screen.
export function useDistricts() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    generatedAt: null,
  });

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await fetch('/data/districts.json');
        if (!response.ok) {
          throw new Error(`Failed to load district data (${response.status})`);
        }
        const payload = await response.json();
        if (!ignore) {
          setState({ data: payload, loading: false, error: null, generatedAt: payload?.generatedAt ?? null });
        }
      } catch (error) {
        if (!ignore) {
          setState({ data: null, loading: false, error: error.message, generatedAt: null });
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return state;
}

// District (ADM2) boundary polygons for the drill-down map. Static GeoJSON built
// from GADM 4.1; feature.properties.key joins to district rows' `key`.
export function useDistrictGeo() {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await fetch('/data/borneo_districts.geojson');
        if (!response.ok) throw new Error(`Failed to load district boundaries (${response.status})`);
        const payload = await response.json();
        if (!ignore) setState({ data: payload, loading: false, error: null });
      } catch (error) {
        if (!ignore) setState({ data: null, loading: false, error: error.message });
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return state;
}

// Brunei's national outline. The district boundary file only covers Sabah,
// Sarawak and Kalimantan's provinces, so Brunei is loaded separately to complete
// the 4-territory fill on the Overview map.
export function useBruneiGeo() {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const response = await fetch('/data/brunei.geojson');
        if (!response.ok) throw new Error(`Failed to load Brunei boundary (${response.status})`);
        const payload = await response.json();
        if (!ignore) setState({ data: payload, loading: false, error: null });
      } catch (error) {
        if (!ignore) setState({ data: null, loading: false, error: error.message });
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return state;
}

// value-by-join-key for one layer's concept, plus a RAG color function over the
// spread of those values — powers the district choropleth. Mirrors layerColorScale.
export function buildDistrictChoropleth(rows, layerKey) {
  const config = LAYER_CONFIG[layerKey];
  const concept = config?.districtFallbackConcept || config?.concept;
  const valueByKey = {};
  if (config && concept) {
    rows
      .filter((row) => row.canonical === 1 && row.dashboard_concept === concept)
      .forEach((row) => {
        valueByKey[row.key] = row;
      });
  }
  const values = Object.values(valueByKey)
    .map((row) => row.value)
    .filter((value) => Number.isFinite(value));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const colorForKey = (key) => {
    const row = valueByKey[key];
    if (!row || !Number.isFinite(row.value)) return null; // no data -> caller greys it
    const ratio = max === min ? 0.5 : (row.value - min) / (max - min);
    const adjusted = config.better === 'higher' ? ratio : 1 - ratio;
    if (adjusted > 0.66) return '#16a34a';
    if (adjusted > 0.33) return '#f59e0b';
    return '#dc2626';
  };
  return { valueByKey, colorForKey };
}

// Parents (states/provinces) that actually have district rows, in display order.
export function getDistrictParents(districtData) {
  return districtData?.parents ? Object.keys(districtData.parents) : [];
}

// Canonical district display name for a (parent, key), for map-click -> dropdown sync.
export function getDistrictNameByKey(rows, parent, key) {
  const row = rows.find((r) => r.parent === parent && r.key === key);
  return row ? row.territory : null;
}

export function getDistrictsForParent(districtData, parent) {
  return districtData?.parents?.[parent] || [];
}

// Layer entries (map choropleth) for every district under one parent.
export function getDistrictLayerRows(rows, parent, layerKey) {
  const config = LAYER_CONFIG[layerKey];
  const concept = config?.districtFallbackConcept || config?.concept;
  if (!config || !concept) return [];
  return rows
    .filter((row) => row.parent === parent && row.canonical === 1 && row.dashboard_concept === concept)
    .map((row) => ({ territory: row.territory, row }));
}

export function getRowsForTerritory(rows, territory) {
  return rows.filter((row) => row.territory === territory);
}

export function getCanonicalRows(rows, territory) {
  return getRowsForTerritory(rows, territory).filter((row) => row.canonical === 1);
}

export function getRowsForPillar(rows, territory, pillar) {
  return getCanonicalRows(rows, territory)
    .filter((row) => row.esg_pillar === pillar)
    .sort((a, b) => a.indicator.localeCompare(b.indicator));
}

export const SDG_GOALS = [
  { goal: 'SDG1', label: 'No Poverty' },
  { goal: 'SDG2', label: 'Zero Hunger' },
  { goal: 'SDG3', label: 'Good Health' },
  { goal: 'SDG4', label: 'Quality Education' },
  { goal: 'SDG6', label: 'Clean Water' },
  { goal: 'SDG7', label: 'Clean Energy' },
  { goal: 'SDG8', label: 'Economic Growth' },
  { goal: 'SDG9', label: 'Industry & Innovation' },
  { goal: 'SDG11', label: 'Sustainable Cities' },
  { goal: 'SDG13', label: 'Climate Action' },
  { goal: 'SDG15', label: 'Life on Land' },
  { goal: 'SDG16', label: 'Peace & Justice' },
];

// Approximate GDP per capita (US$) for the four territories — used only for the
// "paper wealth vs true wealth" comparison. Mixed official sources/years, FX-converted,
// so treat as illustrative, not exact.
export const GDP_PER_CAPITA_USD = {
  Brunei: 33000, // World Bank GDP (current US$) 2023 ÷ population (~15.0B / 0.46M)
  Sarawak: 15700, // DOSM GDP per capita RM 72,411 (2023) at ~RM 4.6/US$
  Sabah: 4900, // DOSM GDP per capita ~RM 22,400 (2024) at ~RM 4.6/US$ — lowest Malaysian state
  Kalimantan: 6500, // BPS PDRB per capita (2023), 5-province approx (E. Kalimantan ~US$16k, others ~US$3–4k)
};

export function getSeries(data, territory, concept) {
  return data?.series?.[territory]?.[concept] || null;
}

export function countTrendReadyConcepts(data, territory) {
  return Object.keys(data?.series?.[territory] || {}).length;
}

export function getRowsForSdg(rows, territory, sdgGoal) {
  return getCanonicalRows(rows, territory)
    .filter((row) => row.sdg_goal === sdgGoal)
    .sort((a, b) => a.indicator.localeCompare(b.indicator));
}

export function summarizeRows(rows) {
  const years = rows
    .map((row) => extractYear(row.year))
    .filter((year) => Number.isFinite(year));
  const latestYear = years.length ? Math.max(...years) : null;
  const confidenceCounts = rows.reduce((acc, row) => {
    acc[row.confidence] = (acc[row.confidence] || 0) + 1;
    return acc;
  }, {});
  return {
    count: rows.length,
    latestYear,
    confidenceCounts,
  };
}

export function extractYear(value) {
  const text = String(value || '');
  const matches = text.match(/\d{4}/g);
  if (!matches) return null;
  return Math.max(...matches.map((year) => Number(year)));
}

export function formatValue(row) {
  if (!row || row.value === null || row.value === undefined) {
    return 'No data';
  }
  const value = Number(row.value);
  let formatted = value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2,
  });
  if (row.unit) {
    formatted = `${formatted} ${row.unit}`;
  }
  return formatted;
}

export function isScoreLayer(layerKey) {
  return LAYER_CONFIG[layerKey]?.source === 'resilience';
}

export function hasDistrictFallbackLayer(layerKey) {
  return Boolean(LAYER_CONFIG[layerKey]?.districtFallbackConcept);
}

export function titleCaseConfidence(value) {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildScoreLayerRow(territoryName, territory, config, generatedAt) {
  const value = config.scoreKey === 'index' ? territory?.index : territory?.pillarScores?.[config.pillar];
  if (!Number.isFinite(value)) return null;
  return {
    territory: territoryName,
    indicator: config.label,
    value,
    unit: '/100',
    source: 'resilience.json',
    confidence: 'score',
    year: generatedAt || null,
    dashboard_concept: config.scoreKey || config.pillar,
    canonical: 1,
  };
}

export function getLayerRows(rows, layerKey, resilienceData = null) {
  const config = LAYER_CONFIG[layerKey];
  if (!config) return [];
  if (config.source === 'resilience') {
    return TERRITORIES.map((territory) => {
      const scoreRow = buildScoreLayerRow(
        territory,
        resilienceData?.territories?.[territory],
        config,
        resilienceData?.generatedAt
      );
      return {
        territory,
        row: scoreRow,
      };
    });
  }
  return TERRITORIES.map((territory) => {
    const row = getCanonicalRows(rows, territory).find((item) => item.dashboard_concept === config.concept);
    return {
      territory,
      row: row || null,
    };
  });
}

export function layerColorScale(entries, layerKey) {
  const config = LAYER_CONFIG[layerKey];
  if (config?.scale === 'absolute') {
    return (value) => {
      if (!Number.isFinite(value)) return '#cbd5e1';
      if (value >= 70) return '#16a34a';
      if (value >= 40) return '#f59e0b';
      return '#dc2626';
    };
  }
  const values = entries.map((entry) => entry.row?.value).filter((value) => Number.isFinite(value));
  if (!config || values.length === 0) {
    return () => '#94a3b8';
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (value) => {
    if (!Number.isFinite(value)) return '#cbd5e1';
    const ratio = max === min ? 0.5 : (value - min) / (max - min);
    const adjusted = config.better === 'higher' ? ratio : 1 - ratio;
    if (adjusted > 0.66) return '#16a34a';
    if (adjusted > 0.33) return '#f59e0b';
    return '#dc2626';
  };
}

export function getAvailableConcepts(rows, territory = null) {
  const preferredOrder = [
    'forest_cover',
    'deforestation',
    'air_quality',
    'fire_hotspots',
    'poverty',
    'clean_water_access',
    'unemployment_rate',
    'economy',
    'healthcare',
    'education',
    'governance',
    'food',
    'food_percapita',
    'energy',
    'shelter',
    'entertainment',
    'internet_use',
  ];
  const sampleByConcept = new Map();
  rows
    .filter((row) => row.canonical === 1)
    .filter((row) => !territory || row.territory === territory)
    .forEach((row) => {
    if (!sampleByConcept.has(row.dashboard_concept)) {
      sampleByConcept.set(row.dashboard_concept, row);
    }
    });
  return preferredOrder
    .filter((concept) => sampleByConcept.has(concept))
    .map((concept) => ({
      concept,
      label: sampleByConcept.get(concept).indicator,
    }));
}

export function getComparisonRows(rows, concept) {
  return TERRITORIES.map((territory) => {
    const row = getCanonicalRows(rows, territory).find((item) => item.dashboard_concept === concept);
    return {
      territory,
      row: row || null,
    };
  });
}

export function getHexagonCoverage(rows, territory) {
  const counts = {
    Food: 0,
    Energy: 0,
    Education: 0,
    Shelter: 0,
    Healthcare: 0,
    Entertainment: 0,
  };
  getCanonicalRows(rows, territory).forEach((row) => {
    if (row.hexagon_pillar && counts[row.hexagon_pillar] !== undefined) {
      counts[row.hexagon_pillar] += 1;
    }
  });
  return counts;
}

export function getEsgCoverage(rows, territory) {
  const counts = {
    Environment: 0,
    Social: 0,
    Governance: 0,
  };
  getCanonicalRows(rows, territory).forEach((row) => {
    if (row.esg_pillar === 'E') counts.Environment += 1;
    if (row.esg_pillar === 'S') counts.Social += 1;
    if (row.esg_pillar === 'G') counts.Governance += 1;
  });
  return counts;
}

export function getConfidenceCoverage(rows, territory) {
  const counts = {
    High: 0,
    Medium: 0,
    Manual: 0,
  };
  getCanonicalRows(rows, territory).forEach((row) => {
    const label = titleCaseConfidence(row.confidence);
    if (counts[label] !== undefined) {
      counts[label] += 1;
    }
  });
  return counts;
}
