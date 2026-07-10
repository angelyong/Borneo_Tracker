import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Footer from './footer';
import Sidebar from './sidebar';
import MiniTopBar from './MiniTopBar';

const TOPBAR_HEIGHT = 38;
const FOOTER_HEIGHT = 10;

const Layout = ({ children }) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const isDashboardPage = location.pathname === '/';
  const sidebarWidth = isSidebarOpen ? 240 : 0;

  const handleMenuClick = () => {
    setIsSidebarOpen((value) => !value);

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  };

  return (
    <div style={styles.layout}>
      <MiniTopBar
        onMenuClick={handleMenuClick}
        notifCount={2}
      />

      <div style={styles.shell}>
        <aside style={{ ...styles.sidebar, width: sidebarWidth }}>
          <Sidebar collapsed={!isSidebarOpen} />
        </aside>

        <main
          style={{
            ...styles.main,
            overflow: isDashboardPage ? 'hidden' : 'auto',
          }}
        >
          {children || <Outlet context={{ isSidebarOpen }} />}
        </main>
      </div>

      <Footer />
    </div>
  );
};

const styles = {
  layout: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    height: '100vh',
    backgroundColor: '#f5f7f8',
    overflow: 'hidden',
  },

  shell: {
    position: 'fixed',
    top: TOPBAR_HEIGHT,
    left: 0,
    right: 0,
    bottom: FOOTER_HEIGHT,
    display: 'flex',
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: '#f5f7f8',
    zIndex: 1,
  },

  sidebar: {
    flexShrink: 0,
    height: '100%',
    backgroundColor: '#0d2118',
    transition: 'width 0.25s ease',
    overflow: 'hidden',
  },

  main: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    minHeight: 0,
    height: '100%',
    position: 'relative',
    backgroundColor: '#ffffff',
  },
};

export default Layout;
