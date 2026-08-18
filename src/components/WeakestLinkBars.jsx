// Weakest-link-first pillar bars — the honest hero of the resilience view.
// The thesis is "resilience = the weakest scored link", so scored pillars are
// ranked ASCENDING. Missing pillars remain explicit after those scores; they are
// not treated as zero or ranked as a weakest link.

import { HEXAGON_PILLARS } from './hexagonPillars';

function ragColor(score) {
  if (score == null) return 'var(--color-faint)';
  if (score >= 70) return 'var(--color-green)';
  if (score >= 40) return 'var(--color-amber-dark)';
  return 'var(--color-red)';
}

export default function WeakestLinkBars({
  territory,
  title = 'Weakest link first',
  explanation,
  missingLabel = 'No comparable data — never imputed',
}) {
  if (!territory?.pillarScores) return null;
  const { pillarScores, weakestPillar } = territory;

  const rows = HEXAGON_PILLARS
    .map((pillar) => ({ pillar, score: pillarScores[pillar] }))
    .sort((a, b) => {
      const aScored = Number.isFinite(a.score);
      const bScored = Number.isFinite(b.score);
      if (aScored && bScored) return a.score - b.score;
      if (aScored) return -1;
      if (bScored) return 1;
      return HEXAGON_PILLARS.indexOf(a.pillar) - HEXAGON_PILLARS.indexOf(b.pillar);
    });

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

      {explanation ? (
        <p style={{ color: 'var(--color-muted)', fontSize: 12, lineHeight: 1.45, margin: '-3px 0 1px' }}>
          {explanation}
        </p>
      ) : null}

      {rows.map(({ pillar, score }) => {
        const scored = Number.isFinite(score);
        const color = ragColor(score);
        const isWeakest = scored && pillar === weakestPillar;
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

            {scored ? (
              <>
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
              </>
            ) : (
              <span
                style={{ color: 'var(--color-faint)', fontSize: 12, fontStyle: 'italic' }}
                title={missingLabel}
              >
                {missingLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
