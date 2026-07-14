import { FONT, RADII } from '../../theme';
import { formatValue } from '../../data/useIndicators';

// Fixed canonical order — every pillar is always shown, scored or not, so a
// missing score reads as an honest gap rather than being silently dropped.
const HEXAGON_PILLARS = ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'];

// This report is a fixed white "printed page" — on-screen preview and the
// exported PDF/PNG must look identical and stay legible regardless of the
// app's light/dark toggle, so its palette is intentionally literal rather
// than pointing at the theme-reactive COLORS/CSS vars used elsewhere.
const PRINT = {
  ink: '#1f2937',
  muted: '#6b7280',
  faint: '#9ca3af',
  border: '#e5e7eb',
  pageBg: '#f5f5f2',
  greySoft: '#e5e7eb',
  forest: '#1b4532',
  amberDark: '#e3a32c',
  green: '#16a34a',
  greenSoft: '#d9f2e2',
  yellowSoft: '#fbf3ce',
  red: '#dc2626',
  redSoft: '#fbdddd',
  blue: '#2b7de9',
  blueSoft: '#dbeafe',
};

const CONFIDENCE_STYLES = {
  high: { bg: PRINT.greenSoft, fg: PRINT.green, label: 'High' },
  medium: { bg: PRINT.blueSoft, fg: PRINT.blue, label: 'Medium' },
  manual: { bg: PRINT.yellowSoft, fg: '#B7860B', label: 'Manual' },
};

function ConfidenceBadge({ confidence }) {
  const style = CONFIDENCE_STYLES[confidence] || { bg: PRINT.greySoft, fg: PRINT.muted, label: confidence || 'Unknown' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: RADII.pill,
        background: style.bg,
        color: style.fg,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {style.label}
    </span>
  );
}

const sectionStyle = { background: '#fff', padding: '28px 32px', fontFamily: FONT };
const headingStyle = { fontSize: 18, fontWeight: 800, color: PRINT.ink, margin: '0 0 4px' };
const subheadingStyle = { fontSize: 12.5, color: PRINT.muted, margin: '0 0 20px' };

export function ReportCoverSection({ territory, fromYear, toYear, generatedAt }) {
  return (
    <div style={{ ...sectionStyle, textAlign: 'center', padding: '80px 32px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: PRINT.amberDark, textTransform: 'uppercase' }}>
        Borneo Tracker
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: PRINT.ink, margin: '14px 0 6px' }}>
        True Wealth &amp; ESG Report
      </h1>
      <div style={{ fontSize: 20, fontWeight: 700, color: PRINT.forest, margin: '4px 0' }}>{territory}</div>
      <div style={{ fontSize: 14, color: PRINT.muted, marginTop: 6 }}>
        Reporting period: {fromYear}&ndash;{toYear}
      </div>
      <div style={{ fontSize: 12.5, color: PRINT.faint, marginTop: 24 }}>Generated {generatedAt}</div>
    </div>
  );
}

export function ResilienceSection({ resilienceView }) {
  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>1. Resilience Index &amp; RAG Status</h2>
      <p style={subheadingStyle}>The overall True Wealth health score for this territory, on a 0&ndash;100 scale.</p>

      {resilienceView ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            padding: '20px 24px',
            borderRadius: RADII.lg,
            border: `1px solid ${PRINT.border}`,
            background: RAG_BG[resilienceView.rag],
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 900, color: RAG_FG[resilienceView.rag] }}>
            {resilienceView.index}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: RAG_FG[resilienceView.rag], textTransform: 'uppercase' }}>
              {RAG_LABEL[resilienceView.rag]}
            </div>
            <div style={{ fontSize: 13, color: PRINT.ink, marginTop: 4 }}>
              Weakest pillar: <strong>{resilienceView.weakestPillar}</strong>
            </div>
            <div style={{ fontSize: 12.5, color: PRINT.muted, marginTop: 2 }}>
              {resilienceView.scoredPillars.length} of 6 True Wealth pillars scored
            </div>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13.5, color: PRINT.muted }}>No resilience score is available for this territory.</p>
      )}
    </div>
  );
}

const RAG_BG = { green: PRINT.greenSoft, amber: PRINT.yellowSoft, red: PRINT.redSoft };
const RAG_FG = { green: PRINT.green, amber: '#B7860B', red: PRINT.red };
const RAG_LABEL = { green: 'Good', amber: 'Moderate', red: 'Poor' };

