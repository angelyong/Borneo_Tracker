// MoneyVsResilience — the platform's core thesis in one picture.
// "Paper wealth (money) vs true wealth (resilience)": a scatter of the four
// Borneo territories where the X axis is GDP per capita (paper wealth) and the
// Y axis is the Resilience Index (true wealth). The punchline is the DISCONNECT:
// Brunei sits far right on money yet only middling-high on resilience, with a
// fragile Food pillar called out in an annotation. Money ≠ resilience.
//
// Theme-aware via CSS vars (src/theme.css). Dot colour maps from each
// territory's rag rating; everything else is drawn in --color-border / -muted /
// -ink so it re-tints in light and dark mode. Responsive SVG (viewBox + 100%).

// Fixed display order so the four dots read Sabah → Sarawak → Brunei → Kalimantan.
const TERRITORY_ORDER = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];

// rag → colour. Amber is the default/fallback (mirrors WeakestLinkBars).
function ragColor(rag) {
  if (rag === 'green') return 'var(--color-green)';
  if (rag === 'red') return 'var(--color-red)';
  return 'var(--color-amber-dark)';
}

// SVG canvas + plot padding (room for axis titles and tick labels).
const VB_W = 520;
const VB_H = 320;
const PAD = { left: 54, right: 26, top: 22, bottom: 46 };
const PLOT_LEFT = PAD.left; // 54
const PLOT_RIGHT = VB_W - PAD.right; // 494
const PLOT_TOP = PAD.top; // 22
const PLOT_BOTTOM = VB_H - PAD.bottom; // 274
const PLOT_W = PLOT_RIGHT - PLOT_LEFT; // 440
const PLOT_H = PLOT_BOTTOM - PLOT_TOP; // 252

const X_TICKS = [0, 10000, 20000, 30000]; // US$
const Y_TICKS = [0, 50, 100]; // resilience index

function fmtXTick(v) {
  return v === 0 ? '0' : `${Math.round(v / 1000)}k`;
}

export default function MoneyVsResilience({ gdpPerCapita, territories }) {
  if (!gdpPerCapita || !territories) return null;

  // Build the plotted points from whatever the two props actually agree on.
  const points = TERRITORY_ORDER.map((name) => {
    const t = territories[name];
    const gdp = gdpPerCapita[name];
    if (!t || !Number.isFinite(gdp) || !Number.isFinite(t.index)) return null;
    return {
      name,
      gdp,
      index: t.index,
      rag: t.rag,
      weakestPillar: t.weakestPillar,
    };
  }).filter(Boolean);

  if (!points.length) return null;

  // Linear scales, guarded against divide-by-zero. X domain 0 → 36k (stretched
  // if any territory somehow exceeds it); Y domain is the fixed 0 → 100 index.
  const xMax = Math.max(36000, ...points.map((p) => p.gdp)) || 1;
  const sx = (v) => PLOT_LEFT + (Math.max(0, Math.min(xMax, v)) / xMax) * PLOT_W;
  const sy = (v) => PLOT_BOTTOM - (Math.max(0, Math.min(100, v)) / 100) * PLOT_H;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Scatter plot of GDP per capita versus Resilience Index for the four Borneo territories, showing that Brunei has the highest income but not the highest resilience."
      >
        {/* Gridlines (faint) */}
        {X_TICKS.map((v) => (
          <line
            key={`gx-${v}`}
            x1={sx(v)}
            y1={PLOT_TOP}
            x2={sx(v)}
            y2={PLOT_BOTTOM}
            stroke="var(--color-border)"
            strokeWidth="1"
            opacity="0.5"
          />
        ))}
        {Y_TICKS.map((v) => (
          <line
            key={`gy-${v}`}
            x1={PLOT_LEFT}
            y1={sy(v)}
            x2={PLOT_RIGHT}
            y2={sy(v)}
            stroke="var(--color-border)"
            strokeWidth="1"
            opacity="0.5"
          />
        ))}

        {/* Axis lines (solid) */}
        <line
          x1={PLOT_LEFT}
          y1={PLOT_TOP}
          x2={PLOT_LEFT}
          y2={PLOT_BOTTOM}
          stroke="var(--color-border)"
          strokeWidth="1.5"
        />
        <line
          x1={PLOT_LEFT}
          y1={PLOT_BOTTOM}
          x2={PLOT_RIGHT}
          y2={PLOT_BOTTOM}
          stroke="var(--color-border)"
          strokeWidth="1.5"
        />

        {/* X tick labels */}
        {X_TICKS.map((v) => (
          <text
            key={`tx-${v}`}
            x={sx(v)}
            y={PLOT_BOTTOM + 15}
            textAnchor="middle"
            fill="var(--color-muted)"
            fontSize="10"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {fmtXTick(v)}
          </text>
        ))}

        {/* Y tick labels */}
        {Y_TICKS.map((v) => (
          <text
            key={`ty-${v}`}
            x={PLOT_LEFT - 8}
            y={sy(v)}
            textAnchor="end"
            dominantBaseline="central"
            fill="var(--color-muted)"
            fontSize="10"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {v}
          </text>
        ))}

        {/* Axis titles */}
        <text
          x={PLOT_LEFT + PLOT_W / 2}
          y={VB_H - 8}
          textAnchor="middle"
          fill="var(--color-muted)"
          fontSize="11"
          fontWeight="600"
        >
          GDP per capita (US$)
        </text>
        <text
          x={14}
          y={PLOT_TOP + PLOT_H / 2}
          textAnchor="middle"
          fill="var(--color-muted)"
          fontSize="11"
          fontWeight="600"
          transform={`rotate(-90 14 ${PLOT_TOP + PLOT_H / 2})`}
        >
          Resilience (0–100)
        </text>

        {/* Territory dots + labels */}
        {points.map((p) => {
          const cx = sx(p.gdp);
          const cy = sy(p.index);
          const color = ragColor(p.rag);
          // Anchor labels away from the right edge so far-right dots (Brunei)
          // don't overflow the viewBox.
          const anchorEnd = cx > PLOT_LEFT + PLOT_W * 0.6;
          const labelX = anchorEnd ? cx - 9 : cx + 9;
          const textAnchor = anchorEnd ? 'end' : 'start';
          const isBrunei = p.name === 'Brunei';

          return (
            <g key={p.name}>
              <circle
                cx={cx}
                cy={cy}
                r="6"
                fill={color}
                stroke="var(--color-card)"
                strokeWidth="1.5"
              />
              {isBrunei ? (
                <>
                  <text
                    x={labelX}
                    y={cy - 4}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    fill="var(--color-ink)"
                    fontSize="12"
                    fontWeight="700"
                  >
                    {p.name}
                  </text>
                  <text
                    x={labelX}
                    y={cy + 11}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    fill="var(--color-muted)"
                    fontSize="10.5"
                  >
                    · weakest: {p.weakestPillar}
                  </text>
                </>
              ) : (
                <text
                  x={labelX}
                  y={cy}
                  textAnchor={textAnchor}
                  dominantBaseline="central"
                  fill="var(--color-ink)"
                  fontSize="12"
                  fontWeight="600"
                >
                  {p.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p
        style={{
          margin: 0,
          maxWidth: '60ch',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--color-muted)',
        }}
      >
        Money doesn&rsquo;t equal resilience — Brunei has the most GDP per capita,
        yet a fragile food pillar. True wealth is measured across all six
        essentials, not by income.
      </p>
    </div>
  );
}
