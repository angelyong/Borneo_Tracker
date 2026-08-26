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
export default function PillarDrilldownModal({
  open,
  onClose,
  territory,
  pillar,
  score,
  indicators,
  // Aggregate scopes only: the per-territory pillar scores this score is the
  // mean of, pre-formatted by the caller (e.g. ["Sabah 61.0", "Brunei 100.0"]).
  contributors = null,
}) {
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
                  // An aggregate flattens four territories' rows into one list,
                  // so the same indicator and year can appear more than once —
                  // Sabah and Sarawak both report Clean water access for 2022.
                  // The territory has to be part of the key, not just the label.
                  <li key={`${indicator.territory || ''}-${indicator.indicator}-${indicator.year || ''}`}>
                    <strong>
                      {indicator.territory ? `${indicator.territory} · ` : null}
                      {indicator.indicator}
                    </strong>
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

            {/* An averaged score is the one a reader cannot account for from
                the rows above, so the arithmetic is stated rather than implied. */}
            {contributors ? (
              <p className="pillar-drilldown-method">
                {t('pillarDrilldown.aggregateMethod', {
                  score,
                  parts: contributors.join(' · '),
                  // Deliberately not `count`: i18next reserves it for plural
                  // resolution and would look for _one/_other variants that
                  // Malay must not have.
                  territories: contributors.length,
                })}
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
