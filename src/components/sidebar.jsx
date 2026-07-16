import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Icons } from './ui';
import { CURRENT_USER, getPosts } from '../services/communityService';
import { getNewsArticles } from '../services/newsService';
import { getLastSeen, isMuted, NOTIF_CHANGE_EVENT } from '../utils/notifications';

const Sidebar = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAdmin, signOut } = useAuth();
  const [logoutHovered, setLogoutHovered] = useState(false);
  const [counts, setCounts] = useState({ news: 0, community: 0 });

  const isAdminRoute = location.pathname.startsWith('/admin');
  const [adminOpen, setAdminOpen] = useState(isAdminRoute);

  // Recomputed on mount, whenever the route changes (so opening /news or
  // /community — which mark themselves seen — clears the badge right away),
  // and whenever the mute toggle fires NOTIF_CHANGE_EVENT.
  useEffect(() => {
    let cancelled = false;

    const computeCounts = async () => {
      const [posts, articles] = await Promise.all([getPosts(), getNewsArticles()]);
      if (cancelled) return;

      const communityLastSeen = getLastSeen('community');
      const newsLastSeen = getLastSeen('news');

      const communityCount = isMuted('community')
        ? 0
        : posts.filter(
            (post) =>
              post.author !== CURRENT_USER &&
              (!communityLastSeen || new Date(post.createdAt) > communityLastSeen)
          ).length;

      const newsCount = isMuted('news')
        ? 0
        : articles.filter((article) => !newsLastSeen || new Date(article.publishedAt) > newsLastSeen).length;

      setCounts({ community: communityCount, news: newsCount });
    };

    computeCounts();

    window.addEventListener(NOTIF_CHANGE_EVENT, computeCounts);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIF_CHANGE_EVENT, computeCounts);
    };
  }, [location.pathname]);

  const menuItems = [
    { name: 'Dashboard',                path: '/'       ,   icon: <Icons.Grid size={20} />     },
    { name: 'Regional Details',         path: '/regions',   icon: <Icons.Table size={20} /> },
    { name: 'ESG Indicators',           path: '/esg',       icon: <Icons.Gauge size={20} /> },
    { name: 'SDG Progress',             path: '/sdg',       icon: <Icons.Chart size={20} /> },
    { name: 'News & Insights',          path: '/news',      icon: <Icons.Newspaper size={20} />, badgeKey: 'news' },
    { name: 'Community',                path: '/community', icon: <Icons.Comment size={20} />, badgeKey: 'community' },
    { name: 'Generate Report',          path: '/reports',   icon: <Icons.FileArrow size={20} /> },
    { name: 'Data Sources',             path: '/data-sources', icon: <Icons.Frame size={20} /> },
  ];

  // Grouped under a single expandable "Admin Tools" entry instead of sitting
  // as top-level items — only admins ever see this at all.
  const adminItems = [
    { name: 'News Review',    path: '/admin/news',  icon: <Icons.Newspaper size={18} /> },
    { name: 'User Management', path: '/admin/users', icon: <Icons.User size={18} /> },
  ];

  const handleLogout = async () => {
    await signOut();
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
            {!collapsed && item.badgeKey && counts[item.badgeKey] > 0 && (
              <span style={styles.badge}>{counts[item.badgeKey] > 9 ? '9+' : counts[item.badgeKey]}</span>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <div>
            <button
              type="button"
              onClick={() => setAdminOpen((open) => !open)}
              style={{
                ...styles.navLink,
                ...styles.adminToggle,
                ...(isAdminRoute ? styles.navLinkActive : {}),
                justifyContent: collapsed ? 'center' : 'flex-start',
                padding: collapsed ? '12px 8px' : '12px 14px',
                width: '100%',
                cursor: 'pointer',
              }}
            >
              <span style={styles.navIcon}><Icons.Briefcase size={20} /></span>
              {!collapsed && (
                <>
                  <span style={{ flex: 1, textAlign: 'left' }}>Admin Tools</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      transition: 'transform 0.2s ease',
                      transform: adminOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    <Icons.Chevron size={16} />
                  </span>
                </>
              )}
            </button>

            {adminOpen && !collapsed && (
              <div style={styles.adminSubList}>
                {adminItems.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    style={({ isActive }) => ({
                      ...styles.subNavLink,
                      ...(isActive ? styles.navLinkActive : {}),
                    })}
                  >
                    <span style={styles.navIcon}>{item.icon}</span>
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}

        <NavLink
          to="/about"
          style={({ isActive }) => ({
            ...styles.navLink,
            ...(isActive ? styles.navLinkActive : {}),
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '12px 8px' : '12px 14px',
          })}
        >
          <span style={styles.navIcon}><Icons.Info size={20} /></span>
          {!collapsed && <span>About Borneo Tracker</span>}
        </NavLink>
      </nav>

      {/* ── Bottom section ── */}
      <div style={styles.bottom}>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Log out (signed in) / Log in (signed out) */}
        {isAuthenticated ? (
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
        ) : (
          <button
            onClick={() => navigate('/login')}
            style={{ ...styles.logoutBtn, color: '#c8ddd2' }}
          >
            <span style={styles.logoutIcon}>⎋</span>
            {!collapsed && 'Log in'}
          </button>
        )}

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

  badge: {
    marginLeft:      'auto',
    minWidth:        '18px',
    height:          '18px',
    padding:         '0 5px',
    borderRadius:    '999px',
    backgroundColor: '#dc2626',
    color:           '#ffffff',
    fontSize:        '10.5px',
    fontWeight:      '800',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    lineHeight:      1,
  },

  adminToggle: {
    backgroundColor: 'transparent',
    // Longhand, non-conflicting sides only — the shorthand `border` property
    // would fight with navLink/navLinkActive's `borderLeft` and trigger a
    // React "mixing shorthand and non-shorthand" style warning on toggle.
    borderTop: 'none',
    borderRight: 'none',
    borderBottom: 'none',
  },
  adminSubList: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '2px',
    padding:       '2px 0 4px',
  },
  subNavLink: {
    display:        'flex',
    alignItems:     'center',
    gap:            '10px',
    padding:        '10px 14px 10px 34px',
    borderRadius:   '8px',
    textDecoration: 'none',
    color:          '#a0bfad',
    fontSize:       '13.5px',
    fontWeight:     '600',
    transition:     'all 0.2s ease',
    borderLeft:     '3px solid transparent',
    fontFamily:     'Inter, Arial, sans-serif',
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
