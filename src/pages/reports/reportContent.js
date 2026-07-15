// reportContent.js
// Turns raw indicators.json rows into the structured content the ESG & SDG
// Data Profile report renders: pillar groups, SDG coverage, an auto-written
// executive summary, key takeaways, and an honest coverage/limitations list.
//
// Everything here is deterministic (no LLM): the prose is templated from the
// data so it stays correct when indicators change. Per-indicator explanations
// live in a small hand-written library keyed by indicator name, with a
// concept-level fallback so a new indicator never renders blank.

import { SDG_GOALS, TERRITORIES, extractYear } from '../../data/useIndicators';

// ---- Per-indicator explanations (what it measures + why it matters) --------
// Territory-agnostic on purpose: the value/year is shown separately, so these
// stay reusable across Sabah, Sarawak, Brunei and Kalimantan.
export const INDICATOR_EXPLANATIONS = {
  // Environment
  'Air quality (AQI, live)': 'Live air-quality index for the territory’s main city. Lower is better — 0–50 good, 51–100 moderate, above 100 unhealthy, and worse on haze days.',
  'Fire alerts (VIIRS, annual)': 'Satellite-detected fire hotspots for the year — an early-warning proxy for land clearing and haze risk.',
  'Forest cover': 'Share of land still under forest — a headline conservation indicator (SDG 15) and a key input to EUDR-style sourcing checks.',
  'Forest extent (2000)': 'The year-2000 satellite forest baseline that later tree-cover loss is measured against.',
  'National parks (count)': 'Number of protected areas. “Park” is defined differently in each jurisdiction, so read it as a coverage signal, not a cross-border ranking.',
  'Renewable electricity (% output)': 'Share of electricity generated from renewable sources — the remainder is largely fossil-based.',
  'Tree cover loss (cumulative)': 'Total forest lost since 2000 — the headline deforestation figure for EUDR-style due diligence.',
  'Tree cover loss (annual)': 'Forest lost in a single year — shows the current pace of deforestation rather than the long-run total.',

  // Governance
  'Control of Corruption (WGI)': 'World Bank governance score (0–100, higher is better). This is a national figure applied to the territory, not a sub-national measure.',

  // Social — education
  'Adult literacy': 'Share of adults who can read and write — a foundational education outcome (SDG 4).',
  'Mean years schooling (RLS)': 'Average years of schooling completed by adults — a depth-of-education measure (SDG 4).',
  'School enrolment': 'Number of students enrolled — an education-participation volume (a count, not a rate).',
  'School enrolment (primary, gross)': 'Gross primary-school enrolment ratio (SDG 4).',
  'School enrolment (secondary, gross)': 'Gross secondary-school enrolment ratio (SDG 4).',

  // Social — food
  'Agricultural land': 'Share of land used for agriculture — context for food production and land-use pressure.',
  'Crop production (paddy)': 'Annual rice output — a food-security indicator (SDG 2).',
  'Paddy production per capita': 'Domestic rice (paddy) output per person — a food self-sufficiency proxy (SDG 2). A low value means a territory grows little of its own staple food, however wealthy it is.',

  // Social — water / shelter
  'Clean water access': 'Share of the population with access to clean, treated water (SDG 6).',
  'Basic sanitation access': 'Share of the population with basic sanitation — a core living-standard measure (SDG 6).',
  'Households': 'Total number of households — the denominator for household-level access figures.',

  // Social — energy
  'Electricity access': 'Share of households with access to electricity, as a percentage (SDG 7).',
  'Electricity access (households)': 'Number of households connected to electricity — an absolute count; read against total households, or see the percentage figure where available.',
  'Electrification ratio': 'Share of households with electricity access (SDG 7).',

  // Social — economy
  'GDP (current US$)': 'Size of the economy in current US dollars (SDG 8).',
  'GDP (real)': 'Size of the economy in inflation-adjusted local currency (SDG 8).',
  'GDP growth': 'Year-on-year change in real economic output.',
  'GDP growth (PDRB)': 'Year-on-year growth in gross regional product (Indonesia’s PDRB measure).',
  'Unemployment rate': 'Share of the labour force without work (SDG 8).',

  // Social — health
  'Life expectancy': 'Life expectancy at birth — a summary health outcome (SDG 3).',
  'Hospital beds': 'Total public hospital bed capacity — read against population for per-capita context.',
  'Hospital beds (per 1k)': 'Hospital beds per 1,000 people — a healthcare-capacity measure (SDG 3).',

  // Social — poverty
  'Poverty rate (absolute)': 'Share of people below the national absolute poverty line (SDG 1).',
  'Poverty rate (P0)': 'Headcount poverty rate (the P0 measure) — share of people below the poverty line (SDG 1).',
  'Poverty rate (national line)': 'Share of people below the national poverty line (SDG 1).',

  // Social — culture / tourism
  'Tourist arrivals': 'Visitor arrivals — a proxy for the tourism economy.',
  'Tourist trips (domestic)': 'Domestic tourist trips — a proxy for internal tourism activity.',
  'UNESCO World Heritage Sites': 'Count of UNESCO World Heritage sites — natural- and cultural-heritage significance.',

  // Social — connectivity
  'Internet use': 'Share of people who use the internet — a digital-access and connectivity measure (SDG 9).',
};

