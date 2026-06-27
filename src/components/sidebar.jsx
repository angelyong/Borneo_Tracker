// src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  const menuItems = [
    { name: 'Overview', path: '/' },
    { name: 'Regional Details', path: '/regions' },
    { name: 'ESG Indicators', path: '/esg' },
    { name: 'SDG Progress', path: '/sdg' },
    { name: 'Environmental Indicators', path: '/environmental' },
    { name: 'Social Indicators', path: '/social' },
    { name: 'Data Sources', path: '/data-sources' },
    { name: 'About Borneo Tracker', path: '/about' },
  ];

  return (
    <div style={styles.sidebar}>
      {/* Logo only – no button */}
      <div style={styles.logoContainer}>
        <h1 style={styles.logo}>Borneo Tracker</h1>
      </div>

      <nav style={styles.nav}>
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div style={styles.footer}>
        <p style={styles.footerText}>© 2026 Borneo Tracker</p>
        <p style={styles.footerText}>All rights reserved</p>
      </div>
    </div>
  );
};

const styles = {
  sidebar: {
    width: '100%',
    height: '100vh',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    borderRight: '1px solid #1e293b',
    zIndex: 10,
  },
  logoContainer: {
    padding: '20px 16px 16px 16px',
    borderBottom: '1px solid #1e293b',
    marginBottom: '12px',
  },
  logo: {
    fontSize: '18px',
    fontWeight: '700',
    margin: 0,
    color: '#ffffff',
    letterSpacing: '-0.5px',
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '0 12px',
    gap: '4px',
  },
  navLink: {
    padding: '10px 16px',
    borderRadius: '8px',
    textDecoration: 'none',
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    borderLeft: '3px solid transparent',
  },
  navLinkActive: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    borderLeft: '3px solid #4ade80',
    fontWeight: '600',
  },
  footer: {
    padding: '20px 20px 24px 20px',
    borderTop: '1px solid #1e293b',
    marginTop: 'auto',
  },
  footerText: {
    fontSize: '11px',
    color: '#475569',
    margin: '2px 0',
    textAlign: 'center',
  },
};

export default Sidebar;