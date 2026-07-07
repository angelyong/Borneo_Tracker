// ESG Indicators — Figma redesign: per-region pillar tabs, score summary, best/risk
// indicators, sparkline metric cards, land-cover snapshot + GFW-style density chart.
import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import EChart from '../../components/EChart';
import { SparkCard } from '../dashboard/OverviewDashboard';
import { COLORS, RADII } from '../../theme';
import { Card, Icons, Select } from '../../components/ui';
import {
  CATEGORY_TO_PILLAR,
  TERRITORIES,
  formatValue,
  getRowsForPillar,
  getSeries,
  useIndicators,
  useResilience,
} from '../../data/useIndicators';

const TABS = [
  { key: 'Environment', icon: '🌱' },
  { key: 'Social', icon: '👥' },
  { key: 'Governance', icon: '🏛️' },
];

// Sparkline card definitions per pillar (concept must exist in indicators.json series)
const CARD_DEFS = {
  Environment: [
    { concept: 'forest_cover', label: 'Forest Cover', sub: '% of land area', tone: 'green', pct: true },
    { concept: 'air_quality', label: 'Air Quality', sub: '(AQI)', tone: 'green', statusText: 'Good' },
    { concept: 'fire_hotspots', label: 'Active Fire Hotspots', sub: 'detected', tone: 'orange', statusText: 'Moderate' },
    { concept: 'poverty', label: 'Poverty Rate', sub: '(%)', tone: 'green', pct: true },
    { concept: 'deforestation', label: 'Deforestation Rate', sub: 'hectares/year', tone: 'green' },
    { concept: 'clean_water_access', label: 'Water Quality', sub: 'index', tone: 'green', statusText: 'Good' },
  ],
  Social: [
    { concept: 'poverty', label: 'Poverty Rate', sub: '(%)', tone: 'green', pct: true },
    { concept: 'life_expectancy', label: 'Life Expectancy', sub: 'years', tone: 'green' },
    { concept: 'mean_years_schooling', label: 'Mean Years Schooling', sub: 'years', tone: 'green' },
    { concept: 'clean_water_access', label: 'Clean Water Access', sub: '(%)', tone: 'green', pct: true },
  ],
  Governance: [],
};

// Land-cover snapshot from the design (GFW-derived; not yet in indicators.json)
const LAND_COVER = [
  { label: 'Natural forests', value: '8.7 Mha', color: '#1B4532' },
  { label: 'Non-natural tree cover', value: '780 kha', color: '#8FCB9B' },
  { label: 'Other land cover', value: '2.9 Mha', color: '#C9CDC4' },
  { label: 'Tree Cover', value: '12 Mha', color: '#4B6B1F' },
  { label: 'Other Land Cover', value: '740 kha', color: '#D9D77A' },
];

const LAND_USE_DONUT = [
  { name: 'Oil palm', value: 1700, color: '#F4A0A0' },
  { name: 'Unknown', value: 510, color: '#D3D3D3' },
  { name: 'Wood fiber or timber', value: 190, color: '#8A9BD4' },
  { name: 'Rubber', value: 40, color: '#F6C6C6' },
  { name: 'Oil palm mix', value: 35, color: '#F0B8D0' },
  { name: 'Fruit mix', value: 34, color: '#F5EE9E' },
  { name: 'Fruit', value: 13, color: '#C6CE8B' },
  { name: 'Rubber mix', value: 240, color: '#9EEAF0' },
];

// Tree-cover density histogram (design: GFW tree cover extent chart)
const DENSITY_BARS = [0.55, 0.18, 0.17, 0.15, 0.2, 0.22, 0.28, 0.42, 0.75, 1.55, 7.6];

