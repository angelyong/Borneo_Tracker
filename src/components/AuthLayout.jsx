// Shared shell for the login/register/forgot/reset pages. Reuses the same
// MiniTopBar + Footer used everywhere else in the app instead of duplicating
// a header/footer just for auth — these pages just don't get the Sidebar.
import MiniTopBar from './MiniTopBar';
import Footer from './footer';
import { useTranslation } from 'react-i18next';
import { COLORS, FONT, RADII, SHADOWS } from '../theme';

const AuthLayout = ({ children }) => {
  const { t } = useTranslation();
  return (
    <div style={styles.page}>
      <MiniTopBar onMenuClick={() => {}} notifCount={0} />
      <main style={styles.main}>
        <div style={styles.content}>
          <p style={styles.positioning}>{t('auth.positioning')}</p>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};

/** The white rounded card every auth page centers its form in. */
export const AuthCard = ({ children, style }) => (
  <div style={{ ...styles.card, ...style }}>{children}</div>
);

const styles = {
  page: { minHeight: '100vh', background: COLORS.pageBg, fontFamily: FONT },
  main: {
    paddingTop: 92,
    paddingBottom: 48,
    minHeight: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 440,
  },
  positioning: {
    margin: '0 0 12px',
    color: COLORS.forest,
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.3,
    textAlign: 'center',
  },
  card: {
    background: COLORS.card,
    borderRadius: RADII.xl,
    boxShadow: SHADOWS.panel,
    padding: '36px 40px',
    width: '100%',
    maxWidth: 440,
    height: 'fit-content',
  },
};

export default AuthLayout;
