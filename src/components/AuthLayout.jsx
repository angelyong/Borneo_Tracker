// Shared shell for the login/register/forgot/reset pages. Reuses the same
// MiniTopBar + Footer used everywhere else in the app instead of duplicating
// a header/footer just for auth — these pages just don't get the Sidebar.
import { useTranslation } from 'react-i18next';
import MiniTopBar from './MiniTopBar';
import Footer from './footer';
import { COLORS, FONT, RADII, SHADOWS } from '../theme';

const AuthLayout = ({ children }) => {
  const { t } = useTranslation();
  return (
    <div style={styles.page}>
      <MiniTopBar onMenuClick={() => {}} notifCount={0} />
      <main style={styles.main}>
        <p style={styles.tagline}>{t('common.tagline')}</p>
        {children}
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
    flexDirection: 'column',
    alignItems: 'center',
  },
  tagline: {
    margin: '0 0 24px',
    fontSize: 15,
    fontWeight: 600,
    color: COLORS.muted,
    textAlign: 'center',
    fontFamily: FONT,
    letterSpacing: '0.01em',
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
