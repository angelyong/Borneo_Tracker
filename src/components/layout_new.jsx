import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Footer from './footer';
import Sidebar from './sidebar';
import MiniTopBar from './MiniTopBar';
import AIChatDialog from './ai-chat/AIChatDialog';
import './layout.css';

const TOPBAR_HEIGHT = 52;
const FOOTER_HEIGHT = 20;

const Layout = ({ children }) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatbotPrefill, setChatbotPrefill] = useState('');

  const isDashboardPage = location.pathname === '/';
  const sidebarWidth = isSidebarOpen ? 240 : 0;

  const triggerLayoutResize = () => {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 280);
  };

  const openChatbot = (prefill = '') => {
    setChatbotPrefill(prefill);
    setIsSidebarOpen(false);
    setIsChatbotOpen(true);
    triggerLayoutResize();
  };

  const handleChatbotToggle = () => {
    if (isChatbotOpen) {
      setIsChatbotOpen(false);
      triggerLayoutResize();
      return;
    }

    openChatbot();
  };

  const handleMenuClick = () => {
    if (isChatbotOpen) {
      setIsChatbotOpen(false);
      triggerLayoutResize();
      return;
    }

    setIsSidebarOpen((value) => !value);
    triggerLayoutResize();
  };

  const handleChatbotClose = () => {
    setIsChatbotOpen(false);
    triggerLayoutResize();
  };

  return (
    <div style={styles.layout}>
      <MiniTopBar
        isSidebarOpen={isSidebarOpen}
        isChatbotOpen={isChatbotOpen}
        onMenuClick={handleMenuClick}
        onChatbotToggle={handleChatbotToggle}
      />

      <div style={styles.shell}>
        <aside style={{ ...styles.sidebar, width: sidebarWidth }}>
          <Sidebar collapsed={!isSidebarOpen} />
        </aside>

        <div
          className={`dashboard-workspace ${isChatbotOpen ? 'chatbot-open' : ''}`}
        >
          {isChatbotOpen && (
            <aside className="chatbot-dock" aria-label="BorneoBot chat panel">
              <AIChatDialog key={chatbotPrefill} open={isChatbotOpen} onClose={handleChatbotClose} prefill={chatbotPrefill} />
            </aside>
          )}

          <main
            style={{
              ...styles.main,
              overflow: isDashboardPage ? 'hidden' : 'auto',
            }}
            className="dashboard-content"
          >
            {children || <Outlet context={{ isSidebarOpen, isChatbotOpen, openChatbot }} />}
          </main>
        </div>
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
    backgroundColor: 'var(--color-shell-bg)',
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
    backgroundColor: 'var(--color-shell-bg)',
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
    backgroundColor: 'var(--color-main-bg)',
  },
};

export default Layout;
