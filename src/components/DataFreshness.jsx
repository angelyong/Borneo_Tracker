// Data-freshness chip — states, in words, how old the data on screen is.
// The dashboard reads static JSON snapshots rebuilt by a daily pipeline, so the
// honest claim is "data as of <date>", never "live". This is the page-level
// counterpart to ProvenanceChip (per-row confidence): same visual language,
// theme-aware via the CSS vars in src/theme.css.
//
// Staleness thresholds live in src/utils/dataFreshness.js next to the date
// logic they guard.

import { useTranslation } from 'react-i18next';
import { classifyFreshness } from '../utils/dataFreshness';

// Tone per staleness state. Colour is a reinforcement only — the chip always
// spells the age out in text, so it never depends on colour alone.
const STATUS_TONE = {
  fresh: { fg: 'var(--color-green)', bg: 'var(--color-green-soft)' },
  stale: { fg: 'var(--color-amber-dark)', bg: 'var(--color-yellow-soft)' },
  veryStale: { fg: 'var(--color-red)', bg: 'var(--color-red-soft)' },
  unknown: { fg: 'var(--color-muted)', bg: 'var(--color-grey-soft)' },
};

// The app's two languages mapped to the locales that render "23 Jul 2026".
const DATE_LOCALE = { en: 'en-GB', ms: 'ms-MY' };
const DATE_FORMAT = { day: '2-digit', month: 'short', year: 'numeric' };

function formatDate(date, language) {
  const locale = DATE_LOCALE[language] || DATE_LOCALE[String(language).split('-')[0]] || 'en-GB';
  try {
    return date.toLocaleDateString(locale, { ...DATE_FORMAT, timeZone: 'UTC' });
  } catch {
    // Exotic/unsupported locale tag — fall back to the raw ISO day.
    return date.toISOString().slice(0, 10);
  }
}

export default function DataFreshness({ generatedAt, loading = false, style }) {
  const { t, i18n } = useTranslation();

  // While the snapshot is still in flight there is nothing honest to claim yet —
  // render nothing rather than flashing "date unknown" and then correcting it.
  const { status, ageDays, date } = classifyFreshness(generatedAt);
  if (loading) return null;
  const tone = STATUS_TONE[status] || STATUS_TONE.unknown;

  const headline =
    status === 'unknown'
      ? t('freshness.dateUnknown')
      : t('freshness.dataAsOf', { date: formatDate(date, i18n.language) });

  let ageText = null;
  if (status === 'fresh') {
    ageText = t('freshness.ageFresh');
  } else if (status === 'stale') {
    ageText = t('freshness.ageDays', { count: ageDays });
  } else if (status === 'veryStale') {
    ageText = `${t('freshness.ageDays', { count: ageDays })} · ${t('freshness.ageStalled')}`;
  }

  const tooltip = status === 'unknown' ? t('freshness.tooltipUnknown') : t('freshness.tooltip');

  // No aria-label: the visible text already states the date and the age in
  // words (colour is only a reinforcement), so naming the span would just make
  // screen readers repeat it. `title` carries the longer explanation, matching
  // ProvenanceChip's convention.
  return (
    <span
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: 'var(--color-muted)',
        minWidth: 0,
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          background: tone.bg,
          color: tone.fg,
          fontWeight: 600,
          fontSize: 10,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }}
        />
        {headline}
      </span>
      {ageText ? <span style={{ whiteSpace: 'nowrap' }}>· {ageText}</span> : null}
    </span>
  );
}