export function HexagonSection({ pillarScores, unscoredPillars }) {
  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>2. True Wealth Hexagon Pillar Breakdown</h2>
      <p style={subheadingStyle}>
        A single index can hide problems in one pillar. Pillars without enough source data are shown as gaps,
        never estimated.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {HEXAGON_PILLARS.map((pillar) => {
          const score = pillarScores[pillar];
          const isScored = Number.isFinite(score);
          return (
            <div key={pillar} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 100, fontSize: 13, fontWeight: 700, color: PRINT.ink, flexShrink: 0 }}>{pillar}</div>
              <div style={{ flex: 1, height: 16, borderRadius: 8, background: PRINT.greySoft, overflow: 'hidden' }}>
                {isScored && (
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, score))}%`,
                      height: '100%',
                      background: PRINT.forest,
                      borderRadius: 8,
                    }}
                  />
                )}
              </div>
              <div style={{ width: 96, textAlign: 'right', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {isScored ? (
                  <span style={{ color: PRINT.ink }}>{score.toFixed(1)}/100</span>
                ) : (
                  <span style={{ color: PRINT.faint, fontWeight: 600 }}>Not yet scored</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {unscoredPillars.length > 0 && (
        <p style={{ fontSize: 12, color: PRINT.faint, marginTop: 16 }}>
          {unscoredPillars.join(', ')} {unscoredPillars.length === 1 ? 'has' : 'have'} no scored indicators for this
          territory yet &mdash; excluded from the index rather than estimated.
        </p>
      )}
    </div>
  );
}

export function IndicatorTableSection({ rows }) {
  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>3. Canonical Indicator Table</h2>
      <p style={subheadingStyle}>
        Every data point behind the scores above, with its source and confidence &mdash; the citable record.
      </p>

      {rows.length ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {['Indicator', 'Value', 'Year', 'Source', 'Confidence'].map((label) => (
                <th
                  key={label}
                  style={{
                    textAlign: label === 'Value' || label === 'Confidence' ? 'right' : 'left',
                    padding: '8px 10px',
                    borderBottom: `2px solid ${PRINT.ink}`,
                    fontWeight: 800,
                    color: PRINT.ink,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.territory}-${row.indicator}`}>
                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${PRINT.border}`, color: PRINT.ink }}>
                  {row.indicator}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${PRINT.border}`, textAlign: 'right', fontWeight: 600 }}>
                  {formatValue(row)}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${PRINT.border}`, color: PRINT.muted }}>
                  {row.year}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${PRINT.border}`, color: PRINT.muted }}>
                  {row.source}
                </td>
                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${PRINT.border}`, textAlign: 'right' }}>
                  <ConfidenceBadge confidence={row.confidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ fontSize: 13.5, color: PRINT.muted }}>No canonical indicators fall within the selected date range.</p>
      )}
    </div>
  );
}

export function SdgSummarySection({ goalSummaries }) {
  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>4. SDG Progress Summary</h2>
      <p style={subheadingStyle}>Canonical indicator coverage against each tracked UN Sustainable Development Goal.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
        {goalSummaries.map(({ goal, label, count, latestYear }) => (
          <div
            key={goal}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '9px 12px',
              borderRadius: RADII.sm,
              background: count ? PRINT.pageBg : 'transparent',
              border: `1px solid ${count ? PRINT.border : 'transparent'}`,
            }}
          >
            <span style={{ fontSize: 12.5, color: PRINT.ink }}>
              <strong>{goal}</strong> &middot; {label}
            </span>
            <span style={{ fontSize: 12.5, color: count ? PRINT.ink : PRINT.faint, fontWeight: 700 }}>
              {count ? `${count} indicator${count === 1 ? '' : 's'} · ${latestYear}` : 'No data'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommunitySection({ posts }) {
  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>5. Community Reports</h2>
      <p style={subheadingStyle}>
        Unverified community discussion for context, not measured data &mdash; kept clearly separate from the
        indicator table above.
      </p>

      {posts.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.map((post) => (
            <div key={post.id} style={{ padding: '10px 14px', borderRadius: RADII.sm, border: `1px solid ${PRINT.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: PRINT.ink }}>{post.title}</div>
              <div style={{ fontSize: 11.5, color: PRINT.muted, marginTop: 2 }}>
                {post.author} &middot; {new Date(post.createdAt).toLocaleDateString()} &middot; {post.topic} &middot;{' '}
                {post.likeCount} likes &middot; {post.commentCount} comments
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13.5, color: PRINT.muted }}>No community discussion recorded for this territory yet.</p>
      )}
    </div>
  );
}

export function MethodologySection({ generatedAt, sources, method }) {
  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>Methodology &amp; Provenance</h2>
      <p style={subheadingStyle}>
        What makes this report citable &mdash; where every number came from and how much to trust it.
      </p>

      <dl style={{ fontSize: 12.5, color: PRINT.ink, lineHeight: 1.7 }}>
        <dt style={{ fontWeight: 800, marginTop: 12 }}>Report generated</dt>
        <dd style={{ margin: '2px 0 0' }}>{generatedAt}</dd>

        <dt style={{ fontWeight: 800, marginTop: 12 }}>Data sources included in this report</dt>
        <dd style={{ margin: '2px 0 0' }}>{sources.length ? sources.join(', ') : 'None (no indicators in range).'}</dd>

        <dt style={{ fontWeight: 800, marginTop: 12 }}>Confidence ratings</dt>
        <dd style={{ margin: '2px 0 0' }}>
          <strong>High</strong> &mdash; directly measured by an official statistics office or live sensor feed.{' '}
          <strong>Medium</strong> &mdash; modelled/harmonised by an academic or international body, or a national
          figure applied to a sub-national territory. <strong>Manual</strong> &mdash; hand-entered from a cited
          government or press report, not yet pulled by an automated feed.
        </dd>

        <dt style={{ fontWeight: 800, marginTop: 12 }}>Resilience Index methodology</dt>
        <dd style={{ margin: '2px 0 0' }}>{method}</dd>
      </dl>
    </div>
  );
}
