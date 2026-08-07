// Shared RAG (red/amber/green) semicircle gauge — plots a 0-100 score against
// green/amber thresholds with a needle. Mirrors the original inline gauge in
// OverviewDashboard; extracted so the Impact Simulator can reuse it without
// forking (see docs/IMPACT_SIMULATOR_SPEC.md §3).

const RAG_COLORS = { green: '#16a34a', amber: '#f59e0b', red: '#dc2626' };

export default function RagGauge({ score, thresholds, maxWidth = 220 }) {
  const cx = 110;
  const cy = 110;
  const r = 80;
  const strokeW = 38;
  const circumference = Math.PI * r;

  const zones = [
    { from: 0, to: thresholds.amber, color: RAG_COLORS.red },
    { from: thresholds.amber, to: thresholds.green, color: RAG_COLORS.amber },
    { from: thresholds.green, to: 100, color: RAG_COLORS.green },
  ];

  const clamped = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
  const theta = Math.PI * (1 - clamped / 100);
  const needleR = r + strokeW / 2;
  const nx = cx + needleR * Math.cos(theta);
  const ny = cy - needleR * Math.sin(theta);

  return (
    <svg viewBox="0 0 220 120" style={{ width: '100%', maxWidth, display: 'block', margin: '0 auto' }}>
      {zones.map((zone) => {
        const dashLen = ((zone.to - zone.from) / 100) * circumference;
        const startOffset = (zone.from / 100) * circumference;

        return (
          <path
            key={zone.color}
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={zone.color}
            strokeWidth={strokeW}
            strokeLinecap="butt"
            strokeDasharray={`${dashLen} ${circumference}`}
            strokeDashoffset={-startOffset}
            opacity={0.85}
          />
        );
      })}

      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="var(--color-ink)" />
    </svg>
  );
}
