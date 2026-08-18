// Small provenance badge — surfaces the "E" (Ethics/honesty) of the data on any
// score or indicator: confidence level + year + source. Theme-aware via CSS vars
// (see src/theme.css), so it adapts to light/dark automatically.

const CONFIDENCE = {
  high: { label: 'High', fg: 'var(--color-green)', bg: 'var(--color-green-soft)' },
  medium: { label: 'Medium', fg: 'var(--color-amber-dark)', bg: 'var(--color-yellow-soft)' },
  manual: { label: 'Manual', fg: 'var(--color-blue)', bg: 'var(--color-blue-soft)' },
};

export default function ProvenanceChip({ confidence, source, year, showSource = true }) {
  const conf =
    CONFIDENCE[(confidence || '').toLowerCase()] || {
      label: confidence || 'n/a',
      fg: 'var(--color-muted)',
      bg: 'var(--color-grey-soft)',
    };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: 'var(--color-muted)',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      <span
        title={`Data confidence: ${conf.label}`}
        style={{
          padding: '1px 7px',
          borderRadius: 999,
          background: conf.bg,
          color: conf.fg,
          fontWeight: 600,
          fontSize: 10,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {conf.label}
      </span>
      {year ? <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{year}</span> : null}
      {showSource && source ? (
        <span
          title={source}
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          · {source}
        </span>
      ) : null}
    </span>
  );
}
