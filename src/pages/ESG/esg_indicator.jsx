import React, { useState } from 'react';
import Sidebar from '../../components/Sidebar';

const ESGIndicator = () => {
  // ---- Sidebar state ----
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // ---- Page state ----
  const [selectedRegion, setSelectedRegion] = useState('Sarawak');
  const [selectedCategory, setSelectedCategory] = useState('Environment');

  // ---- Mock ESG Data ----
  const esgData = {
    Sarawak: {
      Environment: {
        score: 68,
        status: 'Moderate',
        trend: '+2.4%',
        bestIndicator: 'Water Quality',
        riskIndicator: 'Active Fire Hotspots',
        metrics: [
          { label: 'Forest Cover', value: '57.3%' },
          { label: 'Air Quality', value: '42' },
          { label: 'Active Fire Hotspots', value: '42' },
          { label: 'Poverty Rate', value: '13.2%' },
          { label: 'Deforestation Rate', value: '12,450' },
          { label: 'Water Quality', value: '78' },
        ],
      },
      Social: {
        score: 74,
        status: 'Good',
        trend: '+1.8%',
        bestIndicator: 'Education Access',
        riskIndicator: 'Healthcare Availability',
        metrics: [
          { label: 'Literacy Rate', value: '95.2%' },
          { label: 'Life Expectancy', value: '74.5 yrs' },
          { label: 'Healthcare Access', value: '68%' },
          { label: 'Unemployment Rate', value: '4.2%' },
          { label: 'Poverty Rate', value: '13.2%' },
          { label: 'Education Index', value: '0.78' },
        ],
      },
      Governance: {
        score: 61,
        status: 'Moderate',
        trend: '-0.5%',
        bestIndicator: 'Public Participation',
        riskIndicator: 'Corruption Perception',
        metrics: [
          { label: 'Rule of Law Index', value: '0.52' },
          { label: 'Corruption Perception', value: '48' },
          { label: 'Government Effectiveness', value: '0.61' },
          { label: 'Regulatory Quality', value: '0.55' },
          { label: 'Public Participation', value: '72%' },
          { label: 'Transparency Score', value: '58' },
        ],
      },
    },
    Sabah: {
      Environment: {
        score: 72,
        status: 'Good',
        trend: '+1.8%',
        bestIndicator: 'Air Quality',
        riskIndicator: 'Deforestation',
        metrics: [
          { label: 'Forest Cover', value: '62.1%' },
          { label: 'Air Quality', value: '35' },
          { label: 'Active Fire Hotspots', value: '28' },
          { label: 'Poverty Rate', value: '19.5%' },
          { label: 'Deforestation Rate', value: '15,400' },
          { label: 'Water Quality', value: '82' },
        ],
      },
      Social: {
        score: 66,
        status: 'Moderate',
        trend: '+0.9%',
        bestIndicator: 'Community Health',
        riskIndicator: 'Education Gap',
        metrics: [
          { label: 'Literacy Rate', value: '88.4%' },
          { label: 'Life Expectancy', value: '70.2 yrs' },
          { label: 'Healthcare Access', value: '55%' },
          { label: 'Unemployment Rate', value: '6.8%' },
          { label: 'Poverty Rate', value: '19.5%' },
          { label: 'Education Index', value: '0.65' },
        ],
      },
      Governance: {
        score: 58,
        status: 'Moderate',
        trend: '-1.2%',
        bestIndicator: 'Local Governance',
        riskIndicator: 'Budget Transparency',
        metrics: [
          { label: 'Rule of Law Index', value: '0.48' },
          { label: 'Corruption Perception', value: '45' },
          { label: 'Government Effectiveness', value: '0.55' },
          { label: 'Regulatory Quality', value: '0.48' },
          { label: 'Public Participation', value: '61%' },
          { label: 'Transparency Score', value: '52' },
        ],
      },
    },
    Brunei: {
      Environment: {
        score: 85,
        status: 'Good',
        trend: '+3.1%',
        bestIndicator: 'Forest Cover',
        riskIndicator: 'Air Quality',
        metrics: [
          { label: 'Forest Cover', value: '82.4%' },
          { label: 'Air Quality', value: '28' },
          { label: 'Active Fire Hotspots', value: '5' },
          { label: 'Poverty Rate', value: '5.1%' },
          { label: 'Deforestation Rate', value: '1,200' },
          { label: 'Water Quality', value: '92' },
        ],
      },
      Social: {
        score: 88,
        status: 'Good',
        trend: '+2.2%',
        bestIndicator: 'Healthcare Access',
        riskIndicator: 'Workforce Diversity',
        metrics: [
          { label: 'Literacy Rate', value: '97.6%' },
          { label: 'Life Expectancy', value: '78.2 yrs' },
          { label: 'Healthcare Access', value: '92%' },
          { label: 'Unemployment Rate', value: '2.5%' },
          { label: 'Poverty Rate', value: '5.1%' },
          { label: 'Education Index', value: '0.89' },
        ],
      },
      Governance: {
        score: 79,
        status: 'Good',
        trend: '+1.5%',
        bestIndicator: 'Regulatory Quality',
        riskIndicator: 'Public Participation',
        metrics: [
          { label: 'Rule of Law Index', value: '0.68' },
          { label: 'Corruption Perception', value: '62' },
          { label: 'Government Effectiveness', value: '0.75' },
          { label: 'Regulatory Quality', value: '0.72' },
          { label: 'Public Participation', value: '55%' },
          { label: 'Transparency Score', value: '71' },
        ],
      },
    },
    Kalimantan: {
      Environment: {
        score: 55,
        status: 'Poor',
        trend: '-1.2%',
        bestIndicator: 'Water Quality',
        riskIndicator: 'Active Fire Hotspots',
        metrics: [
          { label: 'Forest Cover', value: '45.8%' },
          { label: 'Air Quality', value: '58' },
          { label: 'Active Fire Hotspots', value: '105' },
          { label: 'Poverty Rate', value: '25.3%' },
          { label: 'Deforestation Rate', value: '22,400' },
          { label: 'Water Quality', value: '65' },
        ],
      },
      Social: {
        score: 52,
        status: 'Poor',
        trend: '-0.8%',
        bestIndicator: 'Community Resilience',
        riskIndicator: 'Healthcare Access',
        metrics: [
          { label: 'Literacy Rate', value: '82.1%' },
          { label: 'Life Expectancy', value: '65.8 yrs' },
          { label: 'Healthcare Access', value: '42%' },
          { label: 'Unemployment Rate', value: '8.5%' },
          { label: 'Poverty Rate', value: '25.3%' },
          { label: 'Education Index', value: '0.52' },
        ],
      },
      Governance: {
        score: 48,
        status: 'Poor',
        trend: '-2.1%',
        bestIndicator: 'Community Participation',
        riskIndicator: 'Corruption Perception',
        metrics: [
          { label: 'Rule of Law Index', value: '0.38' },
          { label: 'Corruption Perception', value: '38' },
          { label: 'Government Effectiveness', value: '0.42' },
          { label: 'Regulatory Quality', value: '0.39' },
          { label: 'Public Participation', value: '48%' },
          { label: 'Transparency Score', value: '41' },
        ],
      },
    },
  };

  // ---- Get current data based on selection ----
  const currentData = esgData[selectedRegion]?.[selectedCategory] || esgData.Sarawak.Environment;

  // ---- Helper: Status color ----
  const getStatusColor = (status) => {
    switch (status) {
      case 'Good':
        return '#22c55e';
      case 'Moderate':
        return '#eab308';
      case 'Poor':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={styles.container}>
      {/* ---- Sidebar ---- */}
      <div
        style={{
          ...styles.sidebarWrapper,
          width: isSidebarOpen ? '240px' : '0px',
          minWidth: isSidebarOpen ? '240px' : '0px',
        }}
      >
        <Sidebar />
      </div>

      {/* ---- Main content ---- */}
      <div style={styles.content}>
        {/* Floating toggle button */}
        <button onClick={toggleSidebar} style={styles.floatingBtn} className="floating-btn">
          ☰
        </button>

        {/* ---- Header: Title + Region Dropdown ---- */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.pageTitle}>ESG Indicators</h1>
            <p style={styles.pageSubtitle}>Environmental, Social & Governance performance</p>
          </div>
          <div style={styles.headerRight}>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={styles.dropdown}
            >
              <option value="Sarawak">Sarawak</option>
              <option value="Sabah">Sabah</option>
              <option value="Brunei">Brunei</option>
              <option value="Kalimantan">Kalimantan</option>
            </select>
          </div>
        </div>

        {/* ---- Category Tabs ---- */}
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

        {/* ---- Dashboard Content ---- */}
        <div style={styles.dashboardGrid}>
          {/* Left: Score Card */}
          <div style={styles.card}>
            <div style={styles.scoreCard}>
              <div style={styles.scoreHeader}>
                <div style={styles.scoreLabel}>Environmental Score</div>
                <div
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: getStatusColor(currentData.status) + '20',
                    color: getStatusColor(currentData.status),
                  }}
                >
                  {currentData.status}
                </div>
              </div>

              <div style={styles.scoreNumber}>{currentData.score}/100</div>

              <div style={styles.trendContainer}>
                <span style={styles.trendLabel}>Compared with last year</span>
                <span
                  style={{
                    ...styles.trendValue,
                    color: currentData.trend.startsWith('+') ? '#22c55e' : '#ef4444',
                  }}
                >
                  {currentData.trend}
                </span>
              </div>

              <div style={styles.bestRiskGrid}>
                <div style={styles.bestRiskItem}>
                  <div style={styles.bestRiskLabel}>Best Indicator</div>
                  <div style={styles.bestRiskValue}>{currentData.bestIndicator}</div>
                </div>
                <div style={styles.bestRiskItem}>
                  <div style={styles.bestRiskLabel}>Risk Indicator</div>
                  <div style={{ ...styles.bestRiskValue, color: '#ef4444' }}>
                    {currentData.riskIndicator}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Metrics List */}
          <div style={styles.card}>
            <div style={styles.metricsList}>
              {currentData.metrics.map((metric, idx) => (
                <div key={idx} style={styles.metricItem}>
                  <span style={styles.metricLabel}>{metric.label}</span>
                  <span style={styles.metricValue}>{metric.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- Light mode styles ----
const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100%',
    backgroundColor: '#f3f4f6',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
  },
  sidebarWrapper: {
    overflow: 'hidden',
    transition: 'width 0.3s ease, min-width 0.3s ease',
    flexShrink: 0,
    height: '100%',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    position: 'relative',
  },
  floatingBtn: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    zIndex: 1001,
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '24px',
    padding: '6px 12px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    color: '#1f2937',
    transition: 'background 0.2s, box-shadow 0.2s',
    lineHeight: 1,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '40px',
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
  },
  tab: {
    padding: '10px 24px',
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
  // Score Card
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
  // Metrics List
  metricsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  metricItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
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
  },
};

export default ESGIndicator;