const CONCEPT_EXPLANATIONS = {
  air_quality: 'A live air-quality reading — lower is better.',
  fire_hotspots: 'Satellite fire detections — a proxy for land clearing and haze.',
  forest_cover: 'A measure of remaining forest — central to SDG 15 and EUDR checks.',
  deforestation: 'A measure of forest lost — central to deforestation due diligence.',
  protected_areas: 'Protected-area coverage; definitions vary by jurisdiction.',
  energy: 'An energy-access or energy-mix indicator (SDG 7).',
  governance: 'A governance-quality indicator, applied at national level (SDG 16).',
  education: 'An education-participation or attainment indicator (SDG 4).',
  food: 'A food-production or agricultural-land indicator (SDG 2).',
  food_percapita: 'Domestic food output per person — a self-sufficiency proxy (SDG 2).',
  shelter: 'A housing or basic-services indicator (SDG 11 / 6).',
  clean_water_access: 'Access to clean, treated water (SDG 6).',
  economy: 'An economic-output or labour-market indicator (SDG 8).',
  healthcare: 'A health-outcome or health-capacity indicator (SDG 3).',
  entertainment: 'A tourism or cultural-activity indicator.',
  internet_use: 'Internet access and digital connectivity (SDG 9).',
  heritage: 'A natural- or cultural-heritage indicator.',
  poverty: 'A poverty-rate indicator (SDG 1).',
  unemployment_rate: 'The share of the labour force without work (SDG 8).',
};

export function explainRow(row) {
  return (
    INDICATOR_EXPLANATIONS[row.indicator] ||
    CONCEPT_EXPLANATIONS[row.dashboard_concept] ||
    'A tracked indicator for this territory.'
  );
}

// ---- Formatting ------------------------------------------------------------
export function formatReportNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  return n.toLocaleString('en-US', {
    maximumFractionDigits: abs >= 100 ? 0 : abs >= 10 ? 1 : 2,
  });
}

export const CONFIDENCE_LABEL = { high: 'High', medium: 'Medium', manual: 'Manual' };

export function sdgShort(goal) {
  return String(goal || '').replace(/^SDG/, 'SDG ');
}

const SDG_LABEL = SDG_GOALS.reduce((acc, g) => {
  acc[g.goal] = g.label;
  return acc;
}, {});

