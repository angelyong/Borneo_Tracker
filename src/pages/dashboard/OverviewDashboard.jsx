// pages/dashboard/OverviewDashboard.jsx
import { useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Sidebar from '../../components/sidebar';
import {
  LAYER_CONFIG,
  formatValue,
  getLayerRows,
  layerColorScale,
  titleCaseConfidence,
  useIndicators,
} from '../../data/useIndicators';

import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const OverviewDashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [activeLayer, setActiveLayer] = useState('deforestation');
  const { data, loading, error } = useIndicators();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const handleLayerToggle = (layer) => setActiveLayer(layer);

  const layerEntries = useMemo(() => {
    if (!data?.rows || !activeLayer) return [];
    return getLayerRows(data.rows, activeLayer).filter((entry) =>
      entry.territory.toLowerCase().includes(searchText.trim().toLowerCase())
    );
  }, [activeLayer, data, searchText]);
  const colorForValue = useMemo(() => layerColorScale(layerEntries, activeLayer), [activeLayer, layerEntries]);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Sidebar */}
        <div
          style={{
            ...styles.sidebarWrapper,
            width: isSidebarOpen ? '240px' : '0px',
            minWidth: isSidebarOpen ? '240px' : '0px',
          }}
        >
          <Sidebar />
        </div>

        {/* Map with floating search bar and toggle button */}
        <div style={styles.mapWrapper}>
          {/* Floating Toggle Button (always visible) */}
          <button onClick={toggleSidebar} style={styles.floatingBtn}>
            ☰
          </button>

          {/* Floating Search Bar */}
          <div style={styles.searchContainer}>
            <div style={styles.searchBox}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Search Borneo Tracker..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                style={styles.searchInput}
              />
            </div>
          </div>

          <MapContainer
            center={[-1.5, 114.5]}
            zoom={5}
            style={styles.map}
            zoomControl={false}
          >
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {layerEntries.map(({ territory, row }) => {
              const position = TERRITORY_CENTERS[territory];
              if (!position) return null;
              const color = colorForValue(row?.value);
              return (
                <CircleMarker
                  key={`${activeLayer}-${territory}`}
                  center={position}
                  radius={18}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: row ? 0.7 : 0.25,
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                    <strong>{territory}</strong>
                    <br />
                    {row ? formatValue(row) : 'No data'}
                  </Tooltip>
                  <Popup>
                    <div style={styles.popupContent}>
                      <strong>{territory}</strong>
                      <div>{activeLayer ? LAYER_CONFIG[activeLayer].label : 'Layer'}</div>
                      <div>{row ? formatValue(row) : 'No data for this layer'}</div>
                      {row ? (
                        <div style={styles.popupMeta}>
                          {row.year} · {titleCaseConfidence(row.confidence)}
                        </div>
                      ) : null}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Right Layer Panel */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Layer Controls</h3>
          <p style={styles.panelSubtitle}>
            Choose one active snapshot overlay at a time. Each layer uses the latest canonical project data.
          </p>
          <div style={styles.layerGroup}>
            {Object.keys(LAYER_CONFIG).map((key) => (
              <label key={key} style={styles.checkboxLabel}>
                <input
                  type="radio"
                  name="active-layer"
                  checked={activeLayer === key}
                  onChange={() => handleLayerToggle(key)}
                  style={styles.checkbox}
                />
                {key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase())}
              </label>
            ))}
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryTitle}>
              Active overlay: {activeLayer ? LAYER_CONFIG[activeLayer].label : 'None'}
            </div>
            {loading ? <div style={styles.summaryEmpty}>Loading map data…</div> : null}
            {error ? <div style={styles.summaryError}>{error}</div> : null}
            {!loading && !error
              ? layerEntries.map(({ territory, row }) => (
                  <div key={territory} style={styles.summaryRow}>
                    <div>
                      <div style={styles.summaryTerritory}>{territory}</div>
                      <div style={styles.summaryMeta}>
                        {row ? `${row.year} · ${titleCaseConfidence(row.confidence)}` : 'No data'}
                      </div>
                    </div>
                    <div style={styles.summaryValue}>{row ? formatValue(row) : '—'}</div>
                  </div>
                ))
              : null}
          </div>
          <div style={styles.panelFooter}>
            {data?.generatedAt ? (
              <p style={styles.footerText}>Data as of {data.generatedAt} · refreshed daily</p>
            ) : null}
            <p style={styles.footerText}>© 2026 Borneo Tracker. All rights reserved</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const TERRITORY_CENTERS = {
  Sabah: [5.5, 117],
  Sarawak: [2.8, 113.5],
  Brunei: [4.7, 114.8],
  Kalimantan: [0.3, 114.5],
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f5f5f5',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebarWrapper: {
    overflow: 'hidden',
    transition: 'width 0.3s ease, min-width 0.3s ease',
    flexShrink: 0,
    height: '100%',
  },
  mapWrapper: {
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  map: {
    height: '100%',
    width: '100%',
  },

  // ----- Floating Button (always visible) -----
  floatingBtn: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    zIndex: 1001, // above the map and search bar
    backgroundColor: '#ffffff',
    border: '1px solid #d0d0d0',
    borderRadius: '8px',
    fontSize: '24px',
    padding: '6px 12px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    color: '#333',
    transition: 'background 0.2s, box-shadow 0.2s',
    lineHeight: 1,
  },
  // Hover effect – we'll add a class or style via CSS
  // We can also use inline pseudo-class? Better to add className and put in index.css
  // Let's just add a className="floating-btn" and put CSS in index.css
  // For inline, we can't do :hover, so we'll add a className:

  // ----- Floating Search Bar -----
  searchContainer: {
    position: 'absolute',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    width: '60%',
    maxWidth: '500px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '8px 16px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    border: '1px solid #e0e0e0',
  },
  searchIcon: {
    marginRight: '10px',
    fontSize: '18px',
    color: '#888',
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '16px',
    padding: '8px 0',
    width: '100%',
    color: '#333',
  },

  // ----- Right Panel -----
  panel: {
    width: '280px',
    backgroundColor: '#ffffff',
    borderLeft: '1px solid #e0e0e0',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 16px 0',
    color: '#2c3e50',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
  },
  panelSubtitle: {
    margin: '0 0 16px 0',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  layerGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '15px',
    color: '#34495e',
    cursor: 'pointer',
  },
  checkbox: {
    marginRight: '10px',
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  summaryCard: {
    marginTop: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  summaryTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '10px',
  },
  summaryTerritory: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#334155',
  },
  summaryMeta: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '2px',
  },
  summaryValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'right',
  },
  summaryEmpty: {
    fontSize: '13px',
    color: '#64748b',
  },
  summaryError: {
    fontSize: '13px',
    color: '#b91c1c',
  },
  popupContent: {
    fontSize: '13px',
    lineHeight: 1.5,
  },
  popupMeta: {
    marginTop: '4px',
    color: '#64748b',
  },
  panelFooter: {
    marginTop: '20px',
    borderTop: '1px solid #eee',
    paddingTop: '14px',
    fontSize: '12px',
    color: '#999',
    textAlign: 'center',
  },
  footerText: {
    margin: 0,
  },
};

export default OverviewDashboard;
