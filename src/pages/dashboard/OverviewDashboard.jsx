// pages/dashboard/OverviewDashboard.jsx
import React, { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Sidebar from '../../components/Sidebar';

import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const OverviewDashboard = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [layers, setLayers] = useState({
    deforestation: true,
    airQuality: false,
    fireHotspots: false,
    poverty: false,
    forestCover: true,
  });

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLayerToggle = (layer) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

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
          </MapContainer>
        </div>

        {/* Right Layer Panel */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Layer Controls</h3>
          <div style={styles.layerGroup}>
            {Object.keys(layers).map((key) => (
              <label key={key} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={() => handleLayerToggle(key)}
                  style={styles.checkbox}
                />
                {key
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, (str) => str.toUpperCase())}
              </label>
            ))}
          </div>
          <div style={styles.panelFooter}>
            <p style={styles.footerText}>© 2026 Borneo Tracker. All rights reserved</p>
          </div>
        </div>
      </div>
    </div>
  );
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