function sdgNum(goal) {
  const n = parseInt(String(goal || '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 999;
}

// ---- Source families (collapse long source strings to a clean label) -------
const SOURCE_FAMILIES = [
  [/global forest watch/i, 'Global Forest Watch'],
  [/\bwgi\b|world bank wgi/i, 'World Bank WGI'],
  [/world bank/i, 'World Bank'],
  [/opendosm|data\.gov\.my/i, 'data.gov.my / OpenDOSM'],
  [/waqi|aqicn/i, 'WAQI / aqicn'],
  [/unesco/i, 'UNESCO'],
  [/\bfao\b/i, 'FAO'],
  [/sabah parks/i, 'Sabah Parks'],
  [/\bdosm\b/i, 'DOSM'],
  [/\bbps\b|badan pusat statistik/i, 'BPS (Indonesia)'],
  [/^manual report|via press|malay mail|daily express|bernama/i, 'Government / press report'],
];

export function sourceFamily(source) {
  const s = String(source || '');
  for (const [re, label] of SOURCE_FAMILIES) {
    if (re.test(s)) return label;
  }
  const seg = s.split(/[—:/]/)[0].trim();
  return seg || 'Unknown source';
}

// ---- Ordering --------------------------------------------------------------
const PILLARS = [
  { key: 'E', name: 'Environment' },
  { key: 'S', name: 'Social' },
  { key: 'G', name: 'Governance' },
];

const CONCEPT_PRIORITY = [
  'deforestation', 'forest_cover', 'fire_hotspots', 'air_quality', 'protected_areas', 'energy',
  'poverty', 'unemployment_rate', 'clean_water_access', 'healthcare', 'education', 'food',
  'food_percapita', 'shelter', 'economy', 'entertainment', 'internet_use', 'heritage', 'governance',
];
const conceptRank = (c) => {
  const i = CONCEPT_PRIORITY.indexOf(c);
  return i === -1 ? CONCEPT_PRIORITY.length : i;
};

const distinct = (arr) => [...new Set(arr)];

function reading(row) {
  return {
    territory: row.territory,
    value: formatReportNumber(row.value),
    unit: row.unit,
    year: row.year,
    source: row.source,
    sourceFamily: sourceFamily(row.source),
    confidence: row.confidence,
  };
}

const TERRITORY_RANK = TERRITORIES.reduce((acc, t, i) => {
  acc[t] = i;
  return acc;
}, {});

// ---- Main builder ----------------------------------------------------------
export function buildProfile(rows, { territory, allTerritories = false }) {
  const clean = (rows || []).filter(Boolean);

  // Indicator items — one per row (single territory) or one per indicator name
  // with a reading per territory (all-Borneo comparison).
  let items;
  if (allTerritories) {
    const byName = new Map();
    for (const r of clean) {
      if (!byName.has(r.indicator)) {
        byName.set(r.indicator, {
          name: r.indicator,
          pillar: r.esg_pillar,
          concept: r.dashboard_concept,
          sdg: r.sdg_goal,
          explanation: explainRow(r),
          readings: [],
        });
      }
      byName.get(r.indicator).readings.push(reading(r));
    }
    items = [...byName.values()].map((it) => ({
      ...it,
      readings: it.readings.sort(
        (a, b) => (TERRITORY_RANK[a.territory] ?? 99) - (TERRITORY_RANK[b.territory] ?? 99)
      ),
    }));
  } else {
    items = clean.map((r) => ({
      name: r.indicator,
      pillar: r.esg_pillar,
      concept: r.dashboard_concept,
      sdg: r.sdg_goal,
      explanation: explainRow(r),
      readings: [reading(r)],
    }));
  }

  const sortItems = (a, b) =>
    conceptRank(a.concept) - conceptRank(b.concept) || a.name.localeCompare(b.name);

  const pillars = PILLARS.map((p) => ({
    ...p,
    indicators: items.filter((it) => it.pillar === p.key).sort(sortItems),
  })).filter((p) => p.indicators.length);

  const pillarCounts = { E: 0, S: 0, G: 0 };
  pillars.forEach((p) => {
    pillarCounts[p.key] = p.indicators.length;
  });

  // SDG coverage (distinct indicator names per goal)
  const sdgMap = new Map();
  for (const r of clean) {
    if (!r.sdg_goal) continue;
    if (!sdgMap.has(r.sdg_goal)) {
      sdgMap.set(r.sdg_goal, { goal: r.sdg_goal, names: new Set(), latestYear: null });
    }
    const e = sdgMap.get(r.sdg_goal);
    e.names.add(r.indicator);
    const y = extractYear(r.year);
    if (y && (!e.latestYear || y > e.latestYear)) e.latestYear = y;
  }
  const sdg = [...sdgMap.values()]
    .map((e) => ({
      goal: e.goal,
      label: SDG_LABEL[e.goal] || '',
      count: e.names.size,
      latestYear: e.latestYear,
      lead: [...e.names].slice(0, 2).join(' · '),
    }))
    .sort((a, b) => sdgNum(a.goal) - sdgNum(b.goal));

  // Confidence + vintage stats (over raw rows)
  const conf = { high: 0, medium: 0, manual: 0 };
  clean.forEach((r) => {
    if (conf[r.confidence] !== undefined) conf[r.confidence] += 1;
  });
  const years = clean.map((r) => extractYear(r.year)).filter(Number.isFinite);
  const latestYear = years.length ? Math.max(...years) : null;
  const oldestYear = years.length ? Math.min(...years) : null;
  const oldestRow = clean
    .map((r) => ({ r, y: extractYear(r.year) }))
    .filter((x) => Number.isFinite(x.y))
    .sort((a, b) => a.y - b.y)[0]?.r;

  const sources = distinct(clean.map((r) => sourceFamily(r.source))).sort();
  const totalRows = clean.length;

  // Glance strip
  const glance = [
    { k: 'Indicators', v: String(items.length) },
    { k: 'SDGs covered', v: String(sdg.length) },
    { k: 'Source families', v: String(sources.length) },
    { k: 'Latest data', v: latestYear ? String(latestYear) : '—' },
  ];

  // Executive summary (templated)
  const who = allTerritories ? 'all four Borneo territories' : territory;
  const gWord = pillarCounts.G === 1 ? 'indicator' : 'indicators';
  const summaryText =
    `This profile compiles ${items.length} environmental, social and governance indicators for ${who}, ` +
    `drawn from official statistical, satellite and institutional sources. Coverage spans ` +
    `${pillarCounts.E} environmental, ${pillarCounts.S} social and ${pillarCounts.G} governance ${gWord} across ` +
    `${sdg.length} UN Sustainable Development Goals, with data as recent as ${latestYear ?? 'n/a'}. ` +
    `Of the underlying figures, ${conf.high} are officially measured, ${conf.medium} are modelled or applied ` +
    `from national sources, and ${conf.manual} are hand-entered from cited reports — each value is shown with ` +
    `its own source and year, never blended into a single score.`;

  // Takeaways (deterministic)
  const takeaways = [];
  if (pillars.length) {
    const byDepth = [...pillars].sort((a, b) => b.indicators.length - a.indicators.length);
    const top = byDepth[0];
    const bottom = byDepth[byDepth.length - 1];
    takeaways.push(
      `Coverage is deepest on ${top.name} (${top.indicators.length}) and thinnest on ` +
      `${bottom.name} (${bottom.indicators.length} ${bottom.indicators.length === 1 ? 'indicator' : 'indicators'}).`
    );
  }
  if (oldestRow && oldestYear && latestYear) {
    takeaways.push(
      `Data spans ${oldestYear}–${latestYear}; the oldest figure is “${oldestRow.indicator}” (${oldestYear}).`
    );
  }
  takeaways.push(
    `${conf.high} of ${totalRows} figures are officially measured; ${conf.medium} are modelled or national ` +
    `proxies and ${conf.manual} are hand-entered — all flagged in Coverage & Limitations.`
  );
  if (pillarCounts.G <= 1) {
    takeaways.push(
      `Governance relies on ${pillarCounts.G} national ${pillarCounts.G === 1 ? 'indicator' : 'indicators'} — the clearest coverage gap.`
    );
  }

  // Coverage & limitations
  const gaps = [];
  if (pillarCounts.G <= 1) {
    gaps.push(
      `Governance is thin — ${pillarCounts.G} ${pillarCounts.G === 1 ? 'indicator' : 'indicators'}, and it is a national figure applied to the territory. No sub-national governance data yet.`
    );
  }
  gaps.push(
    'No emissions indicator — climate coverage is limited to fire, air-quality and forest-loss proxies; there is no direct greenhouse-gas measure.'
  );
  const units = new Set(clean.map((r) => String(r.unit || '').toLowerCase()));
  if (['households', 'students', 'beds'].some((u) => units.has(u))) {
    gaps.push(
      'Several social figures are absolute counts — not per-capita rates (e.g. households, school enrolment, hospital beds). They are not directly comparable across territories without population normalisation.'
    );
  }

  const flagged = [];
  const manualNames = distinct(clean.filter((r) => r.confidence === 'manual').map((r) => r.indicator));
  if (manualNames.length) {
    flagged.push({ tag: 'Manual', text: `Hand-entered from cited government / press reports: ${manualNames.join(', ')}.` });
  }
  const mediumNames = distinct(clean.filter((r) => r.confidence === 'medium').map((r) => r.indicator));
  if (mediumNames.length) {
    flagged.push({ tag: 'Medium', text: `Modelled, or national figures applied to the territory: ${mediumNames.join(', ')}.` });
  }
  if (oldestYear && latestYear) {
    flagged.push({
      tag: null,
      text: `Mixed vintages — figures range from ${oldestYear} to ${latestYear}; each row carries its own reference year rather than a single “as of” date.`,
    });
  }

  return {
    pillars,
    sdg,
    glance,
    summaryText,
    takeaways,
    coverage: { gaps, flagged },
    sources,
    multiTerritory: allTerritories,
  };
}
