import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import Sidebar from '../../components/sidebar';
import MiniTopBar from '../../components/MiniTopBar';
import {
  TERRITORIES,
  countTrendReadyConcepts,
  formatValue,
  getAvailableConcepts,
  getCanonicalRows,
  getComparisonRows,
  getConfidenceCoverage,
  getEsgCoverage,
  getHexagonCoverage,
  getSeries,
  summarizeRows,
  titleCaseConfidence,
  useIndicators,
  useResilience,
} from '../../data/useIndicators';

const RegionalDetails = () => {
  const [isSidebarOpen,      setIsSidebarOpen]      = useState(true);
  const [selectedTerritory,  setSelectedTerritory]  = useState('Sarawak');
  const [selectedConcept,    setSelectedConcept]    = useState('forest_cover');
  const [chartMode,          setChartMode]          = useState('snapshot');

  const { data,              loading, error } = useIndicators();
  const { data: resilience }                 = useResilience();

  const lineChartRef       = useRef(null);
  const radarChartRef      = useRef(null);
  const barChartRef        = useRef(null);
  const lineChartInstance  = useRef(null);
  const radarChartInstance = useRef(null);
  const barChartInstance   = useRef(null);

  // ── Derived data ─────────────────────────────────────────────────────────
  const canonicalRows = useMemo(
    () => (data?.rows ? getCanonicalRows(data.rows, selectedTerritory) : []),
    [data, selectedTerritory]
  );

  const availableConcepts = useMemo(
    () => (data?.rows ? getAvailableConcepts(data.rows, selectedTerritory) : []),
    [data, selectedTerritory]
  );

  const activeConcept =
    availableConcepts.find((item) => item.concept === selectedConcept)?.concept ||
    availableConcepts[0]?.concept || '';

  const comparisonRows = useMemo(
    () => (data?.rows ? getComparisonRows(data.rows, activeConcept) : []),
    [activeConcept, data]
  );

  const hexagonCoverage    = useMemo(() => getHexagonCoverage(data?.rows || [], selectedTerritory),    [data, selectedTerritory]);
  const esgCoverage        = useMemo(() => getEsgCoverage(data?.rows || [], selectedTerritory),        [data, selectedTerritory]);
  const confidenceCoverage = useMemo(() => getConfidenceCoverage(data?.rows || [], selectedTerritory), [data, selectedTerritory]);

  const summary = summarizeRows(canonicalRows);

  const trendSeries = useMemo(
    () => getSeries(data, selectedTerritory, activeConcept),
    [activeConcept, data, selectedTerritory]
  );

  const activeChartMode     = chartMode === 'trend' && trendSeries ? 'trend' : 'snapshot';
  const trendReadyCount     = countTrendReadyConcepts(data, selectedTerritory);
  const territoryResilience = resilience?.territories?.[selectedTerritory] || null;

  const ragColor = { green: '#16a34a', amber: '#d97706', red: '#dc2626' };

  const selectedConceptLabel =
    availableConcepts.find((item) => item.concept === activeConcept)?.label || 'Selected indicator';

  const theme = {
    primary:     '#22c55e',
    borderLight: '#e5e7eb',
    textMuted:   '#6b7280',
    azure:       '#3b82f6',
  };

  // ── Cross-territory / trend chart ────────────────────────────────────────
  useEffect(() => {
    if (!lineChartRef.current) return;
    lineChartInstance.current = echarts.init(lineChartRef.current);

    const sharedAxisStyle = {
      axisLine: { lineStyle: { color: theme.borderLight } },
      axisTick: { show: false },
      axisLabel: { color: theme.textMuted, fontSize: 11 },
    };
    const sharedValueAxis = {
      type: 'value',
      splitLine: { lineStyle: { color: theme.borderLight, type: 'dashed' } },
      axisLabel:  { color: theme.textMuted, fontSize: 10 },
      axisLine:   { show: false },
      axisTick:   { show: false },
    };

    const option = activeChartMode === 'trend' && trendSeries
      ? {
          tooltip: {
            trigger: 'axis',
            formatter: (params) => {
              const p = params[0];
              return `<strong>${p.axisValue}</strong><br/>${p.marker} ${trendSeries.indicator}: ${p.value}${trendSeries.unit ? ` ${trendSeries.unit}` : ''}`;
            },
          },
          grid: { left: '5%', right: '5%', bottom: '10%', top: '10%', containLabel: true },
          xAxis: { type: 'category', data: trendSeries.points.map((pt) => pt.year), ...sharedAxisStyle },
          yAxis: { ...sharedValueAxis, scale: true },
          series: [{
            name: trendSeries.indicator, type: 'line', smooth: false, symbolSize: 6,
            data: trendSeries.points.map((pt) => pt.value),
            lineStyle: { color: theme.primary, width: 2 },
            itemStyle: { color: theme.primary },
            areaStyle: { color: 'rgba(34,197,94,0.08)' },
          }],
        }
      : {
          tooltip: {
            trigger: 'item',
            formatter: (params) => {
              const row = comparisonRows[params.dataIndex]?.row;
              return `<strong>${params.name}</strong><br/>${row ? formatValue(row) : 'No data'}`;
            },
          },
          grid: { left: '5%', right: '5%', bottom: '10%', top: '10%', containLabel: true },
          xAxis: { type: 'category', data: comparisonRows.map((e) => e.territory), ...sharedAxisStyle },
          yAxis: sharedValueAxis,
          series: [{
            name: selectedConceptLabel, type: 'bar', barWidth: '40%',
            data: comparisonRows.map((e) => e.row?.value ?? null),
            itemStyle: { color: theme.azure, borderRadius: [6, 6, 0, 0] },
          }],
        };

    lineChartInstance.current.setOption(option);
    const onResize = () => lineChartInstance.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); lineChartInstance.current?.dispose(); };
  }, [activeChartMode, comparisonRows, selectedConceptLabel, theme.azure, theme.borderLight, theme.primary, theme.textMuted, trendSeries]);

  // ── Radar chart ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!radarChartRef.current) return;
    radarChartInstance.current = echarts.init(radarChartRef.current);
    radarChartInstance.current.setOption({
      tooltip: { trigger: 'item', formatter: (p) => `<strong>${p.name}</strong><br/>Score: ${p.value}` },
      radar: {
        indicator: Object.keys(hexagonCoverage).map((name) => ({ name, max: 4 })),
        center: ['50%', '50%'], radius: '70%',
        axisName:  { color: '#374151', fontSize: 12, fontWeight: 500 },
        splitArea: { areaStyle: { color: ['rgba(34,197,94,0.02)', 'rgba(34,197,94,0.02)'] } },
        axisLine:  { lineStyle: { color: '#e5e7eb' } },
        splitLine: { lineStyle: { color: '#e5e7eb' } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: Object.values(hexagonCoverage), name: 'Coverage',
          areaStyle: { color: 'rgba(34,197,94,0.3)' },
          lineStyle: { color: '#22c55e', width: 2 },
          itemStyle: { color: '#22c55e' },
        }],
      }],
    });
    const onResize = () => radarChartInstance.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); radarChartInstance.current?.dispose(); };
  }, [hexagonCoverage]);

  // ── ESG pillar bar chart ─────────────────────────────────────────────────
  useEffect(() => {
    if (!barChartRef.current) return;
    barChartInstance.current = echarts.init(barChartRef.current);
    barChartInstance.current.setOption({
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (params) => {
          let html = `<strong>${params[0].axisValue}</strong><br/>`;
          params.forEach((p) => { html += `${p.marker} ${p.seriesName}: ${p.value}<br/>`; });
          return html;
        },
      },
      grid: { left: '8%', right: '5%', bottom: '10%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category', data: ['Environment', 'Social', 'Governance'],
        axisLine: { lineStyle: { color: theme.borderLight } },
        axisTick: { show: false }, axisLabel: { color: theme.textMuted, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: theme.borderLight, type: 'dashed' } },
        axisLabel: { color: theme.textMuted, fontSize: 10 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      legend: { data: ['Indicators'], bottom: 0, left: 'center', icon: 'circle', textStyle: { color: '#374151', fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
      series: [{
        name: 'Indicators', type: 'bar', barWidth: '28%',
        data: Object.values(esgCoverage),
        itemStyle: { color: '#22c55e', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}', fontSize: 10, color: '#6b7280' },
      }],
    });
    const onResize = () => barChartInstance.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); barChartInstance.current?.dispose(); };
  }, [confidenceCoverage, esgCoverage, theme.borderLight, theme.textMuted]);

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>

     

      {/* Right column */}
      <div style={styles.rightCol}>
        <MiniTopBar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} notifCount={2} />

        <div style={styles.content}>

          {/* Toolbar */}
          <div style={styles.topToolbar}>
            <div style={styles.toolbarGroup}>
              <label style={styles.toolbarLabel}>Territory</label>
              <select
                value={selectedTerritory}
                onChange={(e) => setSelectedTerritory(e.target.value)}
                style={styles.toolbarSelect}
              >
                {TERRITORIES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={styles.toolbarGroup}>
              <label style={styles.toolbarLabel}>Comparison Indicator</label>
              <select
                value={activeConcept}
                onChange={(e) => setSelectedConcept(e.target.value)}
                style={styles.toolbarSelect}
              >
                {availableConcepts.map((item) => (
                  <option key={item.concept} value={item.concept}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Loading / error states */}
          {loading && <div style={styles.noticeCard}>Loading snapshot data…</div>}
          {error   && <div style={styles.errorCard}>{error}</div>}

          {!loading && !error && (
            <>
              {/* Summary strip */}
              <div style={styles.summaryStrip}>
                {territoryResilience?.index != null && (
                  <div
                    style={styles.summaryChip}
                    title={`Scored ${territoryResilience.scoredPillars.length}/6 hexagon pillars`}
                  >
                    <span style={styles.summaryChipLabel}>Resilience Index</span>
                    <strong style={{ color: ragColor[territoryResilience.rag] || '#1f2937' }}>
                      {territoryResilience.index}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>
                      weakest: {territoryResilience.weakestPillar} · {territoryResilience.scoredPillars.length}/6 pillars scored
                    </span>
                  </div>
                )}
                <div style={styles.summaryChip}>
                  <span style={styles.summaryChipLabel}>Canonical indicators</span>
                  <strong>{summary.count}</strong>
                </div>
                <div style={styles.summaryChip}>
                  <span style={styles.summaryChipLabel}>Latest year</span>
                  <strong>{summary.latestYear || 'Unknown'}</strong>
                </div>
                <div style={styles.summaryChip}>
                  <span style={styles.summaryChipLabel}>Trend status</span>
                  <strong>
                    {trendReadyCount
                      ? `${trendReadyCount} indicator${trendReadyCount > 1 ? 's' : ''} trend-ready`
                      : 'Snapshot only'}
                  </strong>
                </div>
              </div>

              {/* Chart row */}
              <div style={styles.chartRow}>

                {/* Cross-territory / trend chart */}
                <div style={styles.card}>
                  <div style={styles.chartHeader}>
                    <div style={styles.chartHeaderLeft}>
                      <div style={styles.cardTitle}>
                        {activeChartMode === 'trend'
                          ? `Historical trend — ${selectedTerritory}`
                          : 'Cross-territory snapshot'}
                      </div>
                      <div style={styles.chartStat}>{selectedConceptLabel}</div>
                      <div style={{ fontSize: '11.5px', color: '#6b7280' }}>
                        {activeChartMode === 'trend' && trendSeries
                          ? `${trendSeries.points.length} real annual points · ${trendSeries.source}`
                          : 'Latest available canonical value for each territory'}
                      </div>
                    </div>
                    <div style={styles.chartTabs}>
                      <button
                        onClick={() => setChartMode('snapshot')}
                        style={{ ...styles.chartTab, ...(activeChartMode === 'snapshot' ? styles.chartTabActive : {}) }}
                      >
                        Snapshot
                      </button>
                      <button
                        onClick={() => setChartMode('trend')}
                        disabled={!trendSeries}
                        title={trendSeries ? 'Real annual series' : 'No historical series for this indicator yet'}
                        style={{
                          ...styles.chartTab,
                          ...(activeChartMode === 'trend' ? styles.chartTabActive : {}),
                          ...(!trendSeries ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                        }}
                      >
                        Trend
                      </button>
                    </div>
                  </div>
                  <div style={styles.chartArea}>
                    <div ref={lineChartRef} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={styles.cardFooter}>
                    {activeChartMode === 'trend' && trendSeries ? (
                      <span style={styles.footerItem}>
                        Confidence: <strong>{titleCaseConfidence(trendSeries.confidence)}</strong>
                        {' · '}Data level: <strong>{trendSeries.data_level}</strong>
                      </span>
                    ) : (
                      <>
                        <span style={styles.footerLabel}>Confidence by territory:</span>
                        {comparisonRows.map((entry) => (
                          <span key={entry.territory} style={styles.footerItem}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.primary, display: 'inline-block' }} />
                            {entry.territory}: <strong>{entry.row ? titleCaseConfidence(entry.row.confidence) : 'No data'}</strong>
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Radar chart */}
                <div style={styles.card}>
                  <div style={styles.chartHeader}>
                    <div style={styles.chartHeaderLeft}>
                      <div style={styles.cardTitle}>True Wealth Hexagon Coverage</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                        Count of canonical indicators available per pillar
                      </div>
                    </div>
                    <div style={styles.chartTabs}>
                      <button style={{ ...styles.chartTab, ...styles.chartTabActive }}>Current</button>
                    </div>
                  </div>
                  <div style={styles.chartArea}>
                    <div ref={radarChartRef} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={styles.cardFooter}>
                    {Object.entries(hexagonCoverage).map(([name, value], idx) => (
                      <span key={name} style={styles.footerItem}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ['#22c55e','#3b82f6','#eab308','#a855f7','#ec4899'][idx % 5], display: 'inline-block' }} />
                        {name}: <strong>{value}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* ESG pillar bar */}
              <div style={styles.barRow}>
                <div style={{ ...styles.card, width: '100%' }}>
                  <div style={styles.chartHeader}>
                    <div style={styles.chartHeaderLeft}>
                      <div style={styles.cardTitle}>Coverage by ESG pillar</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                        {trendReadyCount
                          ? 'Real yearly series enabled for selected indicators; the rest remain snapshot-only'
                          : 'Trend charts are held back until the schema stores true yearly series'}
                      </div>
                    </div>
                    <div style={styles.chartTabs}>
                      <button style={{ ...styles.chartTab, ...styles.chartTabActive }}>Current</button>
                    </div>
                  </div>
                  <div style={{ ...styles.chartArea, height: '280px' }}>
                    <div ref={barChartRef} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={styles.confidenceSummary}>
                    {Object.entries(confidenceCoverage).map(([label, value]) => (
                      <span key={label} style={styles.confidenceSummaryItem}>
                        {label}: <strong>{value}</strong>
                      </span>
                    ))}
                  </div>
                  <div style={styles.metricsGrid}>
                    {canonicalRows.map((row) => (
                      <div key={`${row.territory}-${row.indicator}`} style={styles.metricCard}>
                        <div style={styles.metricTitle}>{row.indicator}</div>
                        <div style={styles.metricValue}>{formatValue(row)}</div>
                        <div style={styles.metricMeta}>{row.year} · {titleCaseConfidence(row.confidence)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container:      { display: 'flex', height: '100vh', width: '100%', backgroundColor: '#f3f4f6', fontFamily: 'Inter, Arial, sans-serif', overflow: 'hidden' },
  sidebarWrapper: { overflow: 'hidden', transition: 'width 0.3s ease, min-width 0.3s ease', flexShrink: 0, height: '100%' },
  rightCol:       { flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  content:        { flex: 1, padding: '24px', overflowY: 'auto', boxSizing: 'border-box' },

  topToolbar:   { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  toolbarGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  toolbarLabel: { fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },
  toolbarSelect: { minWidth: '220px', border: '1px solid #d1d5db', borderRadius: '10px', padding: '10px 12px', backgroundColor: '#ffffff', fontSize: '14px', color: '#0f172a' },

  summaryStrip:     { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  summaryChip:      { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '999px', padding: '10px 14px', display: 'flex', gap: '8px', alignItems: 'center', color: '#0f172a' },
  summaryChipLabel: { fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' },

  chartRow: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  barRow:   { marginTop: '20px', width: '100%' },
  card:     { flex: 1, minWidth: '300px', backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px 20px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' },

  chartHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
  chartHeaderLeft: { flex: 1 },
  cardTitle:       { fontSize: '18px', fontWeight: '600', color: '#1f2937', marginBottom: '2px' },
  chartStat:       { fontSize: '24px', fontWeight: '700', color: '#1f2937', marginTop: '4px' },
  chartTabs:       { display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' },
  chartTab:        { background: 'transparent', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', color: '#6b7280', cursor: 'pointer' },
  chartTabActive:  { background: '#ffffff', color: '#1f2937', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  chartArea:       { width: '100%', height: '240px', marginTop: '4px', flexShrink: 0 },
  cardFooter:      { marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: '#6b7280' },
  footerLabel:     { fontWeight: '500', color: '#374151', marginRight: '4px' },
  footerItem:      { display: 'flex', alignItems: 'center', gap: '6px' },

  metricsGrid:           { marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  metricCard:            { borderRadius: '10px', border: '1px solid #e5e7eb', padding: '12px', backgroundColor: '#f8fafc' },
  metricTitle:           { fontSize: '13px', fontWeight: '600', color: '#334155' },
  metricValue:           { fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: '8px' },
  metricMeta:            { marginTop: '6px', fontSize: '12px', color: '#64748b' },
  confidenceSummary:     { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px', color: '#475569', fontSize: '13px' },
  confidenceSummaryItem: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '999px', padding: '6px 10px' },

  noticeCard: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #e5e7eb', color: '#334155' },
  errorCard:  { backgroundColor: '#fef2f2', borderRadius: '12px', padding: '18px 20px', border: '1px solid #fecaca', color: '#b91c1c' },
};

export default RegionalDetails;
