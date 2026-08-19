import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function ScoreExplainer({ labelKey = 'scoreExplainer.openLabel' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span ref={wrapRef} style={styles.wrap}>
      <button
        ref={buttonRef}
        type="button"
        style={styles.button}
        aria-label={t(labelKey)}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>

      {open && (
        <div id={popoverId} role="dialog" aria-label={t('scoreExplainer.title')} style={styles.popover}>
          <span style={styles.title}>{t('scoreExplainer.title')}</span>
          <span style={styles.row}>
            <b>{t('scoreExplainer.indexLabel')}</b>
            {t('scoreExplainer.indexBody')}
          </span>
          <span style={styles.row}>
            <b>{t('scoreExplainer.strictLabel')}</b>
            {t('scoreExplainer.strictBody')}
          </span>
          <span style={styles.row}>
            <b>{t('scoreExplainer.gapLabel')}</b>
            {t('scoreExplainer.gapBody')}
          </span>
          <button type="button" style={styles.close} onClick={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}>
            {t('common.close')}
          </button>
        </div>
      )}
    </span>
  );
}

const styles = {
  wrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
  },
  button: {
    width: 22,
    height: 22,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--color-border)',
    borderRadius: '50%',
    background: 'var(--color-card)',
    color: 'var(--color-muted)',
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
  },
  popover: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 8px)',
    zIndex: 950,
    width: 'min(300px, calc(100vw - 32px))',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 14px',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    background: 'var(--color-card)',
    color: 'var(--color-ink)',
    boxShadow: '0 14px 34px rgba(15, 23, 42, 0.2)',
    textAlign: 'left',
  },
  title: {
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--color-ink)',
  },
  row: {
    display: 'block',
    fontSize: 12,
    lineHeight: 1.45,
    color: 'var(--color-muted)',
  },
  close: {
    alignSelf: 'flex-start',
    marginTop: 2,
    border: 'none',
    borderRadius: 6,
    background: 'var(--color-grey-soft)',
    color: 'var(--color-ink)',
    fontSize: 12,
    fontWeight: 700,
    padding: '6px 9px',
    cursor: 'pointer',
  },
};
