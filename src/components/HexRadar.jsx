// Shared hexagon radar. It always renders the six True Wealth axes in a fixed
// order. A missing score is deliberately not converted to zero: zero is a real
// score, whereas a gap has no numeric meaning and must remain visible as such.
//
// - Pass max={100} for a fixed 0-100 score scale (otherwise it auto-scales to the
//   largest available value, which suits raw coverage counts).
// - Pass `weakest` (a pillar key) to highlight that scored axis label in red.
// - `maxWidth` controls the rendered size (default 180; use smaller for multiples).
// - `missingLabel`, `incompleteLabel`, and `ariaLabel` can be supplied by a
//   translated parent.
// Theme-aware via CSS vars (src/theme.css).

import { HEXAGON_PILLARS } from './hexagonPillars';
import './HexRadar.css';

function pointAt(angle, radius, cx, cy) {
  return `${cx + radius * Math.cos(angle)},${cy - radius * Math.sin(angle)}`;
}

export default function HexRadar({
  pillars,
  max,
  weakest,
  maxWidth = 180,
  missingLabel = 'No data',
  incompleteLabel = 'Incomplete scores — no polygon shown',
  ariaLabel: translatedAriaLabel,
  onPillarSelect,
  pillarActionLabel = 'Open {{pillar}} indicator details',
}) {
  const keys = HEXAGON_PILLARS;
  const values = keys.map((key) => pillars?.[key]);
  const scoredValues = values.filter(Number.isFinite);
  const cx = 90;
  const cy = 90;
  const maxR = 60;
  const n = keys.length;
  const MAX = Number.isFinite(max) && max > 0 ? max : Math.max(...scoredValues, 1);
  const complete = values.every(Number.isFinite);

  const angleOf = (i) => Math.PI / 2 - (2 * Math.PI * i) / n;

  const rings = [0.25, 0.5, 0.75, 1.0].map((frac) =>
    keys.map((_, i) => pointAt(angleOf(i), maxR * frac, cx, cy)).join(' ')
  );

  const dataPoints = values.map((value, i) =>
    Number.isFinite(value) ? pointAt(angleOf(i), maxR * (value / MAX), cx, cy) : null
  );

  const axes = keys.map((key, i) => {
    const angle = angleOf(i);
    return {
      key,
      value: values[i],
      angle,
      x: cx + maxR * Math.cos(angle),
      y: cy - maxR * Math.sin(angle),
    };
  });

  const defaultAriaLabel = complete
    ? `True Wealth Hexagon scores: ${keys.map((key, i) => `${key} ${values[i]}`).join(', ')}`
    : `True Wealth Hexagon has incomplete scores. ${keys
      .map((key, i) => `${key} ${Number.isFinite(values[i]) ? values[i] : missingLabel}`)
      .join(', ')}`;
  const ariaLabel = translatedAriaLabel || defaultAriaLabel;
  const interactive = typeof onPillarSelect === 'function';

  const selectPillar = (axis) => {
    if (interactive) onPillarSelect(axis.key, axis.value);
  };

  const onPillarKeyDown = (event, axis) => {
    if (!interactive || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    selectPillar(axis);
  };

  return (
    <svg
      aria-label={ariaLabel}
      role={interactive ? 'group' : 'img'}
      viewBox="-26 -14 232 208"
      style={{ width: '100%', maxWidth, display: 'block', margin: '0 auto', overflow: 'visible' }}
    >
      <title>{ariaLabel}</title>
      {rings.map((points, i) => (
        <polygon key={i} points={points} fill="none" stroke="var(--color-border)" strokeWidth="0.8" />
      ))}
      {axes.map((axis) => (
        <line
          key={axis.key}
          x1={cx}
          y1={cy}
          x2={axis.x}
          y2={axis.y}
          stroke="var(--color-border)"
          strokeDasharray={Number.isFinite(axis.value) ? undefined : '3 2'}
          strokeWidth="0.8"
        />
      ))}
      {complete ? (
        <polygon points={dataPoints.join(' ')} fill="rgba(61,184,138,0.25)" stroke="#3db88a" strokeWidth="1.5" />
      ) : (
        axes.filter((axis) => Number.isFinite(axis.value)).map((axis) => {
          const index = keys.indexOf(axis.key);
          const [x, y] = dataPoints[index].split(',');
          return <circle key={axis.key} cx={x} cy={y} r="2.5" fill="#3db88a" />;
        })
      )}
      {!complete && (
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="7" fill="var(--color-muted)">
          {incompleteLabel}
        </text>
      )}
      {axes.map((axis) => {
        const lx = cx + (maxR + 20) * Math.cos(axis.angle);
        const ly = cy - (maxR + 20) * Math.sin(axis.angle);
        const scored = Number.isFinite(axis.value);
        const isWeakest = scored && axis.key === weakest;
        return (
          <g
            key={axis.key}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? pillarActionLabel.replace('{{pillar}}', axis.key) : undefined}
            onClick={() => selectPillar(axis)}
            onKeyDown={(event) => onPillarKeyDown(event, axis)}
            className={interactive ? 'hex-radar-axis' : undefined}
          >
            {interactive && <circle className="hex-radar-focus-ring" cx={lx} cy={ly + 2} r="18" fill="transparent" />}
            <text
              x={lx}
              y={ly - 4}
              textAnchor="middle"
              fontSize={scored ? '10' : '7'}
              fontWeight="600"
              fill={scored ? 'var(--color-ink)' : 'var(--color-faint)'}
            >
              {scored ? axis.value : missingLabel}
            </text>
            <text
              x={lx}
              y={ly + 8}
              textAnchor="middle"
              fontSize="8"
              fontWeight={isWeakest ? '700' : '400'}
              fill={isWeakest ? 'var(--color-red)' : 'var(--color-muted)'}
            >
              {axis.key}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
