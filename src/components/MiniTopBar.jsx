// components/MiniTopBar.jsx
// Lightweight top bar: hamburger ☰ | logo | spacer | mute (News/Community only) | theme | account
// When signed in, the avatar opens a dropdown (profile / admin / log out).
// When signed out, it shows a "Log in" button instead.

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import { useAuth } from '../auth/useAuth';
import AIbotButton from './AIbotButton';
import ThemeToggle from './ThemeToggle';
import { isMuted, setMuted } from '../utils/notifications';

// Only these two pages have a "new items" sidebar badge, so only these two
// get a mute control — everywhere else the button just doesn't render.
const MUTE_PAGE_BY_PATH = (pathname) => {
  if (pathname === '/community') return 'community';
  if (pathname.startsWith('/news')) return 'news';
  return null;
};

const MiniTopBar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, user, profile, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const mutePage = MUTE_PAGE_BY_PATH(location.pathname);

  // Re-sync whenever the route switches between News/Community/elsewhere —
  // done during render, not an effect, per React's guidance for resetting
  // state when a dependency changes (mirrors GenerateReportPage's bounds sync).
  const [appliedMutePage, setAppliedMutePage] = useState(mutePage);
  const [muted, setMutedState] = useState(() => (mutePage ? isMuted(mutePage) : false));
  if (mutePage !== appliedMutePage) {
    setAppliedMutePage(mutePage);
    setMutedState(mutePage ? isMuted(mutePage) : false);
  }

  const toggleMute = () => {
    if (!mutePage) return;
    const next = !muted;
    setMuted(mutePage, next);
    setMutedState(next);
  };

  const closeDropdown = () => setDropdownOpen(false);

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
    user?.email ||
    'Account';
  const email = user?.email || '';
  const avatarLetter = (displayName || email || '?').charAt(0).toUpperCase();

  const goTo = (path) => {
    closeDropdown();
    navigate(path);
  };

  const handleLogout = async () => {
    closeDropdown();
    await signOut();
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


      {/* ── Right: mute (News/Community only) + theme + account ── */}
      <div style={styles.rightGroup}>

        {/* Mute — only visible on News & Insights and Community */}
        {mutePage && (
          <button
            style={styles.iconBtn}
            onClick={toggleMute}
            aria-label={muted ? `Unmute ${mutePage}` : `Mute ${mutePage}`}
            title={muted ? 'Unmute notifications for this page' : 'Mute notifications for this page'}
          >
            <MuteIcon muted={muted} />
          </button>
        )}

        {/* Theme toggle */}
        <ThemeToggle style={styles.iconBtn} />

        {/* Account: avatar menu when signed in, else a Log in button */}
        {isAuthenticated ? (
          <div style={styles.avatarWrap}>
            <button
              style={styles.avatarCircle}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label="User menu"
            >
              <PersonIcon />
            </button>

            {dropdownOpen && (
              <div style={styles.overlay} onClick={closeDropdown} />
            )}

            {dropdownOpen && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownTop}>
                  <div style={styles.dropdownAvatar}>{avatarLetter}</div>
                  <div>
                    <div style={styles.dropdownName}>{displayName}</div>
                    {email && <div style={styles.dropdownEmail}>{email}</div>}
                  </div>
                </div>
                <div style={styles.dropdownDivider} />

                <button style={styles.dropdownItem} onClick={() => goTo('/profile')}>
                  My Profile
                </button>
                {isAdmin && (
                  <button style={styles.dropdownItem} onClick={() => goTo('/admin/news')}>
                    News Review (Admin)
                  </button>
                )}

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
        ) : (
          <button style={styles.loginBtn} onClick={() => navigate('/login')}>
            Log in
          </button>
        )}
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

const MuteIcon = ({ muted }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    {muted && <line x1="3" y1="3" x2="21" y2="21" />}
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
    backgroundColor: 'var(--color-topbar-bg)',   // warm off-white header (dark-theme reactive)
    borderBottom:    '1px solid var(--color-topbar-border)',
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

  loginBtn: {
    padding:         '8px 20px',
    borderRadius:    '999px',
    border:          'none',
    backgroundColor: '#0d3b2b',
    color:           '#ffffff',
    fontSize:        '13.5px',
    fontWeight:      700,
    cursor:          'pointer',
    boxShadow:       '0 6px 12px rgba(13,33,24,0.16)',
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
    backgroundColor: 'var(--color-card)',
    border:          '1px solid var(--color-border)',
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
    color:      'var(--color-ink)',
  },
  dropdownEmail: {
    fontSize:  '11px',
    color:     'var(--color-muted)',
    marginTop: '1px',
  },
  dropdownDivider: {
    height:          '1px',
    backgroundColor: 'var(--color-border)',
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
    color:           'var(--color-ink)',
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
};

export default MiniTopBar;
