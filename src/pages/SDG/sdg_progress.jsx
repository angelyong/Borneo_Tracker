import { useMemo, useState } from 'react';
import Sidebar from '../../components/sidebar';
import MiniTopBar from '../../components/MiniTopBar';
import {
  SDG_GOALS,
  TERRITORIES,
  formatValue,
  getRowsForSdg,
  summarizeRows,
  titleCaseConfidence,
  useIndicators,
} from '../../data/useIndicators';

const SDGProgress = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('Sarawak');
  const [selectedGoal, setSelectedGoal] = useState('SDG1');
  const { data, loading, error } = useIndicators();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const rows = useMemo(() => {
    if (!data?.rows) return [];
    return getRowsForSdg(data.rows, selectedRegion, selectedGoal);
  }, [data, selectedGoal, selectedRegion]);
  const summary = summarizeRows(rows);
  const goalLabel = SDG_GOALS.find((item) => item.goal === selectedGoal)?.label || selectedGoal;

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.sidebarWrapper,
          width: isSidebarOpen ? '240px' : '0px',
          minWidth: isSidebarOpen ? '240px' : '0px',
        }}
      >
        <Sidebar />
      </div>

      <div style={styles.rightCol}>
        <MiniTopBar onMenuClick={toggleSidebar} notifCount={2} />

        <div style={styles.content}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.pageTitle}>SDG Progress</h1>
            <p style={styles.pageSubtitle}>
              UN Sustainable Development Goals tracked with real snapshot data and visible confidence tags
            </p>
          </div>
          <div style={styles.headerRight}>
            <select
              value={selectedRegion}
              onChange={(event) => setSelectedRegion(event.target.value)}
              style={styles.dropdown}
            >
              {TERRITORIES.map((territory) => (
                <option key={territory} value={territory}>
                  {territory}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.tabs}>
          {SDG_GOALS.map(({ goal, label }) => (
            <button
              key={goal}
              onClick={() => setSelectedGoal(goal)}
              style={{
                ...styles.tab,
                ...(selectedGoal === goal ? styles.tabActive : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <div style={styles.messageCard}>Loading real indicator data…</div> : null}
        {error ? <div style={styles.errorCard}>{error}</div> : null}

        {!loading && !error ? (
          <div style={styles.dashboardGrid}>
            <div style={styles.card}>
              <div style={styles.scoreCard}>
                <div style={styles.scoreHeader}>
                  <div style={styles.scoreLabel}>
                    {selectedGoal} · {goalLabel}
                  </div>
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
                      <span style={styles.metricMeta}>
                        {row.year} · {row.source}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={styles.emptyState}>
                    No canonical indicators are available for this goal in {selectedRegion} yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
};

// ---- Light mode styles (matches esg_indicator.jsx) ----
const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100%',
    backgroundColor: '#f3f4f6',
    fontFamily: 'Inter, Arial, sans-serif',
    overflow: 'hidden',
  },
  sidebarWrapper: {
    overflow: 'hidden',
    transition: 'width 0.3s ease, min-width 0.3s ease',
    flexShrink: 0,
    height: '100%',
  },
  rightCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '4px 0 0 0',
  },
  headerRight: {
    flexShrink: 0,
  },
  dropdown: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    fontSize: '14px',
    fontWeight: '500',
    color: '#1f2937',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '150px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    backgroundColor: '#ffffff',
    padding: '6px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    width: 'fit-content',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.05)',
    border: '1px solid #e5e7eb',
  },
  scoreCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  scoreHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  },
  scoreNumber: {
    fontSize: '48px',
    fontWeight: '700',
    color: '#1f2937',
    lineHeight: 1.2,
  },
  scoreCaption: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '-8px',
  },
  trendContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderTop: '1px solid #f3f4f6',
    borderBottom: '1px solid #f3f4f6',
  },
  trendLabel: {
    fontSize: '14px',
    color: '#6b7280',
  },
  trendValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
  },
  bestRiskGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  bestRiskItem: {
    backgroundColor: '#f9fafb',
    padding: '12px 16px',
    borderRadius: '8px',
  },
  bestRiskLabel: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  bestRiskValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
  },
  metricsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  metricCard: {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '14px 16px',
    backgroundColor: '#f9fafb',
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
  },
  metricLabel: {
    fontSize: '15px',
    color: '#4b5563',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    display: 'block',
    marginTop: '8px',
  },
  metricMeta: {
    display: 'block',
    marginTop: '8px',
    fontSize: '12px',
    color: '#6b7280',
    lineHeight: 1.5,
  },
  confidenceBadge: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#065f46',
    backgroundColor: '#d1fae5',
    borderRadius: '999px',
    padding: '4px 8px',
    whiteSpace: 'nowrap',
  },
  messageCard: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    color: '#374151',
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #fecaca',
    color: '#b91c1c',
  },
  emptyState: {
    fontSize: '14px',
    color: '#6b7280',
    padding: '12px 0',
  },
};

export default SDGProgress;
