// components/MiniTopBar.jsx
// Lightweight top bar: hamburger ☰ | spacer | bell (with badge) | avatar circle
// Clicking avatar opens a small dropdown with "My Profile" and "Log out"
// No logo — matches the screenshot design exactly

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import AIbotButton from './AIbotButton';

const MiniTopBar = ({ onMenuClick, notifCount = 0 }) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const closeDropdown = () => setDropdownOpen(false);

  const goTo = (path) => {
    closeDropdown();
    navigate(path);
  };

  const handleLogout = () => {
    closeDropdown();
    localStorage.removeItem('authToken');
    sessionStorage.clear();
    navigate('/login');
  };

  return (
    <div style={styles.bar}>

      {/* ── Left: hamburger ── */}
      <button
        onClick={onMenuClick}
        style={styles.iconBtn}
        aria-label="Toggle sidebar"
      >
        <HamburgerIcon />
      </button>

      <AIbotButton />

      <div style={styles.logoCenter} onClick={() => navigate('/')}>
        <img src={logoImg} alt="Borneo Tracker Logo" style={styles.logoImage} />
      </div>

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />
      

      {/* ── Right: bell + avatar ── */}
      <div style={styles.rightGroup}>

        {/* Bell */}
        <button
          style={styles.iconBtn}
          onClick={() => navigate('/alerts')}
          aria-label="Alerts"
        >
          <div style={styles.bellWrap}>
            <BellIcon />
            {notifCount > 0 && (
              <span style={styles.badge}>{notifCount}</span>
            )}
          </div>
        </button>

        {/* Avatar */}
        <div style={styles.avatarWrap}>
          <button
            style={styles.avatarCircle}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-label="User menu"
          >
            <PersonIcon />
          </button>

          {/* Click-away */}
          {dropdownOpen && (
            <div style={styles.overlay} onClick={closeDropdown} />
          )}

          {/* Dropdown */}
          {dropdownOpen && (
            <div style={styles.dropdown}>
              {/* User info header */}
              <div style={styles.dropdownTop}>
                <div style={styles.dropdownAvatar}>A</div>
                <div>
                  <div style={styles.dropdownName}>Admin User</div>
                  <div style={styles.dropdownEmail}>admin@borneotracker.org</div>
                </div>
              </div>
              <div style={styles.dropdownDivider} />

              <button style={styles.dropdownItem} onClick={() => goTo('/profile')}>
                My Profile
              </button>
              <button style={styles.dropdownItem} onClick={() => goTo('/settings')}>
                Settings
              </button>

              <div style={styles.dropdownDivider} />
              <button
                style={{ ...styles.dropdownItem, color: '#dc2626' }}
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const HamburgerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="17" x2="20" y2="17" />
  </svg>
);

const BellIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const PersonIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  bar: {
    display:         'flex',
    alignItems:      'center',
    height:          '52px',
    padding:         '0 12px',
    backgroundColor: '#f5f4f0',   // warm off-white header
    borderBottom:    '1px solid #e5e5df',
    flexShrink:      0,
    boxSizing:       'border-box',
    position:        'fixed',
    top:             0,
    left:            0,
    right:           0,
    width:           '100%',
    zIndex:          300,
  },

  iconBtn: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    width:           '34px',
    height:          '34px',
    borderRadius:    '50%',
    border:          'none',
    backgroundColor: '#0d3b2b',
    color:           '#ffffff',
    cursor:          'pointer',
    boxShadow:       '0 6px 12px rgba(13,33,24,0.12)',
    marginLeft:      '12px',
  },

rightGroup: {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  marginLeft: 'auto',
},

  // Bell badge
  bellWrap: {
    position:       'relative',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  },
  badge: {
    position:        'absolute',
    top:             '-5px',
    right:           '-5px',
    backgroundColor: '#dc2626',
    color:           '#fff',
    fontSize:        '10px',
    fontWeight:      '700',
    width:           '16px',
    height:          '16px',
    borderRadius:    '50%',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    pointerEvents:   'none',
  },

  // Avatar circle button — dark green fill matching sidebar
  avatarWrap: { position: 'relative' },
avatarCircle: {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '35px',
  height: '35px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: '#0d3b2b',
  color: '#ffffff',
  cursor: 'pointer',
  boxShadow: '0 6px 12px rgba(13,33,24,0.16)',
},

  // Click-away invisible overlay
  overlay: {
    position: 'fixed',
    inset:    0,
    zIndex:   299,
  },

  // Dropdown panel
  dropdown: {
    position:        'absolute',
    top:             '52px',
    right:           0,
    backgroundColor: '#ffffff',
    border:          '1px solid #e5e7eb',
    borderRadius:    '12px',
    boxShadow:       '0 8px 24px rgba(0,0,0,0.12)',
    minWidth:        '200px',
    zIndex:          400,
    padding:         '6px 0',
  },
  dropdownTop: {
    display:    'flex',
    alignItems: 'center',
    gap:        '10px',
    padding:    '12px 16px',
  },
  dropdownAvatar: {
    width:           '34px',
    height:          '34px',
    borderRadius:    '50%',
    backgroundColor: '#4ade80',
    color:           '#0d2118',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    fontSize:        '13px',
    fontWeight:      '700',
    flexShrink:      0,
  },
  dropdownName: {
    fontSize:   '13px',
    fontWeight: '600',
    color:      '#111827',
  },
  dropdownEmail: {
    fontSize:  '11px',
    color:     '#6b7280',
    marginTop: '1px',
  },
  dropdownDivider: {
    height:          '1px',
    backgroundColor: '#f3f4f6',
    margin:          '4px 0',
  },
  dropdownItem: {
    display:         'block',
    width:           '100%',
    padding:         '9px 16px',
    border:          'none',
    backgroundColor: 'transparent',
    textAlign:       'left',
    fontSize:        '13px',
    fontWeight:      '500',
    color:           '#374151',
    cursor:          'pointer',
  },

  // Logo in the center
  logoImage: {
  width: '42px',
  height: '42px',
  objectFit: 'contain',
},

logoCenter: {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 301,
},
bellBtn: {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '58px',
  height: '58px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: '#0d3b2b',
  color: '#ffffff',
  cursor: 'pointer',
  boxShadow: '0 6px 12px rgba(13,33,24,0.16)',
},
};

export default MiniTopBar;
