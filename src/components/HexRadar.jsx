// Shared hexagon radar. Plots a { pillar: value } object as a radar polygon.
// - Pass max={100} for a fixed 0-100 score scale (otherwise it auto-scales to the
//   largest value, which suits raw counts).
// - Pass `weakest` (a pillar key) to highlight that axis label in red.
// - `maxWidth` controls the rendered size (default 180; use smaller for multiples).
// - Pass null/undefined for unscored pillars; real numeric 0 remains a valid score.
// Theme-aware via CSS vars (src/theme.css).

import { useTranslation } from 'react-i18next';

export default function HexRadar({ pillars, max, weakest, maxWidth = 180 }) {
  const { t } = useTranslation();
  const keys = Object.keys(pillars);
  const values = Object.values(pillars);
  const finiteValues = values.filter(Number.isFinite);
  const cx = 90;
  const cy = 90;
  const maxR = 60;
  const n = keys.length;
  const MAX = max || Math.max(...finiteValues, 1);
  const hasMissing = values.some((value) => !Number.isFinite(value));

  const angleOf = (i) => Math.PI / 2 - (2 * Math.PI * i) / n;

  const rings = [0.25, 0.5, 0.75, 1.0].map((frac) =>
    keys
      .map((_, i) => {
        const a = angleOf(i);
        return `${cx + maxR * frac * Math.cos(a)},${cy - maxR * frac * Math.sin(a)}`;
      })
      .join(' ')
  );

  const dataPoints = values.map((value, i) => {
    if (!Number.isFinite(value)) return null;
    const a = angleOf(i);
    const frac = value / MAX;
    return {
      x: cx + maxR * frac * Math.cos(a),
      y: cy - maxR * frac * Math.sin(a),
    };
  });

  const completePolygon = dataPoints.every(Boolean)
    ? dataPoints.map((point) => `${point.x},${point.y}`).join(' ')
    : '';

  const axes = keys.map((_, i) => {
    const a = angleOf(i);
    return { x: cx + maxR * Math.cos(a), y: cy - maxR * Math.sin(a) };
  });

  return (
    <svg
      viewBox="-26 -14 232 208"
      style={{ width: '100%', maxWidth, display: 'block', margin: '0 auto', overflow: 'visible' }}
      role="img"
      aria-label={hasMissing ? t('dashboard.noComparableData') : undefined}
    >
      {rings.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="var(--color-border)" strokeWidth="0.8" />
      ))}
      {axes.map((pt, i) => {
        const scored = Number.isFinite(values[i]);
        return (
          <line
            key={keys[i]}
            x1={cx}
            y1={cy}
            x2={pt.x}
            y2={pt.y}
            stroke={scored ? 'var(--color-border)' : 'var(--color-faint)'}
            strokeWidth={scored ? '0.8' : '1.1'}
            strokeDasharray={scored ? undefined : '3 4'}
          />
        );
      })}
      {completePolygon ? (
        <polygon points={completePolygon} fill="rgba(61,184,138,0.25)" stroke="#3db88a" strokeWidth="1.5" />
      ) : (
        <>
          {dataPoints.map((point, i) => {
            const next = dataPoints[(i + 1) % dataPoints.length];
            if (!point || !next) return null;
            return (
              <line
                key={`${keys[i]}-${keys[(i + 1) % keys.length]}`}
                x1={point.x}
                y1={point.y}
                x2={next.x}
                y2={next.y}
                stroke="#3db88a"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            );
          })}
          {dataPoints.map((point, i) => (
            point ? <circle key={`${keys[i]}-point`} cx={point.x} cy={point.y} r="2.4" fill="#3db88a" /> : null
          ))}
        </>
      )}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="18">
        *
      </text>
      {keys.map((key, i) => {
        const a = angleOf(i);
        const lx = cx + (maxR + 20) * Math.cos(a);
        const ly = cy - (maxR + 20) * Math.sin(a);
        const hasValue = Number.isFinite(values[i]);
        return (
          <g key={key}>
            <text
              x={lx}
              y={ly - 4}
              textAnchor="middle"
              fontSize={hasValue ? '10' : '8'}
              fontWeight="600"
              fill={hasValue ? 'var(--color-ink)' : 'var(--color-faint)'}
            >
              {hasValue ? values[i] : t('common.noData')}
            </text>
            <text
              x={lx}
              y={ly + 8}
              textAnchor="middle"
              fontSize="8"
              fontWeight={key === weakest ? '700' : '400'}
              fill={key === weakest ? 'var(--color-red)' : 'var(--color-muted)'}
            >
              {key}
            </text>
          </g>
        );
      })}
      {hasMissing && (
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="8" fontWeight="600" fill="var(--color-faint)">
          {t('dashboard.noComparableData')}
        </text>
      )}
    </svg>
  );
}
