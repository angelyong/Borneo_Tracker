import { useMemo, useState } from 'react';
import Sidebar from '../../components/sidebar';
import MiniTopBar from '../../components/MiniTopBar';
import {
  CATEGORY_TO_PILLAR,
  TERRITORIES,
  formatValue,
  getRowsForPillar,
  summarizeRows,
  titleCaseConfidence,
  useIndicators,
} from '../../data/useIndicators';

const ESGIndicator = () => {
  const [isSidebarOpen, setIsSidebarOpen]     = useState(true);
  const [selectedRegion, setSelectedRegion]   = useState('Sarawak');
  const [selectedCategory, setSelectedCategory] = useState('Environment');
  const { data, loading, error } = useIndicators();

  const rows = useMemo(() => {
    if (!data?.rows) return [];
    return getRowsForPillar(data.rows, selectedRegion, CATEGORY_TO_PILLAR[selectedCategory]);
  }, [data, selectedCategory, selectedRegion]);

  const summary = summarizeRows(rows);

  return (
    <div style={styles.container}>

      {/* ── Sidebar ── */}
      <div style={{
        ...styles.sidebarWrapper,
        width:    isSidebarOpen ? '240px' : '0px',
        minWidth: isSidebarOpen ? '240px' : '0px',
      }}>
        <Sidebar />
      </div>

      {/* ── Right column: topbar + scrollable content ── */}
      <div style={styles.rightCol}>
        <MiniTopBar
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          notifCount={2}
        />

        <div style={styles.content}>

          {/* ── Page header ── */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <h1 style={styles.pageTitle}>ESG Indicators</h1>
              <p style={styles.pageSubtitle}>Real snapshot data grouped by pillar with visible confidence tags</p>
            </div>
            <div style={styles.headerRight}>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                style={styles.dropdown}
              >
                {TERRITORIES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Pillar tabs ── */}
          <div style={styles.tabs}>
            {['Environment', 'Social', 'Governance'].map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                style={{
                  ...styles.tab,
                  ...(selectedCategory === category ? styles.tabActive : {}),
                }}
              >
                {category}
              </button>
            ))}
          </div>

          {/* ── States ── */}
          {loading && <div style={styles.messageCard}>Loading real indicator data…</div>}
          {error   && <div style={styles.errorCard}>{error}</div>}

          {!loading && !error && (
            <div style={styles.dashboardGrid}>

              {/* Left: summary card */}
              <div style={styles.card}>
                <div style={styles.scoreCard}>
                  <div style={styles.scoreHeader}>
                    <div style={styles.scoreLabel}>{selectedCategory} Snapshot</div>
                    <div style={styles.statusBadge}>Snapshot Only</div>
                  </div>
                  <div style={styles.scoreNumber}>{summary.count}</div>
                  <div style={styles.scoreCaption}>canonical indicators available</div>
                  <div style={styles.trendContainer}>
                    <span style={styles.trendLabel}>Latest data year</span>
                    <span style={styles.trendValue}>{summary.latestYear || 'Unknown'}</span>
                  </div>
                  <div style={styles.bestRiskGrid}>
                    <div style={styles.bestRiskItem}>
                      <div style={styles.bestRiskLabel}>Confidence mix</div>
                      <div style={styles.bestRiskValue}>
                        {Object.keys(summary.confidenceCounts).length
                          ? Object.entries(summary.confidenceCounts)
                              .map(([label, count]) => `${titleCaseConfidence(label)} ${count}`)
                              .join(' · ')
                          : 'No data'}
                      </div>
                    </div>
                    <div style={styles.bestRiskItem}>
                      <div style={styles.bestRiskLabel}>Trend status</div>
                      <div style={styles.bestRiskValue}>Historical series not enabled yet</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: metrics list */}
              <div style={styles.card}>
                <div style={styles.metricsList}>
                  {rows.length ? (
                    rows.map((row) => (
                      <div key={`${row.territory}-${row.indicator}`} style={styles.metricCard}>
                        <div style={styles.metricHeader}>
                          <span style={styles.metricLabel}>{row.indicator}</span>
                          <span style={styles.confidenceBadge}>{titleCaseConfidence(row.confidence)}</span>
                        </div>
                        <span style={styles.metricValue}>{formatValue(row)}</span>
                        <span style={styles.metricMeta}>{row.year} · {row.source}</span>
                      </div>
                    ))
                  ) : (
                    <div style={styles.emptyState}>No canonical indicators are available for this pillar yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  // ── Layout ──
  container: {
    display:         'flex',
    height:          '100vh',
    width:           '100%',
    backgroundColor: '#f3f4f6',
    fontFamily:      'Inter, Arial, sans-serif',
    overflow:        'hidden',
  },
  sidebarWrapper: {
    overflow:   'hidden',
    transition: 'width 0.3s ease, min-width 0.3s ease',
    flexShrink: 0,
    height:     '100%',
  },
  rightCol: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    height:        '100vh',
    overflow:      'hidden',
  },
  content: {
    flex:      1,
    overflowY: 'auto',
    padding:   '24px',
    boxSizing: 'border-box',
  },

  // ── Header ──
  header: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   '24px',
    flexWrap:       'wrap',
    gap:            '16px',
  },
  headerLeft:  { flex: 1 },
  headerRight: { flexShrink: 0 },
  pageTitle: {
    fontSize:   '24px',
    fontWeight: '700',
    color:      '#1f2937',
    margin:     0,
  },
  pageSubtitle: {
    fontSize: '14px',
    color:    '#6b7280',
    margin:   '4px 0 0 0',
  },
  dropdown: {
    padding:         '10px 16px',
    borderRadius:    '8px',
    border:          '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    fontSize:        '14px',
    fontWeight:      '500',
    color:           '#1f2937',
    cursor:          'pointer',
    outline:         'none',
    minWidth:        '150px',
  },

  // ── Tabs ──
  tabs: {
    display:         'flex',
    gap:             '8px',
    marginBottom:    '24px',
    backgroundColor: '#ffffff',
    padding:         '6px',
    borderRadius:    '12px',
    border:          '1px solid #e5e7eb',
    width:           'fit-content',
  },
  tab: {
    padding:         '10px 24px',
    borderRadius:    '8px',
    border:          'none',
    fontSize:        '14px',
    fontWeight:      '500',
    color:           '#6b7280',
    cursor:          'pointer',
    transition:      'all 0.2s ease',
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#1f2937',
    color:           '#ffffff',
  },

  // ── Grid ──
  dashboardGrid: {
    display:             'grid',
    gridTemplateColumns: '1fr 1fr',
    gap:                 '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius:    '12px',
    padding:         '24px',
    boxShadow:       '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.05)',
    border:          '1px solid #e5e7eb',
  },

  // ── Score card ──
  scoreCard:    { display: 'flex', flexDirection: 'column', gap: '16px' },
  scoreHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel:   { fontSize: '16px', fontWeight: '600', color: '#1f2937' },
  statusBadge:  { padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' },
  scoreNumber:  { fontSize: '48px', fontWeight: '700', color: '#1f2937', lineHeight: 1.2 },
  scoreCaption: { fontSize: '13px', color: '#6b7280', marginTop: '-8px' },
  trendContainer: {
    display:       'flex',
    alignItems:    'center',
    gap:           '12px',
    padding:       '8px 0',
    borderTop:     '1px solid #f3f4f6',
    borderBottom:  '1px solid #f3f4f6',
  },
  trendLabel: { fontSize: '14px', color: '#6b7280' },
  trendValue: { fontSize: '16px', fontWeight: '600', color: '#1f2937' },
  bestRiskGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  bestRiskItem: { backgroundColor: '#f9fafb', padding: '12px 16px', borderRadius: '8px' },
  bestRiskLabel: {
    fontSize:        '12px',
    fontWeight:      '500',
    color:           '#6b7280',
    textTransform:   'uppercase',
    letterSpacing:   '0.5px',
    marginBottom:    '4px',
  },
  bestRiskValue: { fontSize: '16px', fontWeight: '600', color: '#1f2937' },

  // ── Metrics list ──
  metricsList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  metricCard: {
    border:          '1px solid #e5e7eb',
    borderRadius:    '10px',
    padding:         '14px 16px',
    backgroundColor: '#f9fafb',
  },
  metricHeader: {
    display:        'flex',
    justifyContent: 'space-between',
    gap:            '12px',
    alignItems:     'flex-start',
  },
  metricLabel:  { fontSize: '15px', color: '#4b5563', fontWeight: '500' },
  metricValue:  { fontSize: '16px', fontWeight: '600', color: '#1f2937', display: 'block', marginTop: '8px' },
  metricMeta:   { display: 'block', marginTop: '8px', fontSize: '12px', color: '#6b7280', lineHeight: 1.5 },
  confidenceBadge: {
    fontSize:        '12px',
    fontWeight:      '600',
    color:           '#065f46',
    backgroundColor: '#d1fae5',
    borderRadius:    '999px',
    padding:         '4px 8px',
    whiteSpace:      'nowrap',
  },

  // ── States ──
  messageCard: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e5e7eb', color: '#374151' },
  errorCard:   { backgroundColor: '#fef2f2', borderRadius: '12px', padding: '24px', border: '1px solid #fecaca', color: '#b91c1c' },
  emptyState:  { fontSize: '14px', color: '#6b7280', padding: '12px 0' },
};

export default ESGIndicator;
