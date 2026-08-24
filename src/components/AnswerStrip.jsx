// BT-22 answer strip: one compact strip that answers what / where / why /
// what next for the scope currently on screen — deliberately not four cards.
//
// Every slot is selected by src/utils/answerStrip.js from data that is already
// on the page; this component only translates and lays out. A slot the data
// cannot answer is omitted rather than filled with a plausible sentence, so the
// strip shrinks on thin scopes instead of lying about them.

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { translateHeadline, translatePillar } from '../utils/headlineText';

function Row({ label, children }) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>{children}</span>
    </div>
  );
}

export default function AnswerStrip({ strip, compact = false, style }) {
  const { t } = useTranslation();

  if (!strip?.what) return null;

  const translateSlot = (slot) =>
    slot ? t(slot.key, { ...slot.values, pillar: translatePillar(t, slot.values?.pillar) }) : null;

  const where = translateSlot(strip.where);
  const why = translateSlot(strip.why);

  return (
    <section
      aria-label={t('answerStrip.title')}
      style={{ ...styles.strip, ...(compact ? styles.stripCompact : null), ...style }}
    >
      <Row label={t('answerStrip.labelWhat')}>{translateHeadline(t, strip.what)}</Row>
      {where ? <Row label={t('answerStrip.labelWhere')}>{where}</Row> : null}
      {why ? <Row label={t('answerStrip.labelWhy')}>{why}</Row> : null}
      {strip.next ? (
        <Row label={t('answerStrip.labelNext')}>
          <Link to={strip.next.href} style={styles.cta}>
            {translateSlot(strip.next)}
          </Link>
        </Row>
      ) : null}
    </section>
  );
}

const styles = {
  strip: {
    display: 'grid',
    gap: '6px',
    margin: '10px 0 0',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-grey-soft)',
    textAlign: 'left',
  },
  stripCompact: {
    padding: '8px 10px',
    gap: '4px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(52px, auto) 1fr',
    gap: '10px',
    alignItems: 'baseline',
  },
  label: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--color-muted)',
  },
  value: {
    fontSize: '12px',
    lineHeight: 1.45,
    color: 'var(--color-ink)',
  },
  cta: {
    color: 'var(--color-ink)',
    fontWeight: 700,
    textDecoration: 'underline',
  },
};
