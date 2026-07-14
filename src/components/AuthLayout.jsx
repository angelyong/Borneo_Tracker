// Shared shell for the login/register/forgot/reset pages. Reuses the same
// MiniTopBar + Footer used everywhere else in the app instead of duplicating
// a header/footer just for auth — these pages just don't get the Sidebar.
import MiniTopBar from './MiniTopBar';
import Footer from './footer';
import { COLORS, FONT, RADII, SHADOWS } from '../theme';

const AuthLayout = ({ children }) => (
  <div style={styles.page}>
    <MiniTopBar onMenuClick={() => {}} notifCount={0} />
    <main style={styles.main}>{children}</main>
    <Footer />
  </div>
);

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
