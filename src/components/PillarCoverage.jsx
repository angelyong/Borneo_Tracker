import { useTranslation } from 'react-i18next';
import ProvenanceChip from './ProvenanceChip';

// Renders all six True-Wealth pillars for a territory with their 0-100 score and
// provenance. Unscored pillars are shown EXPLICITLY as gaps ("never imputed") — this
// is the honesty (E) surface: we show what we don't have rather than hiding it.
//
// Props: `territory` = one entry from resilience.json `territories[...]`
//   { pillarScores, detail: { [pillar]: [{indicator, score, confidence, source, year}] },
//     weakestPillar }

const PILLARS = ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'];

// Pillar-level RAG uses the same 70/40 bands as the headline index.
function ragColor(score) {
  if (score == null) return 'var(--color-faint)';
  if (score >= 70) return 'var(--color-green)';
  if (score >= 40) return 'var(--color-amber-dark)';
  return 'var(--color-red)';
}

export default function PillarCoverage({ territory }) {
  const { t } = useTranslation();
  if (!territory) return null;
  const { pillarScores = {}, detail = {}, weakestPillar } = territory;
  const scoredCount = Object.keys(pillarScores).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 6,
        }}
      >
        {t('dashboard.pillarProvenance', { count: scoredCount })}
      </div>

      {PILLARS.map((pillar) => {
        const score = pillarScores[pillar];
        const lead = (detail[pillar] || [])[0];
        const scored = score != null;
        const isWeakest = pillar === weakestPillar;

        return (
          <div
            key={pillar}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '7px 0',
              borderBottom: '1px solid var(--color-border)',
              opacity: scored ? 1 : 0.75,
            }}
          >
            <span
              style={{
                width: 104,
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-ink)',
              }}
            >
              {pillar}
              {isWeakest ? (
                <span title="Weakest pillar (the limiting factor)" style={{ color: 'var(--color-red)' }}>
                  {' '}⚠
                </span>
              ) : null}
            </span>

            {scored ? (
              <>
                <span
                  style={{
                    width: 38,
                    flexShrink: 0,
                    fontSize: 14,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: ragColor(score),
                  }}
                >
                  {score}
                </span>
                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-ink)' }}>{lead?.indicator}</span>
                  {lead ? (
                    <ProvenanceChip confidence={lead.confidence} source={lead.source} year={lead.year} />
                  ) : null}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--color-faint)', fontStyle: 'italic' }}>
                {t('dashboard.noComparableData')}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
