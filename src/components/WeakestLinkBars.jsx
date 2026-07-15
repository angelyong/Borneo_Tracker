// Weakest-link-first pillar bars — the honest hero of the resilience view.
// The thesis is "resilience = the weakest link", so we rank pillars ASCENDING
// (weakest on top) instead of hiding them in a symmetric average. Each bar fills
// toward the 100 target; the unfilled remainder IS the gap to self-sufficiency.
// Theme-aware via CSS vars (src/theme.css).

const PILLARS = ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'];

function ragColor(score) {
  if (score == null) return 'var(--color-faint)';
  if (score >= 70) return 'var(--color-green)';
  if (score >= 40) return 'var(--color-amber-dark)';
  return 'var(--color-red)';
}

export default function WeakestLinkBars({ territory, title = 'Weakest link first' }) {
  if (!territory?.pillarScores) return null;
  const { pillarScores, weakestPillar } = territory;

  const rows = PILLARS.filter((p) => Number.isFinite(pillarScores[p]))
    .map((p) => ({ pillar: p, score: pillarScores[p] }))
    .sort((a, b) => a.score - b.score);

  if (!rows.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </div>

      {rows.map(({ pillar, score }) => {
        const color = ragColor(score);
        const isWeakest = pillar === weakestPillar;
        return (
          <div key={pillar} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 96,
                flexShrink: 0,
                fontSize: 12,
                fontWeight: isWeakest ? 700 : 600,
                color: isWeakest ? 'var(--color-red)' : 'var(--color-ink)',
              }}
            >
              {pillar}
              {isWeakest ? <span title="The limiting factor"> ⚠</span> : null}
            </span>

            <div
              title={`${score} / 100 — gap to target: ${Math.round((100 - score) * 10) / 10}`}
              style={{
                flex: 1,
                height: 8,
                background: 'var(--color-grey-soft)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, score))}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 999,
                }}
              />
            </div>

            <span
              style={{
                width: 30,
                flexShrink: 0,
                textAlign: 'right',
                fontSize: 13,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color,
              }}
            >
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
