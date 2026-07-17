import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts';
import {
  TERRITORIES,
  countTrendReadyConcepts,
  formatValue,
  getAvailableConcepts,
  getCanonicalRows,
  getComparisonRows,
  getConfidenceCoverage,
  getEsgCoverage,
  getSeries,
  summarizeRows,
  titleCaseConfidence,
  useIndicators,
  useResilience,
} from '../../data/useIndicators';
import { THEME_CHANGE_EVENT, cssVar } from '../../utils/theme';
import ProvenanceChip from '../../components/ProvenanceChip';
import HexRadar from '../../components/HexRadar';

const RegionalDetails = () => {
  const { t, i18n } = useTranslation();
  const [selectedTerritory,  setSelectedTerritory]  = useState('Sarawak');
  const [selectedConcept,    setSelectedConcept]    = useState('forest_cover');
  const [chartMode,          setChartMode]          = useState('snapshot');
  // ECharts draws to a canvas, so it can't read CSS vars directly — bump this
  // on theme change to force the chart-building effects below to re-run and
  // re-read the current colors via cssVar().
  const [themeVersion,       setThemeVersion]       = useState(0);

  const { data,              loading, error } = useIndicators();
  const { data: resilience }                 = useResilience();

  const lineChartRef       = useRef(null);
  const barChartRef        = useRef(null);
  const lineChartInstance  = useRef(null);
  const barChartInstance   = useRef(null);

  useEffect(() => {
    const onThemeChange = () => setThemeVersion((v) => v + 1);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  }, []);

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
  // Real 0–100 resilience scores per hexagon pillar (only exists for the four
  // territories). Null for unsupported scopes or while loading — the radar card
  // falls back to an honest note in that case.
  const pillarScores        = territoryResilience?.pillarScores || null;

  const ragColor = { green: '#16a34a', amber: '#d97706', red: '#dc2626' };

  const selectedConceptLabel =
    availableConcepts.find((item) => item.concept === activeConcept)?.label || t('regional.selectedIndicator');

  const theme = useMemo(() => ({
    primary:     '#22c55e',
    borderLight: cssVar('--color-border', '#e5e7eb'),
    textMuted:   cssVar('--color-muted', '#6b7280'),
    azure:       '#3b82f6',
    ink:         cssVar('--color-ink', '#1f2937'),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- themeVersion isn't read above; it's a deliberate cache-buster forcing a fresh cssVar() read when the theme toggles
  }), [themeVersion]);

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
              return `<strong>${params.name}</strong><br/>${row ? formatValue(row) : t('common.noData')}`;
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
    // i18n.language forces a rebuild so canvas-drawn tooltip text picks up the new language.
  }, [activeChartMode, comparisonRows, i18n.language, selectedConceptLabel, t, theme.azure, theme.borderLight, theme.primary, theme.textMuted, trendSeries]);

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
        type: 'category',
        data: [t('esg.categoryEnvironment'), t('esg.categorySocial'), t('esg.categoryGovernance')],
        axisLine: { lineStyle: { color: theme.borderLight } },
        axisTick: { show: false }, axisLabel: { color: theme.textMuted, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: theme.borderLight, type: 'dashed' } },
        axisLabel: { color: theme.textMuted, fontSize: 10 },
        axisLine: { show: false }, axisTick: { show: false },
      },
      legend: { data: [t('regional.indicatorsSeriesName')], bottom: 0, left: 'center', icon: 'circle', textStyle: { color: theme.ink, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
      series: [{
        name: t('regional.indicatorsSeriesName'), type: 'bar', barWidth: '28%',
        data: Object.values(esgCoverage),
        itemStyle: { color: '#22c55e', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}', fontSize: 10, color: theme.textMuted },
      }],
    });
    const onResize = () => barChartInstance.current?.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); barChartInstance.current?.dispose(); };
    // i18n.language forces a rebuild so canvas-drawn axis/legend text picks up the new language.
  }, [confidenceCoverage, esgCoverage, i18n.language, t, theme.borderLight, theme.ink, theme.textMuted]);

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>

     

      {/* Right column */}
      <div style={styles.rightCol}>
        <div style={styles.content}>

          {/* Toolbar */}
          <div style={styles.topToolbar}>
            <div style={styles.toolbarGroup}>
              <label style={styles.toolbarLabel}>{t('regional.territory')}</label>
              <select
                value={selectedTerritory}
                onChange={(e) => setSelectedTerritory(e.target.value)}
                style={styles.toolbarSelect}
              >
                {TERRITORIES.map((territory) => <option key={territory} value={territory}>{territory}</option>)}
              </select>
            </div>
            <div style={styles.toolbarGroup}>
              <label style={styles.toolbarLabel}>{t('regional.comparisonIndicator')}</label>
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
          {loading && <div style={styles.noticeCard}>{t('regional.loadingSnapshotData')}</div>}
          {error   && <div style={styles.errorCard}>{error}</div>}

          {!loading && !error && (
            <>
              {/* Summary strip */}
              <div style={styles.summaryStrip}>
                {territoryResilience?.index != null && (
                  <div
                    style={styles.summaryChip}
                    title={t('regional.scoredPillarsTitle', { count: territoryResilience.scoredPillars.length })}
                  >
                    <span style={styles.summaryChipLabel}>{t('regional.resilienceIndex')}</span>
                    <strong style={{ color: ragColor[territoryResilience.rag] || 'var(--color-ink)' }}>
                      {territoryResilience.index}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                      {t('regional.weakestPillarsScored', {
                        pillar: territoryResilience.weakestPillar,
                        count: territoryResilience.scoredPillars.length,
                      })}
                    </span>
                  </div>
                )}
                <div style={styles.summaryChip}>
                  <span style={styles.summaryChipLabel}>{t('regional.canonicalIndicators')}</span>
                  <strong>{summary.count}</strong>
                </div>
                <div style={styles.summaryChip}>
                  <span style={styles.summaryChipLabel}>{t('regional.latestYear')}</span>
                  <strong>{summary.latestYear || t('esg.unknown')}</strong>
                </div>
                <div style={styles.summaryChip}>
                  <span style={styles.summaryChipLabel}>{t('esg.trendStatus')}</span>
                  <strong>
                    {trendReadyCount
                      ? t('regional.trendReady', { count: trendReadyCount })
                      : t('regional.snapshotOnly')}
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
                          ? t('regional.historicalTrend', { territory: selectedTerritory })
                          : t('regional.crossTerritorySnapshot')}
                      </div>
                      <div style={styles.chartStat}>{selectedConceptLabel}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>
                        {activeChartMode === 'trend' && trendSeries
                          ? t('regional.realAnnualPoints', { count: trendSeries.points.length, source: trendSeries.source })
                          : t('regional.latestCanonicalValue')}
                      </div>
                    </div>
                    <div style={styles.chartTabs}>
                      <button
                        onClick={() => setChartMode('snapshot')}
                        style={{ ...styles.chartTab, ...(activeChartMode === 'snapshot' ? styles.chartTabActive : {}) }}
                      >
                        {t('regional.snapshot')}
                      </button>
                      <button
                        onClick={() => setChartMode('trend')}
                        disabled={!trendSeries}
                        title={trendSeries ? t('regional.realAnnualSeries') : t('regional.noHistoricalSeries')}
                        style={{
                          ...styles.chartTab,
                          ...(activeChartMode === 'trend' ? styles.chartTabActive : {}),
                          ...(!trendSeries ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                        }}
                      >
                        {t('regional.trend')}
                      </button>
                    </div>
                  </div>
                  <div style={styles.chartArea}>
                    <div ref={lineChartRef} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={styles.cardFooter}>
                    {activeChartMode === 'trend' && trendSeries ? (
                      <span style={styles.footerItem}>
                        {t('regional.confidenceLabel')} <strong>{titleCaseConfidence(trendSeries.confidence)}</strong>
                        {' · '}{t('regional.dataLevelLabel')} <strong>{trendSeries.data_level}</strong>
                      </span>
                    ) : (
                      <>
                        <span style={styles.footerLabel}>{t('regional.confidenceByTerritory')}</span>
                        {comparisonRows.map((entry) => (
                          <span key={entry.territory} style={styles.footerItem}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.primary, display: 'inline-block' }} />
                            {entry.territory}: <strong>{entry.row ? titleCaseConfidence(entry.row.confidence) : t('common.noData')}</strong>
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* True Wealth Hexagon — real 0–100 resilience scores per pillar */}
                <div style={styles.card}>
                  <div style={styles.chartHeader}>
                    <div style={styles.chartHeaderLeft}>
                      <div style={styles.cardTitle}>{t('regional.resilienceByPillarTitle')}</div>
                      <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '4px' }}>
                        {pillarScores
                          ? t('regional.hexagonRealScores')
                          : t('regional.resilienceComputedTerritoryLevel')}
                      </div>
                    </div>
                    <div style={styles.chartTabs}>
                      <button style={{ ...styles.chartTab, ...styles.chartTabActive }}>{t('regional.scores')}</button>
                    </div>
                  </div>
                  <div style={{ ...styles.chartArea, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pillarScores ? (
                      <HexRadar
                        pillars={pillarScores}
                        max={100}
                        weakest={territoryResilience.weakestPillar}
                        maxWidth={230}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-muted)', padding: '0 16px' }}>
                        {t('regional.resilienceComputedTerritoryLevelFull')}
                      </div>
                    )}
                  </div>
                  <div style={styles.cardFooter}>
                    {pillarScores ? (
                      Object.entries(pillarScores).map(([name, value]) => (
                        <span key={name} style={styles.footerItem}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: name === territoryResilience.weakestPillar ? 'var(--color-red)' : theme.primary, display: 'inline-block' }} />
                          {name}: <strong>{value}</strong>
                        </span>
                      ))
                    ) : (
                      <span style={styles.footerItem}>{t('regional.noTerritoryResilienceScores')}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* ESG pillar bar */}
              <div style={styles.barRow}>
                <div style={{ ...styles.card, width: '100%' }}>
                  <div style={styles.chartHeader}>
                    <div style={styles.chartHeaderLeft}>
                      <div style={styles.cardTitle}>{t('regional.coverageByEsgPillar')}</div>
                      <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginTop: '4px' }}>
                        {trendReadyCount
                          ? t('regional.realYearlySeriesEnabled')
                          : t('regional.trendChartsHeldBack')}
                      </div>
                    </div>
                    <div style={styles.chartTabs}>
                      <button style={{ ...styles.chartTab, ...styles.chartTabActive }}>{t('regional.current')}</button>
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
                        <div style={styles.metricMeta}>
                          <ProvenanceChip confidence={row.confidence} source={row.source} year={row.year} />
                        </div>
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
  container:      { display: 'flex', minHeight: '100%', width: '100%', backgroundColor: 'var(--color-page-bg)', fontFamily: 'Inter, Arial, sans-serif', overflow: 'visible' },
  sidebarWrapper: { overflow: 'visible', transition: 'width 0.3s ease, min-width 0.3s ease', flexShrink: 0, height: '100%' },
  rightCol:       { flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%', overflow: 'visible' },
  content:        { flex: 1, padding: '24px', overflow: 'visible', boxSizing: 'border-box' },

  topToolbar:   { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' },
  toolbarGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  toolbarLabel: { fontSize: '12px', fontWeight: '600', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  toolbarSelect: { minWidth: '220px', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '10px 12px', backgroundColor: 'var(--color-card)', fontSize: '14px', color: 'var(--color-ink)' },

  summaryStrip:     { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  summaryChip:      { backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '10px 14px', display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--color-ink)' },
  summaryChipLabel: { fontSize: '12px', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' },

  chartRow: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  barRow:   { marginTop: '20px', width: '100%' },
  card:     { flex: 1, minWidth: '300px', backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '20px 20px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.05)', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' },

  chartHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' },
  chartHeaderLeft: { flex: 1 },
  cardTitle:       { fontSize: '18px', fontWeight: '600', color: 'var(--color-ink)', marginBottom: '2px' },
  chartStat:       { fontSize: '24px', fontWeight: '700', color: 'var(--color-ink)', marginTop: '4px' },
  chartTabs:       { display: 'flex', gap: '4px', background: 'var(--color-page-bg)', padding: '4px', borderRadius: '8px' },
  chartTab:        { background: 'transparent', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', color: 'var(--color-muted)', cursor: 'pointer' },
  chartTabActive:  { background: 'var(--color-amber)', color: '#1f2937', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  chartArea:       { width: '100%', height: '240px', marginTop: '4px', flexShrink: 0 },
  cardFooter:      { marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: 'var(--color-muted)' },
  footerLabel:     { fontWeight: '500', color: 'var(--color-ink)', marginRight: '4px' },
  footerItem:      { display: 'flex', alignItems: 'center', gap: '6px' },

  metricsGrid:           { marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  metricCard:            { borderRadius: '10px', border: '1px solid var(--color-border)', padding: '12px', backgroundColor: 'var(--color-grey-soft)' },
  metricTitle:           { fontSize: '13px', fontWeight: '600', color: 'var(--color-ink)' },
  metricValue:           { fontSize: '18px', fontWeight: '700', color: 'var(--color-ink)', marginTop: '8px' },
  metricMeta:            { marginTop: '6px', fontSize: '12px', color: 'var(--color-muted)' },
  confidenceSummary:     { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px', color: 'var(--color-muted)', fontSize: '13px' },
  confidenceSummaryItem: { backgroundColor: 'var(--color-grey-soft)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '6px 10px' },

  noticeCard: { backgroundColor: 'var(--color-card)', borderRadius: '12px', padding: '18px 20px', border: '1px solid var(--color-border)', color: 'var(--color-ink)' },
  errorCard:  { backgroundColor: 'var(--color-red-soft)', borderRadius: '12px', padding: '18px 20px', border: '1px solid var(--color-red)', color: 'var(--color-red)' },
};

export default RegionalDetails;
