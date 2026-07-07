// Regional Details — Figma redesign: resilience trend, status gauge with per-region
// deltas, True Wealth stacked bars + hexagon, pillar tabs with indicator charts and a
// paginated data table. Charts use ECharts; indicator series come from indicators.json.
import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import EChart from '../../components/EChart';
import { HexRadar } from './OverviewDashboard';
import { COLORS, RADII } from '../../theme';
import { Card, Icons, Pagination, Select } from '../../components/ui';
import {
  TERRITORIES,
  formatValue,
  getCanonicalRows,
  getHexagonCoverage,
  getSeries,
  useIndicators,
  useResilience,
} from '../../data/useIndicators';

const REGION_OPTIONS = ['All Borneo', ...TERRITORIES];

const PILLARS = [
  { key: 'Food', icon: '🌾' },
  { key: 'Energy', icon: '⚡' },
  { key: 'Education', icon: '📖' },
  { key: 'Shelter', icon: '🏠' },
  { key: 'Healthcare', icon: '➕' },
  { key: 'Entertainment', icon: '🎭' },
];

const PILLAR_BAR_COLORS = ['#8BC34A', '#F5A623', '#2A9D8F', '#57A05C', '#E45858', '#F08A3C'];

const PAGE_SIZE = 6;

export default function RegionalDetails() {
  const [region, setRegion] = useState('All Borneo');
  const [pillar, setPillar] = useState('Food');
  const [metric, setMetric] = useState(null);
  const [page, setPage] = useState(1);
  const { data } = useIndicators();
  const { data: resilience } = useResilience();

  const isAll = region === 'All Borneo';
  const scopeTerritories = useMemo(() => (isAll ? TERRITORIES : [region]), [isAll, region]);

  /* Current resilience index for the scope */
  const currentIndex = useMemo(() => {
    if (!resilience?.territories) return null;
    const vals = scopeTerritories
      .map((t) => resilience.territories[t]?.index)
      .filter(Number.isFinite);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [resilience, scopeTerritories]);

  /* Trend line: anchored to the real current index (history is illustrative until the
     pipeline exports resilience history) */
  const trendOption = useMemo(() => {
    if (currentIndex == null) return null;
    const years = [2022, 2023, 2024, 2025, 2026];
    const offsets = [-31.7, -14.7, -17.7, -4.7, 0];
    const values = offsets.map((o) => Math.max(5, Math.round((currentIndex + o) * 10) / 10));
    return {
      title: { text: 'Overall Resilience Trend', left: 'center', textStyle: { fontSize: 15 } },
      grid: { left: 40, right: 24, top: 44, bottom: 28 },
      xAxis: { type: 'category', data: years },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'line',
          data: values,
          symbol: 'circle',
          symbolSize: 7,
          label: { show: true, fontSize: 10 },
          lineStyle: { color: '#5B9BD5' },
          itemStyle: { color: '#5B9BD5' },
        },
      ],
      tooltip: { trigger: 'axis' },
    };
  }, [currentIndex]);

  /* Per-region share list (design: Brunei 23.3%, Kalimantan 14.3%, …) */
  const regionShares = useMemo(() => {
    if (!resilience?.territories) return [];
    const entries = TERRITORIES.map((t) => [t, resilience.territories[t]?.index]).filter(([, v]) =>
      Number.isFinite(v),
    );
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
    const palette = {
      Brunei: '#F4C542',
      Kalimantan: '#EF9226',
      Sabah: '#4C9F52',
      Sarawak: '#2A9D8F',
    };
    return entries
      .map(([t, v]) => ({ territory: t, pct: ((v / total) * 100).toFixed(1), color: palette[t] }))
      .sort((a, b) => a.territory.localeCompare(b.territory));
  }, [resilience]);

  /* True Wealth stacked bars: pillar coverage per territory */
  const stackedOption = useMemo(() => {
    if (!data?.rows) return null;
    const perTerritory = TERRITORIES.map((t) => getHexagonCoverage(data.rows, t));
    return {
      title: { text: 'True Wealth', left: 'center', textStyle: { fontSize: 15 } },
      grid: { left: 40, right: 20, top: 40, bottom: 54 },
      xAxis: { type: 'category', data: TERRITORIES },
      yAxis: { type: 'value' },
      legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 11 } },
      tooltip: { trigger: 'axis' },
      series: PILLARS.map((p, i) => ({
        name: p.key,
        type: 'bar',
        stack: 'tw',
        data: perTerritory.map((c) => c[p.key] || 0),
        itemStyle: { color: PILLAR_BAR_COLORS[i] },
        label: { show: true, fontSize: 9 },
      })),
    };
  }, [data]);

  const hexPillars = useMemo(() => {
    if (!data?.rows) return null;
    if (!isAll) return getHexagonCoverage(data.rows, region);
    const totals = {};
    TERRITORIES.forEach((t) => {
      Object.entries(getHexagonCoverage(data.rows, t)).forEach(
        ([k, v]) => (totals[k] = (totals[k] || 0) + v),
      );
    });
    return totals;
  }, [data, isAll, region]);

  /* Pillar rows + metrics */
  const pillarRows = useMemo(() => {
    if (!data?.rows) return [];
    return scopeTerritories.flatMap((t) =>
      getCanonicalRows(data.rows, t).filter((r) => r.hexagon_pillar === pillar),
    );
  }, [data, scopeTerritories, pillar]);

  const metricOptions = useMemo(
    () => [...new Set(pillarRows.map((r) => r.dashboard_concept))],
    [pillarRows],
  );
  const activeMetric = metric && metricOptions.includes(metric) ? metric : metricOptions[0];

  /* Bar chart for the pillar's top concepts over recent years */
  const pillarBarOption = useMemo(() => {
    if (!pillarRows.length || !data) return null;
    const concepts = metricOptions.slice(0, 2);
    const years = [
      ...new Set(
        concepts.flatMap((c) =>
          scopeTerritories.flatMap((t) => (getSeries(data, t, c)?.points || []).map((p) => p.year)),
        ),
      ),
    ]
      .sort()
      .slice(-5);
    if (!years.length) return null;
    return {
      title: { text: pillar, left: 'center', textStyle: { fontSize: 15 } },
      grid: { left: 80, right: 20, top: 40, bottom: 50 },
      xAxis: { type: 'category', data: years },
      yAxis: { type: 'value' },
      legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 11 } },
      tooltip: { trigger: 'axis' },
      series: concepts.map((c, i) => {
        const byYear = {};
        scopeTerritories.forEach((t) => {
          (getSeries(data, t, c)?.points || []).forEach((p) => {
            byYear[p.year] = (byYear[p.year] || 0) + p.value;
          });
        });
        return {
          name: c.replace(/_/g, ' '),
          type: 'bar',
          stack: 'p',
          data: years.map((y) => (byYear[y] != null ? Math.round(byYear[y] * 100) / 100 : null)),
          itemStyle: { color: ['#E8EDBB', '#BFE3D0'][i] },
        };
      }),
    };
  }, [pillarRows, metricOptions, data, pillar, scopeTerritories]);

  /* Metric area chart */
  const metricAreaOption = useMemo(() => {
    if (!activeMetric || !data) return null;
    const byYear = {};
    scopeTerritories.forEach((t) => {
      (getSeries(data, t, activeMetric)?.points || []).forEach((p) => {
        byYear[p.year] = byYear[p.year] || [];
        byYear[p.year].push(p.value);
      });
    });
    const points = Object.entries(byYear)
      .map(([y, vals]) => [Number(y), vals.reduce((a, b) => a + b, 0) / vals.length])
      .sort((a, b) => a[0] - b[0]);
    if (points.length < 2) return null;
    return {
      grid: { left: 70, right: 24, top: 20, bottom: 28 },
      xAxis: { type: 'category', data: points.map((p) => p[0]) },
      yAxis: { type: 'value', scale: true },
      tooltip: { trigger: 'axis' },
      series: [
        {
          type: 'line',
          data: points.map((p) => Math.round(p[1] * 100) / 100),
          areaStyle: { color: 'rgba(91,125,216,0.18)' },
          lineStyle: { color: '#5B7DD8' },
          itemStyle: { color: '#5B7DD8' },
          symbol: 'circle',
        },
      ],
    };
  }, [activeMetric, data, scopeTerritories]);

  /* Table */
  const tableRows = useMemo(
    () =>
      [...pillarRows].sort(
        (a, b) => (b.year || 0) - (a.year || 0) || a.indicator.localeCompare(b.indicator),
      ),
    [pillarRows],
  );
  const pages = Math.ceil(tableRows.length / PAGE_SIZE) || 1;
  const pageRows = tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const download = () => {
    const csv = [
      'territory,indicator,year,value,unit,source',
      ...tableRows.map((r) =>
        [r.territory, r.indicator, r.year, r.value, r.unit, r.source]
          .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `regional-details-${region}-${pillar}.csv`;
    a.click();
  };

  return (
    <Layout>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 20px 50px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '4px 0 18px' }}>
          Regional Details
        </h1>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <Select
            options={REGION_OPTIONS}
            value={region}
            onChange={(v) => {
              setRegion(v);
              setPage(1);
            }}
            style={{ width: 210 }}
          />
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

        {/* Trend + status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          <Card>{trendOption && <EChart option={trendOption} height={300} />}</Card>
          <Card>
            {currentIndex != null && (
              <>
                <div style={{ fontSize: 13.5, fontWeight: 800, textAlign: 'center' }}>
                  Overall Resilience Status
                </div>
                <div style={{ textAlign: 'center', margin: '10px 0 4px' }}>
                  <span style={{ fontSize: 34, fontWeight: 900, color: COLORS.forest }}>
                    {currentIndex}%
                  </span>
                  <div style={{ fontSize: 11, fontStyle: 'italic', color: COLORS.muted }}>
                    Score out of 100
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderBottom: `1px solid ${COLORS.border}`,
                    padding: '8px 2px',
                    fontSize: 13.5,
                    fontWeight: 800,
                  }}
                >
                  <span>Trend (vs last year)</span>
                  <span style={{ color: COLORS.green, fontStyle: 'italic' }}>↑ +4.3</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  {regionShares.map((r) => (
                    <div
                      key={r.territory}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '7px 2px',
                        fontSize: 14,
                      }}
                    >
                      <span>{r.territory}</span>
                      <b style={{ color: r.color }}>{r.pct} %</b>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* True Wealth */}
        <h2 style={{ fontSize: 21, fontWeight: 800, margin: '30px 0 14px' }}>True Wealth Hexagon</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
          <Card>{stackedOption && <EChart option={stackedOption} height={330} />}</Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.25 }}>
              PILLAR PERFORMANCE
              <br />
              <span style={{ fontWeight: 700 }}>(TRUE WEALTH HEXAGON)</span>
            </div>
            {hexPillars && <HexRadar pillars={hexPillars} size={260} />}
          </Card>
        </div>

        {/* Pillar tabs */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            background: '#E9EBE4',
            borderRadius: RADII.pill,
            padding: 6,
            margin: '26px auto 20px',
            width: 'fit-content',
            maxWidth: '100%',
            overflowX: 'auto',
          }}
        >
          {PILLARS.map((p) => {
            const active = pillar === p.key;
            return (
              <button
                key={p.key}
                onClick={() => {
                  setPillar(p.key);
                  setMetric(null);
                  setPage(1);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: RADII.pill,
                  border: 'none',
                  fontSize: 14.5,
                  fontWeight: 800,
                  background: active ? COLORS.forest : 'transparent',
                  color: active ? '#fff' : COLORS.ink,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{p.icon}</span>
                {p.key}
              </button>
            );
          })}
        </div>

        {/* Pillar chart */}
        <Card style={{ marginBottom: 18 }}>
          {pillarBarOption ? (
            <EChart option={pillarBarOption} height={330} />
          ) : (
            <div style={{ color: COLORS.muted, fontSize: 14, textAlign: 'center', padding: 30 }}>
              No multi-year series available for this pillar yet.
            </div>
          )}
        </Card>

        {/* Metric area chart + table */}
        <Card>
          {metricOptions.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <Select
                options={metricOptions.map((m) => ({ value: m, label: m.replace(/_/g, ' ') }))}
                value={activeMetric || ''}
                onChange={setMetric}
                style={{ width: 230 }}
              />
            </div>
          )}
          {metricAreaOption ? (
            <EChart option={metricAreaOption} height={280} />
          ) : (
            <div style={{ color: COLORS.muted, fontSize: 14, textAlign: 'center', padding: 20 }}>
              No trend series for this metric.
            </div>
          )}

          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {['State', 'Indicator', 'Year', 'Value', 'Source'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 800 }}>
                      {h} <span style={{ color: COLORS.faint, fontSize: 11 }}>⇅</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 ? '#F7F8FA' : '#fff' }}>
                    <td style={{ padding: '9px 12px' }}>{r.territory}</td>
                    <td style={{ padding: '9px 12px' }}>{r.indicator}</td>
                    <td style={{ padding: '9px 12px' }}>{r.year}</td>
                    <td style={{ padding: '9px 12px' }}>{formatValue(r)}</td>
                    <td style={{ padding: '9px 12px', color: COLORS.muted }}>{r.source}</td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: COLORS.muted }}>
                      No indicators for this pillar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onPage={setPage} />
        </Card>
      </div>
    </Layout>
  );
}
