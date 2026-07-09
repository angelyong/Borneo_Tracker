import { useState } from 'react';
import Sidebar from '../../components/sidebar';
import MiniTopBar from '../../components/MiniTopBar';

// ── DATA ──────────────────────────────────────────────────────────────────────
const TERRITORIES = ['All Borneo', 'Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];

const SDG_DATA = {
  'All Borneo': [
    { id: 1,  code: 'SDG1',  label: 'No Poverty',       color: '#E5243B', score: 45, status: 'Critical',        trend: 'up',     subIndicators: [{ label: 'Population below $2.15/day', value: '55.9%' }, { label: 'Social protection coverage', value: '70.4%' }, { label: 'Access to basic services', value: '70.4%' }] },
    { id: 3,  code: 'SDG3',  label: 'Good Health',       color: '#4C9F38', score: 62, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'Under-5 mortality rate', value: '24.1‰' }, { label: 'Maternal mortality ratio', value: '148/100k' }, { label: 'Universal health coverage index', value: '61.0' }] },
    { id: 4,  code: 'SDG4',  label: 'Quality Education', color: '#C5192D', score: 68, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'Primary completion rate', value: '91.2%' }, { label: 'Secondary enrollment rate', value: '78.6%' }, { label: 'Youth & adult literacy rate', value: '95.3%' }] },
    { id: 6,  code: 'SDG6',  label: 'Clean Water',       color: '#26BDE2', score: 71, status: 'Needs Attention', trend: 'stable', subIndicators: [{ label: 'Safe drinking water access', value: '84.1%' }, { label: 'Sanitation coverage', value: '72.3%' }, { label: 'Water quality index', value: '68/100' }] },
    { id: 8,  code: 'SDG8',  label: 'Decent Work',       color: '#A21942', score: 58, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'GDP growth per capita', value: '3.8%' }, { label: 'Youth unemployment rate', value: '14.2%' }, { label: 'Labour productivity index', value: '58.1' }] },
    { id: 13, code: 'SDG13', label: 'Climate Action',    color: '#3F7E44', score: 31, status: 'Critical',        trend: 'down',   subIndicators: [{ label: 'GHG emissions per capita', value: '7.4 tCO₂' }, { label: 'Climate policy implementation', value: '31%' }, { label: 'Disaster risk reduction score', value: '42/100' }] },
    { id: 15, code: 'SDG15', label: 'Life on Land',      color: '#56C02B', score: 38, status: 'Critical',        trend: 'down',   subIndicators: [{ label: 'Forest area % of land', value: '57.3%' }, { label: 'Protected area coverage', value: '12.8%' }, { label: 'Threatened species index', value: '38/100' }] },
    { id: 16, code: 'SDG16', label: 'Peace & Justice',   color: '#00689D', score: 55, status: 'Needs Attention', trend: 'stable', subIndicators: [{ label: 'Corruption perception score', value: '42/100' }, { label: 'Access to justice index', value: '55/100' }, { label: 'Homicide rate per 100k', value: '2.1' }] },
  ],
  Sabah: [
    { id: 1,  code: 'SDG1',  label: 'No Poverty',       color: '#E5243B', score: 41, status: 'Critical',        trend: 'up',     subIndicators: [{ label: 'Population below $2.15/day', value: '61.2%' }, { label: 'Social protection coverage', value: '66.1%' }, { label: 'Access to basic services', value: '68.3%' }] },
    { id: 3,  code: 'SDG3',  label: 'Good Health',       color: '#4C9F38', score: 58, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'Under-5 mortality rate', value: '28.4‰' }, { label: 'Maternal mortality ratio', value: '163/100k' }, { label: 'UHC index', value: '57.0' }] },
    { id: 4,  code: 'SDG4',  label: 'Quality Education', color: '#C5192D', score: 65, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'Primary completion rate', value: '88.4%' }, { label: 'Secondary enrollment', value: '74.1%' }, { label: 'Literacy rate', value: '93.7%' }] },
    { id: 6,  code: 'SDG6',  label: 'Clean Water',       color: '#26BDE2', score: 68, status: 'Needs Attention', trend: 'stable', subIndicators: [{ label: 'Safe drinking water', value: '80.2%' }, { label: 'Sanitation', value: '69.5%' }, { label: 'Water quality', value: '64/100' }] },
    { id: 8,  code: 'SDG8',  label: 'Decent Work',       color: '#A21942', score: 55, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'GDP growth per capita', value: '3.2%' }, { label: 'Youth unemployment', value: '16.8%' }, { label: 'Labour productivity', value: '54.0' }] },
    { id: 13, code: 'SDG13', label: 'Climate Action',    color: '#3F7E44', score: 29, status: 'Critical',        trend: 'down',   subIndicators: [{ label: 'GHG per capita', value: '8.1 tCO₂' }, { label: 'Policy implementation', value: '28%' }, { label: 'Disaster risk score', value: '39/100' }] },
    { id: 15, code: 'SDG15', label: 'Life on Land',      color: '#56C02B', score: 44, status: 'Critical',        trend: 'down',   subIndicators: [{ label: 'Forest area', value: '61.2%' }, { label: 'Protected area', value: '14.1%' }, { label: 'Species index', value: '44/100' }] },
    { id: 16, code: 'SDG16', label: 'Peace & Justice',   color: '#00689D', score: 52, status: 'Needs Attention', trend: 'stable', subIndicators: [{ label: 'Corruption score', value: '40/100' }, { label: 'Justice index', value: '52/100' }, { label: 'Homicide rate', value: '2.4' }] },
  ],
  Sarawak: [
    { id: 1,  code: 'SDG1',  label: 'No Poverty',       color: '#E5243B', score: 45, status: 'Critical',        trend: 'up',     subIndicators: [{ label: 'Population below $2.15/day', value: '55.9%' }, { label: 'Social protection coverage', value: '70.4%' }, { label: 'Access to basic services', value: '70.4%' }] },
    { id: 3,  code: 'SDG3',  label: 'Good Health',       color: '#4C9F38', score: 62, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'Under-5 mortality rate', value: '24.1‰' }, { label: 'Maternal mortality ratio', value: '148/100k' }, { label: 'UHC index', value: '61.0' }] },
    { id: 4,  code: 'SDG4',  label: 'Quality Education', color: '#C5192D', score: 68, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'Primary completion rate', value: '91.2%' }, { label: 'Secondary enrollment', value: '78.6%' }, { label: 'Literacy rate', value: '95.3%' }] },
    { id: 6,  code: 'SDG6',  label: 'Clean Water',       color: '#26BDE2', score: 71, status: 'Needs Attention', trend: 'stable', subIndicators: [{ label: 'Safe drinking water', value: '84.1%' }, { label: 'Sanitation', value: '72.3%' }, { label: 'Water quality', value: '68/100' }] },
    { id: 8,  code: 'SDG8',  label: 'Decent Work',       color: '#A21942', score: 58, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'GDP growth per capita', value: '3.8%' }, { label: 'Youth unemployment', value: '14.2%' }, { label: 'Labour productivity', value: '58.1' }] },
    { id: 13, code: 'SDG13', label: 'Climate Action',    color: '#3F7E44', score: 31, status: 'Critical',        trend: 'down',   subIndicators: [{ label: 'GHG per capita', value: '7.4 tCO₂' }, { label: 'Policy implementation', value: '31%' }, { label: 'Disaster risk score', value: '42/100' }] },
    { id: 15, code: 'SDG15', label: 'Life on Land',      color: '#56C02B', score: 38, status: 'Critical',        trend: 'down',   subIndicators: [{ label: 'Forest area', value: '57.3%' }, { label: 'Protected area', value: '12.8%' }, { label: 'Species index', value: '38/100' }] },
    { id: 16, code: 'SDG16', label: 'Peace & Justice',   color: '#00689D', score: 55, status: 'Needs Attention', trend: 'stable', subIndicators: [{ label: 'Corruption score', value: '42/100' }, { label: 'Justice index', value: '55/100' }, { label: 'Homicide rate', value: '2.1' }] },
  ],
  Brunei: [
    { id: 1,  code: 'SDG1',  label: 'No Poverty',       color: '#E5243B', score: 72, status: 'On Track',        trend: 'up',     subIndicators: [{ label: 'Population below $2.15/day', value: '2.1%' }, { label: 'Social protection coverage', value: '94.0%' }, { label: 'Access to basic services', value: '98.1%' }] },
    { id: 3,  code: 'SDG3',  label: 'Good Health',       color: '#4C9F38', score: 78, status: 'On Track',        trend: 'up',     subIndicators: [{ label: 'Under-5 mortality rate', value: '11.2‰' }, { label: 'Maternal mortality ratio', value: '31/100k' }, { label: 'UHC index', value: '79.0' }] },
    { id: 4,  code: 'SDG4',  label: 'Quality Education', color: '#C5192D', score: 80, status: 'On Track',        trend: 'up',     subIndicators: [{ label: 'Primary completion rate', value: '98.4%' }, { label: 'Secondary enrollment', value: '90.2%' }, { label: 'Literacy rate', value: '99.1%' }] },
    { id: 6,  code: 'SDG6',  label: 'Clean Water',       color: '#26BDE2', score: 91, status: 'On Track',        trend: 'up',     subIndicators: [{ label: 'Safe drinking water', value: '99.2%' }, { label: 'Sanitation', value: '96.4%' }, { label: 'Water quality', value: '88/100' }] },
    { id: 8,  code: 'SDG8',  label: 'Decent Work',       color: '#A21942', score: 74, status: 'On Track',        trend: 'stable', subIndicators: [{ label: 'GDP growth per capita', value: '2.4%' }, { label: 'Youth unemployment', value: '8.1%' }, { label: 'Labour productivity', value: '74.0' }] },
    { id: 13, code: 'SDG13', label: 'Climate Action',    color: '#3F7E44', score: 40, status: 'Needs Attention', trend: 'down',   subIndicators: [{ label: 'GHG per capita', value: '22.4 tCO₂' }, { label: 'Policy implementation', value: '40%' }, { label: 'Disaster risk score', value: '55/100' }] },
    { id: 15, code: 'SDG15', label: 'Life on Land',      color: '#56C02B', score: 52, status: 'Needs Attention', trend: 'stable', subIndicators: [{ label: 'Forest area', value: '72.1%' }, { label: 'Protected area', value: '22.4%' }, { label: 'Species index', value: '52/100' }] },
    { id: 16, code: 'SDG16', label: 'Peace & Justice',   color: '#00689D', score: 68, status: 'On Track',        trend: 'up',     subIndicators: [{ label: 'Corruption score', value: '60/100' }, { label: 'Justice index', value: '68/100' }, { label: 'Homicide rate', value: '0.6' }] },
  ],
  Kalimantan: [
    { id: 1,  code: 'SDG1',  label: 'No Poverty',       color: '#E5243B', score: 38, status: 'Critical',        trend: 'up',     subIndicators: [{ label: 'Population below $2.15/day', value: '68.4%' }, { label: 'Social protection coverage', value: '52.1%' }, { label: 'Access to basic services', value: '58.0%' }] },
    { id: 3,  code: 'SDG3',  label: 'Good Health',       color: '#4C9F38', score: 49, status: 'Critical',        trend: 'up',     subIndicators: [{ label: 'Under-5 mortality rate', value: '38.2‰' }, { label: 'Maternal mortality ratio', value: '224/100k' }, { label: 'UHC index', value: '49.0' }] },
    { id: 4,  code: 'SDG4',  label: 'Quality Education', color: '#C5192D', score: 55, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'Primary completion rate', value: '82.1%' }, { label: 'Secondary enrollment', value: '64.8%' }, { label: 'Literacy rate', value: '91.2%' }] },
    { id: 6,  code: 'SDG6',  label: 'Clean Water',       color: '#26BDE2', score: 58, status: 'Needs Attention', trend: 'up',     subIndicators: [{ label: 'Safe drinking water', value: '71.4%' }, { label: 'Sanitation', value: '58.2%' }, { label: 'Water quality', value: '54/100' }] },
    { id: 8,  code: 'SDG8',  label: 'Decent Work',       color: '#A21942', score: 44, status: 'Critical',        trend: 'up',     subIndicators: [{ label: 'GDP growth per capita', value: '4.1%' }, { label: 'Youth unemployment', value: '22.4%' }, { label: 'Labour productivity', value: '44.0' }] },
    { id: 13, code: 'SDG13', label: 'Climate Action',    color: '#3F7E44', score: 22, status: 'Critical',        trend: 'down',   subIndicators: [{ label: 'GHG per capita', value: '9.8 tCO₂' }, { label: 'Policy implementation', value: '22%' }, { label: 'Disaster risk score', value: '31/100' }] },
    { id: 15, code: 'SDG15', label: 'Life on Land',      color: '#56C02B', score: 28, status: 'Critical',        trend: 'down',   subIndicators: [{ label: 'Forest area', value: '48.1%' }, { label: 'Protected area', value: '8.4%' }, { label: 'Species index', value: '28/100' }] },
    { id: 16, code: 'SDG16', label: 'Peace & Justice',   color: '#00689D', score: 42, status: 'Needs Attention', trend: 'stable', subIndicators: [{ label: 'Corruption score', value: '34/100' }, { label: 'Justice index', value: '42/100' }, { label: 'Homicide rate', value: '3.8' }] },
  ],
};

