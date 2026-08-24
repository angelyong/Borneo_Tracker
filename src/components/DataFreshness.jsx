// Data-freshness chip: states, in words, how old the data on screen is.
// The dashboard reads static JSON snapshots rebuilt by a scheduled pipeline, so
// the honest claim is "Data as of <date>", never "live" or "verified daily".

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { classifyFreshness } from '../utils/dataFreshness';
import { formatShortDate } from '../utils/formatDate';

const STATUS_TONE = {
  fresh: { fg: 'var(--color-green)', bg: 'var(--color-green-soft)' },
  stale: { fg: 'var(--color-amber-dark)', bg: 'var(--color-yellow-soft)' },
  veryStale: { fg: 'var(--color-red)', bg: 'var(--color-red-soft)' },
  unknown: { fg: 'var(--color-muted)', bg: 'var(--color-grey-soft)' },
};

const PREVIEW_SOURCE_COUNT = 3;

function cleanSource(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function yearNumber(value) {
  const matches = String(value || '').match(/\d{4}/g);
  if (!matches) return null;
  return Math.max(...matches.map(Number));
}

function latestYearFromRows(rows) {
  const years = rows.map((row) => yearNumber(row?.year)).filter(Number.isFinite);
  return years.length ? Math.max(...years) : null;
}

function uniqueSourcesFromRows(rows) {
  const sources = [];
  const seen = new Set();
  rows.forEach((row) => {
    const source = cleanSource(row?.source);
    if (!source || seen.has(source)) return;
    seen.add(source);
    sources.push(source);
  });
  return sources;
}

function resilienceRows(territories) {
  return Object.values(territories || {}).flatMap((territory) =>
    Object.values(territory?.detail || {}).flatMap((entries) => entries || [])
  );
}

function maxLatestYearFromCoverage(coverage) {
  const groups = coverage?.territories || coverage?.parents || {};
  const years = Object.values(groups)
    .map((entry) => entry?.latestYear)
    .filter(Number.isFinite);
  return years.length ? Math.max(...years) : null;
}

function summarizeArtifact(artifact) {
  const meta = artifact?.meta;
  const rows = artifact?.rows || resilienceRows(artifact?.territories);
  const sources = uniqueSourcesFromRows(rows);
  const sourceCount = Number.isFinite(meta?.sourceCount) ? meta.sourceCount : sources.length;
  const latestYear = maxLatestYearFromCoverage(meta?.coverage) ?? latestYearFromRows(rows);

  let coverage = null;
  if (meta?.coverage?.totalDistricts != null) {
    coverage = `${meta.coverage.totalDistricts} districts, ${meta.coverage.totalRows ?? rows.length} rows`;
  } else if (meta?.coverage?.scoredIndicators != null) {
    coverage = `${meta.coverage.scoredIndicators} scored indicators`;
  } else if (meta?.coverage?.totalRows != null) {
    const canonical = meta.coverage.canonicalRows;
    coverage =
      canonical != null
        ? `${meta.coverage.totalRows} rows, ${canonical} canonical`
        : `${meta.coverage.totalRows} rows`;
  } else if (rows.length) {
    coverage = `${rows.length} rows`;
  }

  return {
    hasMeta: Boolean(meta),
    sourceCount,
    sourcePreview: sources.slice(0, PREVIEW_SOURCE_COUNT),
    cadence: meta?.updateCadence || null,
    coverage,
    latestYear,
  };
}

function cadenceLabel(cadence, t) {
  if (!cadence) return t('freshnessTrust.cadenceUnknown');
  return t(`freshnessTrust.cadence.${cadence}`, { defaultValue: cadence });
}

export default function DataFreshness({ generatedAt, loading = false, artifact = null, style }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const dialogId = useId();
  const { status, ageDays, date } = classifyFreshness(generatedAt);
  const summary = useMemo(() => summarizeArtifact(artifact), [artifact]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
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

  if (loading) return null;

  const tone = STATUS_TONE[status] || STATUS_TONE.unknown;
  const headline =
    status === 'unknown'
      ? t('freshnessTrust.dateUnknown')
      : t('freshnessTrust.dataAsOf', { date: formatShortDate(date, i18n.language) });

  let ageText = null;
  if (status === 'fresh') {
    ageText = t('freshnessTrust.ageFresh');
  } else if (status === 'stale') {
    ageText = t('freshnessTrust.ageDays', { count: ageDays });
  } else if (status === 'veryStale') {
    ageText = `${t('freshnessTrust.ageDays', { count: ageDays })} - ${t('freshnessTrust.ageStalled')}`;
  }

  const tooltip = status === 'unknown' ? t('freshnessTrust.tooltipUnknown') : t('freshnessTrust.tooltip');
  const buildClockText =
    status === 'unknown'
      ? t('freshnessTrust.dateUnknownShort')
      : t('freshnessTrust.buildClockValue', { date: formatShortDate(date, i18n.language) });
  const substantiveText = summary.latestYear
    ? t('freshnessTrust.substantiveValue', { year: summary.latestYear })
    : t('freshnessTrust.substantiveUnknown');
  const sourceText = summary.sourceCount
    ? t('freshnessTrust.sourcesValue', { count: summary.sourceCount })
    : t('freshnessTrust.sourcesUnknown');
  const sourcePreview = summary.sourcePreview.length ? summary.sourcePreview.join('; ') : null;
  const cadenceText = t('freshnessTrust.frequencyValue', {
    cadence: cadenceLabel(summary.cadence, t),
  });
  const coverageText = summary.coverage || t('freshnessTrust.coverageUnknown');

  return (
    <span
      ref={rootRef}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: 'var(--color-muted)',
        minWidth: 0,
        position: 'relative',
        ...style,
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        title={tooltip}
        aria-label={t('freshnessTrust.openTrustChain')}
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen((value) => !value)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: 0,
          background: 'transparent',
          padding: 0,
          color: 'inherit',
          font: 'inherit',
          cursor: 'pointer',
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
        {ageText ? <span style={{ whiteSpace: 'nowrap' }}>- {ageText}</span> : null}
      </button>

      {open ? (
        <div
          id={dialogId}
          role="dialog"
          aria-label={t('freshnessTrust.popoverTitle')}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 1100,
            width: 320,
            maxWidth: 'min(320px, calc(100vw - 32px))',
            padding: 12,
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            background: 'var(--color-surface)',
            boxShadow: '0 16px 38px rgba(15, 23, 42, 0.18)',
            color: 'var(--color-text)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{t('freshnessTrust.popoverTitle')}</div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.45, marginBottom: 10 }}>
            {t('freshnessTrust.popoverIntro', {
              metaStatus: summary.hasMeta ? t('freshnessTrust.metaAvailable') : t('freshnessTrust.metaFallback'),
            })}
          </div>
          {[
            [t('freshnessTrust.lastUpdatedLabel'), substantiveText],
            [t('freshnessTrust.buildClockLabel'), buildClockText],
            [t('freshnessTrust.sourcesLabel'), sourcePreview ? `${sourceText}: ${sourcePreview}` : sourceText],
            [t('freshnessTrust.frequencyLabel'), cadenceText],
            [t('freshnessTrust.coverageLabel'), coverageText],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10, marginTop: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 12, lineHeight: 1.35 }}>{value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </span>
  );
}
