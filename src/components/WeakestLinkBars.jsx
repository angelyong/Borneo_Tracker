// Weakest-link-first pillar bars.
// Scored pillars rank ascending so the weakest real score appears first.
// Unscored pillars stay visible as no-data rows rather than disappearing or
// masquerading as zero.

import { useTranslation } from 'react-i18next';

const PILLARS = ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'];

function ragColor(score) {
  if (score == null) return 'var(--color-faint)';
  if (score >= 70) return 'var(--color-green)';
  if (score >= 40) return 'var(--color-amber-dark)';
  return 'var(--color-red)';
}

export default function WeakestLinkBars({ territory, title = 'Weakest link first' }) {
  const { t } = useTranslation();
  if (!territory?.pillarScores) return null;
  const { pillarScores, weakestPillar } = territory;

  const rows = PILLARS
    .map((pillar) => ({
      pillar,
      score: pillarScores[pillar],
      scored: Number.isFinite(pillarScores[pillar]),
    }))
    .sort((a, b) => {
      if (a.scored !== b.scored) return a.scored ? -1 : 1;
      if (!a.scored) return PILLARS.indexOf(a.pillar) - PILLARS.indexOf(b.pillar);
      return a.score - b.score;
    });

  if (!rows.some((row) => row.scored)) return null;

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

      {rows.map(({ pillar, score, scored }) => {
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
                color: scored ? (isWeakest ? 'var(--color-red)' : 'var(--color-ink)') : 'var(--color-faint)',
              }}
            >
              {pillar}
              {isWeakest ? <span title="The limiting factor"> !</span> : null}
            </span>

            <div
              title={scored ? `${score} / 100 - gap to target: ${Math.round((100 - score) * 10) / 10}` : t('common.noData')}
              style={{
                flex: 1,
                height: 8,
                background: 'var(--color-grey-soft)',
                borderRadius: 999,
                overflow: 'hidden',
                border: scored ? 'none' : '1px dashed var(--color-faint)',
              }}
            >
              {scored && (
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, score))}%`,
                    height: '100%',
                    background: color,
                    borderRadius: 999,
                  }}
                />
              )}
            </div>

            <span
              style={{
                width: scored ? 30 : 48,
                flexShrink: 0,
                textAlign: 'right',
                fontSize: scored ? 13 : 11,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color,
              }}
            >
              {scored ? score : t('common.noData')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
