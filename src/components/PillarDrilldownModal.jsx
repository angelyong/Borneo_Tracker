import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProvenanceChip from './ProvenanceChip';
import './PillarDrilldownModal.css';

function formatIndicatorValue(indicator) {
  if (!Number.isFinite(indicator?.value)) return '—';
  return `${indicator.value.toLocaleString()}${indicator.unit ? ` ${indicator.unit}` : ''}`;
}

function getFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
}

// This modal deliberately receives the resilience `detail` payload rather than
// deriving a score from dashboard rows. That keeps the UI tied to the exact
// scored inputs and leaves unscored pillars visibly unscored.
export default function PillarDrilldownModal({ open, onClose, territory, pillar, score, indicators }) {
  const { t } = useTranslation();
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const isScored = Number.isFinite(score);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current?.contains(document.activeElement)) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [onClose, open]);

  if (!open || !pillar) return null;

  const detail = Array.isArray(indicators) ? indicators : [];
  const hasDetail = detail.length > 0;

  return (
    <div className="pillar-drilldown-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} className="pillar-drilldown-modal" role="dialog" aria-modal="true" aria-labelledby="pillar-drilldown-title">
        <header className="pillar-drilldown-header">
          <div>
            <p>{territory}</p>
            <h2 id="pillar-drilldown-title">{t('pillarDrilldown.title', { pillar })}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t('common.close')}>×</button>
        </header>

        {!isScored ? (
          <div className="pillar-drilldown-empty" role="status">
            <h3>{t('pillarDrilldown.unscoredTitle')}</h3>
            <p>{t('pillarDrilldown.unscoredBody', { pillar, territory })}</p>
            <Link to="/data-sources" onClick={onClose}>{t('pillarDrilldown.roadmapCta')}</Link>
          </div>
        ) : (
          <>
            <p className="pillar-drilldown-score">{t('pillarDrilldown.score', { score })}</p>
            {hasDetail ? (
              <ul className="pillar-drilldown-list">
                {detail.map((indicator) => (
                  <li key={`${indicator.indicator}-${indicator.year || ''}`}>
                    <strong>{indicator.indicator}</strong>
                    <span>{formatIndicatorValue(indicator)} · {t('pillarDrilldown.indicatorScore', { score: indicator.score })}</span>
                    <ProvenanceChip
                      confidence={indicator.confidence}
                      source={indicator.source || t('common.noData')}
                      year={indicator.year}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="pillar-drilldown-empty">
                <h3>{t('pillarDrilldown.aggregateTitle')}</h3>
                <p>{t('pillarDrilldown.aggregateBody')}</p>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
