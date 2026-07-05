import { useEffect, useState } from 'react';

export const TERRITORIES = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];
export const CATEGORY_TO_PILLAR = {
  Environment: 'E',
  Social: 'S',
  Governance: 'G',
};

export const LAYER_CONFIG = {
  forestCover: { label: 'Forest Cover', concept: 'forest_cover', better: 'higher' },
  deforestation: { label: 'Deforestation', concept: 'deforestation', better: 'lower' },
  airQuality: { label: 'Air Quality', concept: 'air_quality', better: 'lower' },
  fireHotspots: { label: 'Fire Hotspots', concept: 'fire_hotspots', better: 'lower' },
  poverty: { label: 'Poverty', concept: 'poverty', better: 'lower' },
};

export function useIndicators() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
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
          setState({ data: payload, loading: false, error: null });
        }
      } catch (error) {
        if (!ignore) {
          setState({ data: null, loading: false, error: error.message });
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
          setState({ data: payload, loading: false, error: null });
        }
      } catch (error) {
        if (!ignore) {
          setState({ data: null, loading: false, error: error.message });
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
  { goal: 'SDG4', label: 'Quality Education' },
  { goal: 'SDG6', label: 'Clean Water' },
  { goal: 'SDG8', label: 'Economic Growth' },
  { goal: 'SDG13', label: 'Climate Action' },
  { goal: 'SDG15', label: 'Life on Land' },
];

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

export function titleCaseConfidence(value) {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getLayerRows(rows, layerKey) {
  const config = LAYER_CONFIG[layerKey];
  if (!config) return [];
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
    'energy',
    'shelter',
    'entertainment',
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
