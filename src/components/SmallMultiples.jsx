// Small multiples of the four Borneo territories' resilience hexagons, rendered
// side by side so users can compare the shapes at a glance — e.g. spot that
// Brunei's Food axis is collapsed relative to the others.
// Consumes the shared HexRadar (fixed 0-100 scale, weakest axis highlighted).
// Theme-aware via CSS vars (src/theme.css); no hardcoded text/bg hex.

import HexRadar from './HexRadar';

// Fixed display order — the four Borneo territories.
const ORDER = ['Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];

// Colour the index number by resilience band.
function bandColor(score) {
  if (score >= 70) return 'var(--color-green)';
  if (score >= 40) return 'var(--color-amber-dark)';
  return 'var(--color-red)';
}

export default function SmallMultiples({ territories }) {
  if (!territories) return null;

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
          marginBottom: 10,
        }}
      >
        All four territories · hexagon shapes side by side
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 14,
        }}
      >
        {ORDER.filter((name) => territories[name]).map((name) => {
          const t = territories[name];
          return (
            <div
              key={name}
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: 12,
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--color-ink)', fontSize: 14 }}>
                {name}
              </div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 22,
                  color: bandColor(t.index),
                  marginTop: 2,
                  marginBottom: 4,
                }}
              >
                {t.index}
              </div>
              <HexRadar
                pillars={t.pillarScores}
                max={100}
                weakest={t.weakestPillar}
                maxWidth={130}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
