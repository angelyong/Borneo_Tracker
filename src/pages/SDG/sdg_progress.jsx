import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SDG_GOALS,
  TERRITORIES,
  formatValue,
  getRowsForSdg,
  summarizeRows,
  titleCaseConfidence,
  useIndicators,
} from '../../data/useIndicators';
import ExportMenu from '../../components/ExportMenu';

const SDGProgress = () => {
  const { t } = useTranslation();
  const [selectedRegion, setSelectedRegion] = useState('Sarawak');
  const [selectedGoal, setSelectedGoal] = useState('SDG1');
  const { data, loading, error } = useIndicators();
  const contentRef = useRef(null);

  const rows = useMemo(() => {
    if (!data?.rows) return [];
    return getRowsForSdg(data.rows, selectedRegion, selectedGoal);
  }, [data, selectedGoal, selectedRegion]);
  const summary = summarizeRows(rows);
  const goalLabel = SDG_GOALS.find((item) => item.goal === selectedGoal)?.label || selectedGoal;
  const filenameBase = `sdg-${selectedGoal}-${selectedRegion}`.toLowerCase().replace(/\s+/g, '-');

  return (
    <div style={styles.container}>


      <div style={styles.rightCol}>
        <div style={styles.content} ref={contentRef}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.pageTitle}>{t('sdg.title')}</h1>
            <p style={styles.pageSubtitle}>
              {t('sdg.subtitle')}
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
            {!loading && !error && (
              <ExportMenu targetRef={contentRef} filenameBase={filenameBase} rows={rows} />
            )}
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

        {loading ? <div style={styles.messageCard}>{t('esg.loadingIndicatorData')}</div> : null}
        {error ? <div style={styles.errorCard}>{error}</div> : null}

        {!loading && !error ? (
          <div style={styles.dashboardGrid}>
            <div style={styles.card}>
              <div style={styles.scoreCard}>
                <div style={styles.scoreHeader}>
                  <div style={styles.scoreLabel}>
                    {selectedGoal} · {goalLabel}
                  </div>
                  <div style={styles.statusBadge}>{t('esg.snapshotOnly')}</div>
                </div>

                <div style={styles.scoreNumber}>{summary.count}</div>
                <div style={styles.scoreCaption}>{t('esg.canonicalIndicatorsAvailable')}</div>

                <div style={styles.trendContainer}>
                  <span style={styles.trendLabel}>{t('esg.latestDataYear')}</span>
                  <span style={styles.trendValue}>{summary.latestYear || t('esg.unknown')}</span>
                </div>

                <div style={styles.bestRiskGrid}>
                  <div style={styles.bestRiskItem}>
                    <div style={styles.bestRiskLabel}>{t('esg.confidenceMix')}</div>
                    <div style={styles.bestRiskValue}>
                      {Object.keys(summary.confidenceCounts).length
                        ? Object.entries(summary.confidenceCounts)
                            .map(([label, count]) => `${titleCaseConfidence(label)} ${count}`)
                            .join(' · ')
                        : t('common.noData')}
                    </div>
                  </div>
                  <div style={styles.bestRiskItem}>
                    <div style={styles.bestRiskLabel}>{t('esg.trendStatus')}</div>
                    <div style={styles.bestRiskValue}>{t('esg.historicalSeriesNotEnabled')}</div>
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
                    {t('sdg.noCanonicalIndicatorsForRegion', { region: selectedRegion })}
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

// ---- Theme-reactive styles (matches esg_indicator.jsx) ----
const styles = {
  container: {
    display: 'flex',
    minHeight: '100%',
    width: '100%',
    backgroundColor: 'var(--color-page-bg)',
    fontFamily: 'Inter, Arial, sans-serif',
    overflow: 'visible',
  },
  sidebarWrapper: {
    overflow: 'visible',
    transition: 'width 0.3s ease, min-width 0.3s ease',
    flexShrink: 0,
    height: '100%',
  },
  rightCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    overflow: 'visible',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflow: 'visible',
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
    color: 'var(--color-ink)',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '14px',
    color: 'var(--color-muted)',
    margin: '4px 0 0 0',
  },
  headerRight: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  dropdown: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--color-ink)',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '150px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    backgroundColor: 'var(--color-card)',
    padding: '6px',
    borderRadius: '12px',
    border: '1px solid var(--color-border)',
    width: 'fit-content',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--color-muted)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'var(--color-amber)',
    color: '#1f2937',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  card: {
    backgroundColor: 'var(--color-card)',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.05)',
    border: '1px solid var(--color-border)',
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
    color: 'var(--color-ink)',
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
    color: 'var(--color-ink)',
    lineHeight: 1.2,
  },
  scoreCaption: {
    fontSize: '13px',
    color: 'var(--color-muted)',
    marginTop: '-8px',
  },
  trendContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderTop: '1px solid var(--color-border)',
    borderBottom: '1px solid var(--color-border)',
  },
  trendLabel: {
    fontSize: '14px',
    color: 'var(--color-muted)',
  },
  trendValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--color-ink)',
  },
  bestRiskGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  bestRiskItem: {
    backgroundColor: 'var(--color-grey-soft)',
    padding: '12px 16px',
    borderRadius: '8px',
  },
  bestRiskLabel: {
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  bestRiskValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--color-ink)',
  },
  metricsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  metricCard: {
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    padding: '14px 16px',
    backgroundColor: 'var(--color-grey-soft)',
  },
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
  },
  metricLabel: {
    fontSize: '15px',
    color: 'var(--color-ink)',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--color-ink)',
    display: 'block',
    marginTop: '8px',
  },
  metricMeta: {
    display: 'block',
    marginTop: '8px',
    fontSize: '12px',
    color: 'var(--color-muted)',
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
    backgroundColor: 'var(--color-card)',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid var(--color-border)',
    color: 'var(--color-ink)',
  },
  errorCard: {
    backgroundColor: 'var(--color-red-soft)',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid var(--color-red)',
    color: 'var(--color-red)',
  },
  emptyState: {
    fontSize: '14px',
    color: 'var(--color-muted)',
    padding: '12px 0',
  },
};

export default SDGProgress;
