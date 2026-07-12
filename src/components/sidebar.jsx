import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icons } from './ui';

const Sidebar = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const [logoutHovered, setLogoutHovered] = useState(false);

  const menuItems = [
    { name: 'Dashboard',                path: '/'       ,   icon: <Icons.Grid size={20} />     },
    { name: 'Regional Details',         path: '/regions',   icon: <Icons.Table size={20} /> },
    { name: 'ESG Indicators',           path: '/esg',       icon: <Icons.Gauge size={20} /> },
    { name: 'SDG Progress',             path: '/sdg',       icon: <Icons.Chart size={20} /> },
    { name: 'Incident Report',          path: '/incident_report', icon: <Icons.People size={20} /> },
    { name: 'News & Insights',          path: '/news',      icon: <Icons.Newspaper size={20} /> },
    { name: 'Community',                path: '/community', icon: <Icons.Comment size={20} /> },
    { name: 'Data Sources',             path: '/data-sources', icon: <Icons.Frame size={20} /> },
    { name: 'About Borneo Tracker',     path: '/about',     icon: <Icons.Info size={20} />         },
  ];

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <div style={{ ...styles.sidebar, width: collapsed ? 72 : '100%' }}>

      

      {/* ── Nav links ── */}
      <nav style={styles.nav}>
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '12px 8px' : '12px 14px',
            })}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            {!collapsed && <span>{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom section ── */}
      <div style={styles.bottom}>

        

        {/* Divider */}
        <div style={styles.divider} />

        {/* Logout button */}
        <button
          onClick={handleLogout}
          onMouseEnter={() => setLogoutHovered(true)}
          onMouseLeave={() => setLogoutHovered(false)}
          style={{
            ...styles.logoutBtn,
            backgroundColor: logoutHovered ? 'rgba(248,113,113,0.1)' : 'transparent',
          }}
        >
          <span style={styles.logoutIcon}>⎋</span>
          {!collapsed && 'Log out'}
        </button>

       
      </div>
      
    </div>
  );
};

// ─── dark green palette ──────────────────────────────────────────────────────
// base:    #1a3a2a   (deep forest green)
// hover:   #224d38   (slightly lighter)
// active:  #1e4433   (active bg)
// border:  #2d5a42   (subtle divider)
// accent:  #4ade80   (lime green highlight – kept for active border)
// text:    #c8ddd2   (muted green-white)

const styles = {
  sidebar: {
  width: '100%',
  height: '100%',
  backgroundColor: '#0d2118',
  color: '#c8ddd2',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  borderRight: '1px solid #2d5a42',
  zIndex: 10,
  paddingTop: '24px',
  boxSizing: 'border-box',
},

  logoContainer: {
    display:      'flex',
    alignItems:   'center',
    gap:          '10px',
    padding:      '20px 16px 16px 16px',
    borderBottom: '1px solid #2d5a42',
    marginBottom: '12px',
  },
  logoIcon: {
    fontSize:        '20px',
    width:           '34px',
    height:          '34px',
    borderRadius:    '8px',
    backgroundColor: 'rgba(74,222,128,0.15)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  logo: {
    fontSize:      '16px',
    fontWeight:    '700',
    margin:        0,
    color:         '#ffffff',
    letterSpacing: '-0.3px',
  },

  nav: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    padding:       '0 12px',
    gap:           '2px',
  },
  navLink: {
    display:        'flex',
    alignItems:     'center',
    gap:            '10px',
    padding:        '12px 14px',
    borderRadius:   '8px',
    textDecoration: 'none',
    color:          '#a0bfad',
    fontSize:       '14px',
    fontWeight:     '600',
    transition:     'all 0.2s ease',
    borderLeft:     '3px solid transparent',
    fontFamily:     'Inter, Arial, sans-serif',
  },
  navIcon: {
    display:       'inline-flex',
    alignItems:    'center',
    justifyContent:'center',
    width:         '22px',
    height:        '22px',
    color:         '#9caea4',
    flexShrink:    0,
  },
  navLinkActive: {
    backgroundColor: '#1e4433',
    color:           '#ffffff',
    borderLeft:      '3px solid #4ade80',
    fontWeight:      '700',
  },

  // ── Bottom ──
  bottom: {
    marginTop: 'auto',
    padding:   '12px 12px 20px',
  },

  userRow: {
    display:      'flex',
    alignItems:   'center',
    gap:          '10px',
    padding:      '10px 8px',
    borderRadius: '8px',
  },
  avatar: {
    width:           '34px',
    height:          '34px',
    borderRadius:    '50%',
    backgroundColor: '#4ade80',
    color:           '#1a3a2a',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    fontSize:        '14px',
    fontWeight:      '700',
    flexShrink:      0,
  },
  userInfo: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '1px',
    overflow:      'hidden',
  },
  userName: {
    fontSize:     '13px',
    fontWeight:   '600',
    color:        '#f0faf4',
    whiteSpace:   'nowrap',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: '11px',
    color:    '#5c8a6e',
  },

  divider: {
    height:          '1px',
    backgroundColor: '#2d5a42',
    margin:          '8px 4px',
  },

  logoutBtn: {
    display:      'flex',
    alignItems:   'center',
    gap:          '10px',
    width:        '100%',
    padding:      '10px 14px',
    borderRadius: '8px',
    border:       'none',
    color:        '#f87171',
    fontSize:     '13.5px',
    fontWeight:   '500',
    cursor:       'pointer',
    textAlign:    'left',
    transition:   'background-color 0.2s ease',
    marginBottom: '4px',
  },
  logoutIcon: {
    fontSize:  '16px',
    flexShrink: 0,
  },

  footer: {
    paddingTop: '8px',
  },
  footerText: {
    fontSize:  '11px',
    color:     '#3d6b52',
    margin:    '2px 0',
    textAlign: 'center',
  },
};

export default Sidebar;
