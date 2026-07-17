import { useTranslation } from 'react-i18next';
import { COLORS } from '../theme';

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer style={styles.footer}>
      <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>

      <span style={styles.footerLinks}>
        <span style={styles.footerLink}>{t('footer.privacyPolicy')}</span>
        <span style={styles.footerLink}>{t('footer.termsOfUse')}</span>
        <span style={styles.footerLink}>{t('footer.dataPolicy')}</span>
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
    height: '20px',
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