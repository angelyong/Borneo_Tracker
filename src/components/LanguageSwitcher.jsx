import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons } from './ui';
import { SUPPORTED_LANGUAGES } from '../i18n';

// Caller supplies `style` so this can drop into any icon-button slot (e.g.
// MiniTopBar's existing circular icon buttons) without duplicating that CSS —
// same convention as ThemeToggle.
const LanguageSwitcher = ({ style }) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const select = (code) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('language.choose')}
        title={t('language.label')}
        style={style}
      >
        <Icons.Globe size={19} />
      </button>

      {open && <div style={styles.overlay} onClick={() => setOpen(false)} />}

      {open && (
        <div style={styles.dropdown} role="listbox" aria-label={t('language.choose')}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={i18n.language === lang.code}
              onClick={() => select(lang.code)}
              style={{
                ...styles.item,
                ...(i18n.language === lang.code ? styles.itemActive : {}),
              }}
            >
              {lang.label}
              {i18n.language === lang.code && <Icons.Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 299,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    minWidth: '170px',
    zIndex: 400,
    padding: '6px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    width: '100%',
    padding: '9px 10px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    textAlign: 'left',
    fontSize: '13.5px',
    fontWeight: '600',
    color: 'var(--color-ink)',
    cursor: 'pointer',
  },
  itemActive: {
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-green)',
  },
};

export default LanguageSwitcher;
