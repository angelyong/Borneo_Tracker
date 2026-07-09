import { COLORS } from '../theme';

const Footer = () => {
  return (
    <footer style={styles.footer}>
      <span>© 2026 Borneo Tracker. All rights reserved.</span>

      <span style={styles.footerLinks}>
        <span style={styles.footerLink}>Privacy Policy</span>
        <span style={styles.footerLink}>Terms of Use</span>
        <span style={styles.footerLink}>Data Policy</span>
      </span>
    </footer>
  );
};

const styles = {
  footer: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    height: '25px',
    background: COLORS.forestDark,
    color: '#E5EFE8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    fontSize: 13,
    boxSizing: 'border-box',
    zIndex: 500,
  },

  footerLinks: {
    display: 'flex',
    gap: 26,
    fontWeight: 600,
  },

  footerLink: {
    cursor: 'pointer',
  },
};

export default Footer;