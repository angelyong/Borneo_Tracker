// BT-12: click-through detail panel for a hexagon radar pillar. Reuses the
// app's existing Modal (ui.jsx) rather than a new overlay pattern, and
// ProvenanceChip for source/year/confidence per indicator rather than a new
// badge. Data comes straight from resilience.json's territories[X].detail —
// filtered by hexagon_pillar already at build time in compute_resilience.py,
// so this component does no re-derivation, just renders what's there.
import { useTranslation } from 'react-i18next';
import { Modal } from './ui';
import ProvenanceChip from './ProvenanceChip';
import { resolvePillarIndicators } from '../utils/pillarIndicators';
import { COLORS } from '../theme';

export default function PillarDrillDown({ pillar, territory, detail, onClose }) {
  const { t } = useTranslation();
  if (!pillar) return null;
  const indicators = resolvePillarIndicators(detail, pillar);

  return (
    <Modal open={Boolean(pillar)} onClose={onClose} width={520}>
      <h3 style={styles.title}>
        {t('dashboard.pillarDrillDownTitle', { pillar, territory })}
      </h3>

      {indicators.length === 0 ? (
        <p style={styles.empty}>{t('dashboard.pillarDrillDownNoData')}</p>
      ) : (
        <ul style={styles.list}>
          {indicators.map((row) => (
            <li key={row.indicator} style={styles.row}>
              <div style={styles.rowHeader}>
                <span style={styles.indicatorName}>{row.indicator}</span>
                <span style={styles.value}>
                  {row.value} {row.unit}
                  <span style={styles.scoreBadge}>
                    {t('dashboard.pillarDrillDownScore', { score: row.score })}
                  </span>
                </span>
              </div>
              <ProvenanceChip confidence={row.confidence} source={row.source} year={row.year} />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const styles = {
  title: { fontSize: 18, fontWeight: 800, color: COLORS.ink, margin: '0 0 16px', paddingRight: 24 },
  empty: { fontSize: 14, color: COLORS.muted, margin: 0 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  row: {
    borderBottom: `1px solid ${COLORS.border || 'var(--color-border)'}`,
    paddingBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  rowHeader: { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  indicatorName: { fontSize: 14, fontWeight: 700, color: COLORS.ink },
  value: { fontSize: 13, color: COLORS.muted, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 8 },
  scoreBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.ink,
    background: 'var(--color-grey-soft)',
    borderRadius: 999,
    padding: '2px 8px',
  },
};
