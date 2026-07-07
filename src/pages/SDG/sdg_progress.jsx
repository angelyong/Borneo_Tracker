// SDG Progress — Figma redesign: legend chips + two-column goal cards with official
// SDG badge colors, progress bars and expandable sub-indicators (real rows from
// indicators.json; the headline % is a derived demo score until per-goal scoring
// lands in the pipeline).
import { useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { COLORS, RADII } from '../../theme';
import { Badge, Card, Select } from '../../components/ui';
import {
  SDG_GOALS,
  TERRITORIES,
  formatValue,
  getRowsForSdg,
  useIndicators,
} from '../../data/useIndicators';

// Official UN SDG goal colors
const SDG_COLORS = {
  SDG1: '#E5243B',
  SDG2: '#DDA63A',
  SDG3: '#4C9F38',
  SDG4: '#C5192D',
  SDG6: '#26BDE2',
  SDG7: '#FCC30B',
  SDG8: '#A21942',
  SDG11: '#FD9D24',
  SDG13: '#3F7E44',
  SDG15: '#56C02B',
  SDG16: '#00689D',
};

const LEGEND = ['On Track', 'Needs Attention', 'Critical', 'No Data'];

// Deterministic demo score per (region, goal) — stable across reloads
function demoScore(region, goal) {
  let h = 0;
  for (const ch of region + goal) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return 28 + (h % 58); // 28..85
}

function statusFor(score, hasData) {
  if (!hasData) return 'No Data';
  if (score >= 67) return 'On Track';
  if (score >= 42) return 'Needs Attention';
  return 'Critical';
}

function GoalCard({ goal, label, region, rows }) {
  const [open, setOpen] = useState(false);
  const color = SDG_COLORS[goal] || COLORS.forest;
  const hasData = rows.length > 0;
  const score = demoScore(region, goal);
  const status = statusFor(score, hasData);
  const trendUp = score % 2 === 0;

  return (
    <Card style={{ padding: '18px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 10,
            background: color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: 13.5,
            flexShrink: 0,
          }}
        >
          {goal}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16.5, fontWeight: 800 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
            <Badge status={status} />
            {hasData && (
              <span
                style={{
                  color: status === 'Critical' ? COLORS.red : COLORS.green,
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {trendUp ? '↑' : '→'}
              </span>
            )}
          </div>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color }}>{hasData ? `${score}%` : '—'}</div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 7,
          borderRadius: 4,
          background: '#E5E7EB',
          margin: '16px 0 10px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: hasData ? `${score}%` : 0,
            height: '100%',
            borderRadius: 4,
            background: color,
          }}
        />
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={!hasData}
          style={{
            border: 'none',
            background: 'none',
            color: hasData ? '#1F7A33' : COLORS.faint,
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          {open ? 'Hide sub-indicators ▲' : 'Show sub-indicators ▼'}
        </button>
      </div>

      {open && hasData && (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 10, paddingTop: 6 }}>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '9px 2px',
                fontSize: 14,
              }}
            >
              <span style={{ color: COLORS.muted }}>{r.indicator}</span>
              <b>{formatValue(r)}</b>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function SDGProgress() {
  const [region, setRegion] = useState('Sarawak');
  const { data, loading, error } = useIndicators();

  const goals = useMemo(() => {
    if (!data?.rows) return [];
    return SDG_GOALS.map(({ goal, label }) => ({
      goal,
      label,
      rows: getRowsForSdg(data.rows, region, goal),
    }));
  }, [data, region]);

  return (
    <Layout>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 20px 50px' }}>
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, margin: '4px 0 18px' }}>
          SDG Progress
        </h1>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Select options={[...TERRITORIES]} value={region} onChange={setRegion} style={{ width: 200 }} />
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            background: '#EDF2EA',
            borderRadius: RADII.md,
            padding: '10px 14px',
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          {LEGEND.map((l) => (
            <Badge key={l} status={l} />
          ))}
        </div>

        {loading && <Card>Loading indicator data…</Card>}
        {error && <Card style={{ color: COLORS.red }}>{error}</Card>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {goals.map((g) => (
            <GoalCard key={g.goal} {...g} region={region} />
          ))}
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: COLORS.faint, textAlign: 'center' }}>
          Sub-indicator values come from published sources (see Data Sources). Headline goal scores
          are illustrative until per-goal scoring is finalised.
        </div>
      </div>
    </Layout>
  );
}