export default function ESGIndicator() {
  const [region, setRegion] = useState('Sarawak');
  const [tab, setTab] = useState('Environment');
  const { data } = useIndicators();
  const { data: resilience } = useResilience();

  const pillar = CATEGORY_TO_PILLAR[tab];

  const pillarRows = useMemo(
    () => (data?.rows ? getRowsForPillar(data.rows, region, pillar) : []),
    [data, region, pillar],
  );

  const score = useMemo(() => {
    const ix = resilience?.territories?.[region]?.index;
    if (!Number.isFinite(ix)) return null;
    const status = ix >= 67 ? 'Good' : ix >= 34 ? 'Moderate' : 'Poor';
    return { value: Math.round(ix), status };
  }, [resilience, region]);

  const cards = useMemo(() => {
    if (!data) return [];
    return CARD_DEFS[tab]
      .map((d) => {
        const s = getSeries(data, region, d.concept);
        if (!s?.points?.length) return null;
        const points = [...s.points].sort((a, b) => a.year - b.year);
        const latest = points[points.length - 1];
        const prev = points[points.length - 2];
        const delta =
          latest && prev && prev.value !== 0
            ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100
            : null;
        return {
          ...d,
          points,
          value: d.pct ? `${latest.value.toFixed(1)}%` : Math.round(latest.value).toLocaleString(),
          delta: d.statusText ? null : delta,
          status: d.statusText,
        };
      })
      .filter(Boolean);
  }, [data, region, tab]);

  const donutOption = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}: {c} kha' },
      legend: {
        orient: 'vertical',
        left: 0,
        top: 'middle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { fontSize: 11 },
        formatter: (name) => {
          const it = LAND_USE_DONUT.find((x) => x.name === name);
          return `${name}- ${it.value >= 1000 ? (it.value / 1000).toFixed(1) + ' Mha' : it.value + ' kha'}`;
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '78%'],
          center: ['72%', '50%'],
          data: LAND_USE_DONUT.map((d) => ({
            name: d.name,
            value: d.value,
            itemStyle: { color: d.color },
          })),
          label: { show: false },
        },
      ],
    }),
    [],
  );

  const densityOption = useMemo(
    () => ({
      grid: { left: 60, right: 20, top: 20, bottom: 46 },
      xAxis: {
        type: 'category',
        data: DENSITY_BARS.map((_, i) => i * 10),
        name: 'Tree cover (%)',
        nameLocation: 'middle',
        nameGap: 30,
      },
      yAxis: {
        type: 'value',
        name: 'Land area (in hectares)',
        nameLocation: 'middle',
        nameGap: 44,
        axisLabel: { formatter: (v) => `${v}M` },
      },
      tooltip: { trigger: 'axis' },
      series: [
        {
          type: 'bar',
          data: DENSITY_BARS,
          itemStyle: { color: '#8DC63F' },
          barWidth: '85%',
        },
      ],
    }),
    [],
  );

  const download = () => {
    const csv = [
      'territory,indicator,year,value,unit,source',
      ...pillarRows.map((r) =>
        [r.territory, r.indicator, r.year, r.value, r.unit, r.source]
          .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `esg-${region}-${tab}.csv`;
    a.click();
  };

  return (
    <Layout>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 20px 50px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '4px 0 18px' }}>
          ESG Indicators
        </h1>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <Select options={[...TERRITORIES]} value={region} onChange={setRegion} style={{ width: 200 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={download}
            title="Download CSV"
            style={{ border: 'none', background: 'none', color: COLORS.ink, padding: 6 }}
          >
            <Icons.Download size={22} />
          </button>
        </div>

        {/* Pillar tabs */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            background: '#E9EBE4',
            borderRadius: RADII.pill,
            padding: 6,
            margin: '4px auto 24px',
            width: 'fit-content',
          }}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 26px',
                  borderRadius: RADII.pill,
                  border: 'none',
                  fontSize: 14.5,
                  fontWeight: 800,
                  background: active ? COLORS.forest : 'transparent',
                  color: active ? '#fff' : COLORS.ink,
                }}
              >
                <span>{t.icon}</span>
                {t.key}
              </button>
            );
          })}
        </div>

        <h2 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 14px' }}>{tab}</h2>

        {/* Score + best/risk */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Card>
            {[
              [`${tab === 'Environment' ? 'Environmental' : tab} Score:`, score ? `${score.value}/100` : '—'],
              ['Status:', score?.status ?? '—'],
              ['Compared with last year:', '+ 2.4%'],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '7px 2px',
                  fontSize: 14.5,
                }}
              >
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </Card>
          <Card>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 2px', fontSize: 14.5 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>👍</span> <b>Best Indicator</b>
              </span>
              <span>Water Quality</span>
            </div>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 2px', fontSize: 14.5 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚠️</span> <b>Risk Indicator</b>
              </span>
              <span>Active Fire Hotspots</span>
            </div>
          </Card>
        </div>

        {/* Sparkline cards */}
        {cards.length > 0 ? (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '20px 0' }}>
            {cards.map((c) => (
              <SparkCard key={c.concept} {...c} />
            ))}
          </div>
        ) : (
          <Card style={{ margin: '20px 0', color: COLORS.muted, fontSize: 14 }}>
            No trend-ready indicators for this pillar yet — see the list below.
          </Card>
        )}

        {/* Pillar indicator list (real rows) */}
        {pillarRows.length > 0 && (
          <Card style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
              {tab} indicators · {region}
            </div>
            {pillarRows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 2px',
                  borderTop: i ? '1px solid #F3F4F6' : 'none',
                  fontSize: 13.5,
                }}
              >
                <span style={{ color: COLORS.muted }}>
                  {r.indicator} <span style={{ color: COLORS.faint }}>({r.year})</span>
                </span>
                <b>{formatValue(r)}</b>
              </div>
            ))}
          </Card>
        )}

        {tab === 'Environment' && (
          <>
            {/* Land cover snapshot + land-use donut */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
              <Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  {LAND_COVER.map((l) => (
                    <div key={l.label}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          fontSize: 12.5,
                          color: COLORS.muted,
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: l.color,
                            display: 'inline-block',
                          }}
                        />
                        {l.label}
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: l.color, marginTop: 4 }}>
                        {l.value}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <EChart option={donutOption} height={230} />
              </Card>
            </div>

            {/* Tree cover density */}
            <Card style={{ marginTop: 20 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: COLORS.muted,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                }}
              >
                Tree cover density in {region},{' '}
                {region === 'Kalimantan' ? 'Indonesia' : region === 'Brunei' ? 'Brunei' : 'Malaysia'}
              </div>
              <div style={{ fontSize: 19, margin: '10px 0 4px' }}>
                In 2020, <b>{region}</b> had <b>12 Mha</b> of land above <b>10%</b> tree cover,
                extending over <b>95%</b> of its land area.
              </div>
              <EChart option={densityOption} height={300} />
              <div style={{ fontSize: 12, color: COLORS.faint }}>2020 tropical tree cover extent</div>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
