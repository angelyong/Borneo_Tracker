// Shared hexagon radar. Plots a { pillar: value } object as a radar polygon.
// - Pass max={100} for a fixed 0-100 score scale (otherwise it auto-scales to the
//   largest value, which suits raw counts).
// - Pass `weakest` (a pillar key) to highlight that axis label in red.
// - `maxWidth` controls the rendered size (default 180; use smaller for multiples).
// Theme-aware via CSS vars (src/theme.css). Mirrors the original inline radar in
// OverviewDashboard; keep the two in sync until that one is migrated to this.

export default function HexRadar({ pillars, max, weakest, maxWidth = 180 }) {
  const keys = Object.keys(pillars);
  const values = Object.values(pillars);
  const cx = 90;
  const cy = 90;
  const maxR = 60;
  const n = keys.length;
  const MAX = max || Math.max(...values, 1);

  const angleOf = (i) => Math.PI / 2 - (2 * Math.PI * i) / n;

  const rings = [0.25, 0.5, 0.75, 1.0].map((frac) =>
    keys
      .map((_, i) => {
        const a = angleOf(i);
        return `${cx + maxR * frac * Math.cos(a)},${cy - maxR * frac * Math.sin(a)}`;
      })
      .join(' ')
  );

  const dataPoints = values.map((v, i) => {
    const a = angleOf(i);
    const frac = v / MAX;
    return `${cx + maxR * frac * Math.cos(a)},${cy - maxR * frac * Math.sin(a)}`;
  });

  const axes = keys.map((_, i) => {
    const a = angleOf(i);
    return { x: cx + maxR * Math.cos(a), y: cy - maxR * Math.sin(a) };
  });

  return (
    <svg
      viewBox="-26 -14 232 208"
      style={{ width: '100%', maxWidth, display: 'block', margin: '0 auto', overflow: 'visible' }}
    >
      {rings.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="var(--color-border)" strokeWidth="0.8" />
      ))}
      {axes.map((pt, i) => (
        <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="var(--color-border)" strokeWidth="0.8" />
      ))}
      <polygon points={dataPoints.join(' ')} fill="rgba(61,184,138,0.25)" stroke="#3db88a" strokeWidth="1.5" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="18">
        🌿
      </text>
      {keys.map((key, i) => {
        const a = angleOf(i);
        const lx = cx + (maxR + 20) * Math.cos(a);
        const ly = cy - (maxR + 20) * Math.sin(a);
        return (
          <g key={key}>
            <text x={lx} y={ly - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--color-ink)">
              {values[i]}
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
    </svg>
  );
}