const STATUS_STYLE = {
  'On Track':        { bg: '#d1fae5', text: '#065f46', bar: '#22c55e' },
  'Needs Attention': { bg: '#fef9c3', text: '#92400e', bar: '#eab308' },
  'Critical':        { bg: '#fee2e2', text: '#991b1b', bar: '#ef4444' },
  'No Data':         { bg: '#f3f4f6', text: '#6b7280', bar: '#d1d5db' },
};

const TREND_ICON  = { up: '↑', down: '↓', stable: '→' };
const TREND_COLOR = { up: '#22c55e', down: '#ef4444', stable: '#eab308' };

function SDGCard({ sdg }) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_STYLE[sdg.status] || STATUS_STYLE['No Data'];
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={{ ...styles.sdgBadge, backgroundColor: sdg.color }}>
          <span style={styles.sdgBadgeText}>{sdg.code}</span>
        </div>
        <div style={styles.cardMeta}>
          <span style={styles.cardTitle}>{sdg.label}</span>
          <div style={styles.statusRow}>
            <span style={{ ...styles.statusPill, backgroundColor: s.bg, color: s.text }}>{sdg.status}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: TREND_COLOR[sdg.trend] }}>{TREND_ICON[sdg.trend]}</span>
          </div>
        </div>
        <span style={{ ...styles.scoreText, color: s.bar }}>{sdg.score}%</span>
      </div>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${sdg.score}%`, backgroundColor: s.bar }} />
      </div>
      <button onClick={() => setExpanded(!expanded)} style={{ ...styles.toggleBtn, color: sdg.color }}>
        {expanded ? 'Hide sub-indicators ▲' : 'Show sub-indicators ▼'}
      </button>
      {expanded && (
        <div style={styles.subList}>
          {sdg.subIndicators.map((si) => (
            <div key={si.label} style={styles.subRow}>
              <span style={styles.subLabel}>{si.label}</span>
              <span style={styles.subValue}>{si.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SDGProgress = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('Sarawak');
  const sdgList = SDG_DATA[selectedRegion] || SDG_DATA['All Borneo'];

  const handleExport = () => {
    const rows = [['SDG', 'Label', 'Score (%)', 'Status', 'Trend'], ...sdgList.map((s) => [s.code, s.label, s.score, s.status, s.trend])];
    const csv  = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `sdg-progress-${selectedRegion.replace(/\s+/g, '-').toLowerCase()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.pageWrapper}>
      

      {/* Right column */}
      <div style={styles.rightCol}>
        {/* Mini top bar */}
        <MiniTopBar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} notifCount={2} />

        {/* Scrollable content */}
        <div style={styles.main}>
          <div style={styles.exportRow}>
            <button onClick={handleExport} style={styles.exportBtn}>↓ Export CSV</button>
          </div>
          <h1 style={styles.pageTitle}>SDG Progress</h1>
          <div style={styles.dropdownRow}>
            <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} style={styles.dropdown}>
              {TERRITORIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={styles.legend}>
            {Object.entries(STATUS_STYLE).map(([label, s]) => (
              <span key={label} style={{ ...styles.legendPill, backgroundColor: s.bg, color: s.text }}>{label}</span>
            ))}
          </div>
          <div style={styles.grid}>
            {sdgList.map((sdg) => <SDGCard key={sdg.id} sdg={sdg} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  pageWrapper:    { display: 'flex', height: '100vh', width: '100%', backgroundColor: '#f3f4f6', fontFamily: 'Inter, Arial, sans-serif', overflow: 'hidden' },
  sidebarWrapper: { overflow: 'hidden', transition: 'width 0.3s ease, min-width 0.3s ease', flexShrink: 0, height: '100%' },
  rightCol:       { flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  main:           { flex: 1, overflowY: 'auto', padding: '20px 32px 48px', boxSizing: 'border-box' },
  exportRow:      { display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' },
  exportBtn:      { backgroundColor: 'transparent', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', color: '#374151', padding: '6px 14px' },
  pageTitle:      { fontSize: '28px', fontWeight: '700', color: '#1a1a1a', textAlign: 'center', margin: '8px 0 20px' },
  dropdownRow:    { display: 'flex', justifyContent: 'center', marginBottom: '20px' },
  dropdown:       { padding: '10px 20px', borderRadius: '10px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontSize: '15px', fontWeight: '500', color: '#1f2937', cursor: 'pointer', outline: 'none', minWidth: '180px', appearance: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  legend:         { display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '28px', flexWrap: 'wrap' },
  legendPill:     { padding: '5px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: '500' },
  grid:           { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', maxWidth: '900px', margin: '0 auto' },
  card:           { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px 22px 16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '12px' },
  cardHeader:     { display: 'flex', alignItems: 'center', gap: '12px' },
  sdgBadge:       { width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sdgBadgeText:   { color: '#ffffff', fontWeight: '800', fontSize: '12px', textAlign: 'center', lineHeight: 1.2 },
  cardMeta:       { flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' },
  cardTitle:      { fontSize: '16px', fontWeight: '700', color: '#1a1a1a' },
  statusRow:      { display: 'flex', alignItems: 'center', gap: '8px' },
  statusPill:     { padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' },
  scoreText:      { fontSize: '26px', fontWeight: '800', flexShrink: 0 },
  barTrack:       { height: '8px', borderRadius: '999px', backgroundColor: '#e5e7eb', overflow: 'hidden' },
  barFill:        { height: '100%', borderRadius: '999px', transition: 'width 0.6s ease' },
  toggleBtn:      { background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', padding: 0, textAlign: 'left', alignSelf: 'flex-start' },
  subList:        { display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' },
  subRow:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: '1px solid #f3f4f6', paddingBottom: '5px' },
  subLabel:       { color: '#6b7280' },
  subValue:       { fontWeight: '600', color: '#1f2937' },
};

export default SDGProgress;
