// App shell per the Figma redesign: cream top bar (hamburger / centered logo / bell +
// avatar), dark-green slide-out sidebar, dark-green footer.
import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { COLORS, FONT, RADII, SHADOWS } from '../theme';
import { Icons, Logo, Menu } from './ui';

const NOTIFICATIONS = [
  {
    id: 1,
    icon: 'update',
    title: 'Southern Sarawak Resilience Status Updated',
    body: 'Overall Borneo score of Southern Sarawak dropped from "Good" to "Moderate".',
    time: '53 minutes ago',
  },
  {
    id: 2,
    icon: 'check',
    title: 'Your Deforestation Report Has Been Approved.',
    body: '',
    time: '56 minutes ago',
  },
];

function CircleButton({ children, onClick, badge, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        position: 'relative',
        width: 42,
        height: 42,
        borderRadius: '50%',
        border: 'none',
        background: 'transparent',
        color: COLORS.forest,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
      {badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 0,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            background: '#E02424',
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function NotificationsMenu({ user }) {
  const [open, setOpen] = useState(false);
  const count = user ? NOTIFICATIONS.length : 0;
  return (
    <div style={{ position: 'relative' }}>
      <CircleButton label="Notifications" badge={open ? 0 : count} onClick={() => setOpen((v) => !v)}>
        <Icons.Bell size={24} />
      </CircleButton>
      {open && (
        <div
          className="bt-fade-in"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 330,
            background: '#fff',
            borderRadius: RADII.md,
            boxShadow: SHADOWS.panel,
            zIndex: 400,
            overflow: 'hidden',
          }}
        >
          {(user ? NOTIFICATIONS : []).map((n) => (
            <div
              key={n.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '14px 16px',
                borderBottom: '1px solid #F3F4F6',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: n.icon === 'check' ? '#3B82F6' : '#EFF6FF',
                  color: n.icon === 'check' ? '#fff' : '#3B82F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {n.icon === 'check' ? <Icons.Check size={18} /> : <Icons.People size={18} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: COLORS.ink }}>{n.title}</div>
                {n.body && (
                  <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: 'italic', marginTop: 3 }}>
                    {n.body}
                  </div>
                )}
                <div style={{ fontSize: 11, color: COLORS.faint, marginTop: 4, textAlign: 'right' }}>
                  {n.time}
                </div>
              </div>
            </div>
          ))}
          {!user && (
            <div style={{ padding: 18, fontSize: 14, color: COLORS.muted, textAlign: 'center' }}>
              Sign in to receive notifications.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const NAV_PUBLIC_LOCKED = ['/regions', '/esg', '/sdg'];

function SidebarItem({ to, icon, label, locked, onNavigate }) {
  return (
    <NavLink to={locked ? '/login' : to} onClick={onNavigate} style={{ textDecoration: 'none' }}>
      {({ isActive }) => {
        const active = isActive && !locked;
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '13px 18px',
              margin: '4px 12px',
              borderRadius: RADII.md,
              background: active ? COLORS.leaf : 'transparent',
              color: active ? COLORS.forestDark : COLORS.onDark,
              fontWeight: active ? 800 : 600,
              fontSize: 15.5,
            }}
          >
            {icon}
            <span style={{ flex: 1 }}>{label}</span>
            {locked && <Icons.Lock size={16} />}
          </div>
        );
      }}
    </NavLink>
  );
}

function Sidebar({ open, onClose }) {
  const { user, isAdmin } = useAuth();
  const [adminOpen, setAdminOpen] = useState(true);
  const location = useLocation();
  if (!open) return null;

  const lockFor = (path) => !user && NAV_PUBLIC_LOCKED.includes(path);
  const adminActive = ['/admin/users', '/admin/reports'].includes(location.pathname);

  return (
    <aside
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: 292,
        background: COLORS.forest,
        zIndex: 250,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 12,
        boxShadow: '4px 0 18px rgba(15,42,30,0.25)',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <SidebarItem to="/" icon={<Icons.Grid size={20} />} label="Overview" onNavigate={onClose} />
        <SidebarItem
          to="/regions"
          icon={<Icons.Table size={20} />}
          label="Regional Details"
          locked={lockFor('/regions')}
          onNavigate={onClose}
        />
        <SidebarItem
          to="/esg"
          icon={<Icons.Gauge size={20} />}
          label="ESG Indicators"
          locked={lockFor('/esg')}
          onNavigate={onClose}
        />
        <SidebarItem
          to="/sdg"
          icon={<Icons.Chart size={20} />}
          label="SDG Progress"
          locked={lockFor('/sdg')}
          onNavigate={onClose}
        />
        <SidebarItem
          to="/submit-report"
          icon={<Icons.FileArrow size={20} />}
          label="Submit Report"
          onNavigate={onClose}
        />
        <SidebarItem
          to="/community-report"
          icon={<Icons.People size={20} />}
          label="Community Report"
          onNavigate={onClose}
        />
        <SidebarItem
          to="/data-sources"
          icon={<Icons.Frame size={20} />}
          label="Data Sources"
          onNavigate={onClose}
        />

        {isAdmin && (
          <>
            <div
              onClick={() => setAdminOpen((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 18px',
                margin: '4px 12px',
                borderRadius: RADII.md,
                background: adminActive || adminOpen ? '#2E2A4F' : 'transparent',
                color: '#fff',
                fontWeight: 800,
                fontSize: 15.5,
                cursor: 'pointer',
              }}
            >
              <Icons.Briefcase size={20} />
              <span style={{ flex: 1 }}>Admin Tools</span>
              <Icons.Chevron
                size={18}
                style={{ transform: adminOpen ? 'rotate(180deg)' : 'none' }}
              />
            </div>
            {adminOpen && (
              <div
                style={{
                  margin: '0 12px 4px',
                  borderRadius: RADII.md,
                  background: '#241F45',
                  padding: '6px 0',
                }}
              >
                {[
                  { to: '/admin/users', label: 'User Management', icon: <Icons.People size={17} /> },
                  {
                    to: '/admin/reports',
                    label: 'Report Verification',
                    icon: <Icons.Check size={17} />,
                  },
                ].map((it) => (
                  <NavLink key={it.to} to={it.to} onClick={onClose} style={{ textDecoration: 'none' }}>
                    {({ isActive }) => (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 20px',
                          color: '#fff',
                          fontSize: 13.5,
                          fontWeight: isActive ? 800 : 600,
                          opacity: isActive ? 1 : 0.85,
                        }}
                      >
                        {it.icon}
                        {it.label}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ paddingBottom: 10 }}>
        <SidebarItem
          to="/about"
          icon={<Icons.Info size={20} />}
          label="About Borneo Tracker"
          onNavigate={onClose}
        />
      </div>
    </aside>
  );
}

export default function Layout({ children, sidebarDefaultOpen = false, contentStyle }) {
  const [sidebarOpen, setSidebarOpen] = useState(sidebarDefaultOpen);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const avatarItems = user
    ? [
        {
          label: 'My Profile',
          icon: <Icons.User size={17} />,
          onClick: () => navigate('/profile'),
        },
        {
          label: 'Report Tracking',
          icon: <Icons.FileArrow size={17} />,
          onClick: () => navigate('/report-tracking'),
        },
        {
          label: 'Log Out',
          icon: <Icons.Logout size={17} />,
          danger: true,
          onClick: () => {
            logout();
            navigate('/');
          },
        },
      ]
    : [
        { label: 'Sign In', icon: <Icons.User size={17} />, onClick: () => navigate('/login') },
        {
          label: 'Register',
          icon: <Icons.FileArrow size={17} />,
          onClick: () => navigate('/register'),
        },
      ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
        background: COLORS.pageBg,
      }}
    >
      {/* Top bar */}
      <header
        style={{
          background: COLORS.cream,
          borderRadius: '0 0 18px 18px',
          boxShadow: SHADOWS.bar,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 22px',
          position: 'relative',
          zIndex: 300,
        }}
      >
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Menu"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: 'none',
            background: COLORS.forest,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icons.Menu size={22} />
        </button>

        <div
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}
        >
          <Logo size={46} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NotificationsMenu user={user} />
          <Menu
            trigger={
              <CircleButton label="Account">
                <Icons.User size={26} />
              </CircleButton>
            }
            items={avatarItems}
          />
        </div>
      </header>

      {/* Body */}
      <main style={{ flex: 1, position: 'relative', ...contentStyle }}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {children}
      </main>

      {/* Footer */}
      <footer
        style={{
          background: COLORS.forestDark,
          color: '#E5EFE8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 20px',
          fontSize: 12,
        }}
      >
        <span>© 2026 Borneo Tracker. All right reserved</span>
        <span style={{ display: 'flex', gap: 26, fontWeight: 600 }}>
          <span style={{ cursor: 'pointer' }}>Privacy Policy</span>
          <span style={{ cursor: 'pointer' }}>Terms of Use</span>
          <span style={{ cursor: 'pointer' }}>Data Policy</span>
        </span>
      </footer>
    </div>
  );
}
