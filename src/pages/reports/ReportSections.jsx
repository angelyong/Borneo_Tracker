// ReportSections.jsx
// Presentational sections for the ESG & SDG Data Profile report. These render
// as a fixed "paper" document (always light) so the on-screen preview and the
// exported PDF look identical regardless of the app theme. Each exported
// section is snapshotted to its own PDF page by utils/pdfReport.js.

import { FONT } from '../../theme';
import { sdgShort } from './reportContent';

// Fixed document palette — a restrained "official data profile" look, not the
// app's themed chrome. Kept in sync with docs/design/report-redesign-mockup.html.
const C = {
  sheet: '#FFFFFF',
  ink: '#1C1E1A',
  soft: '#52564E',
  faint: '#8B8F86',
  line: '#E7E7DF',
  lineStrong: '#D2D3C9',
  accent: '#23514B',
  high: '#2F7A4E',
  med: '#937019',
  man: '#7A6B57',
};
const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', Consolas, monospace";

const eyebrow = {
  fontFamily: MONO, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em',
  textTransform: 'uppercase', color: C.accent, margin: 0,
};
const block = { background: C.sheet, padding: '30px 40px', fontFamily: FONT, color: C.ink, borderTop: `1px solid ${C.line}` };
const h2 = { fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em', margin: '8px 0 2px' };
const desc = { fontSize: 13, color: C.soft, margin: '6px 0 0', maxWidth: '66ch', lineHeight: 1.55 };
const sep = { color: C.lineStrong };
const unitStyle = { fontStyle: 'normal', fontWeight: 600, color: C.faint, fontSize: 12, marginLeft: 3 };

function Conf({ c }) {
  const color = c === 'high' ? C.high : c === 'medium' ? C.med : C.man;
  const label = c === 'high' ? 'High' : c === 'medium' ? 'Medium' : 'Manual';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

// Bold the lead clause before an em-dash, like the mockup's coverage bullets.
function LeadEmphasis({ text }) {
  const i = text.indexOf(' — ');
  if (i === -1) return <span>{text}</span>;
  return (
    <span>
      <b>{text.slice(0, i)}</b>
      {text.slice(i)}
    </span>
  );
}

// ---- Masthead / cover ------------------------------------------------------
export function ReportMasthead({ territory, allTerritories, glance, generatedShort }) {
  const cells = [...glance, { k: 'Generated', v: generatedShort }];
  return (
    <div style={{ background: C.sheet, fontFamily: FONT, color: C.ink, borderTop: `3px solid ${C.accent}` }}>
      <div style={{ padding: '34px 40px 26px' }}>
        <p style={eyebrow}>Borneo Tracker · {allTerritories ? 'All Borneo' : territory}</p>
        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.015em', margin: '12px 0 0', lineHeight: 1.08 }}>
          ESG &amp; SDG Data Profile
        </h1>
        <p style={{ fontSize: 14.5, color: C.soft, margin: '12px 0 0', maxWidth: '64ch', lineHeight: 1.6 }}>
          Every environmental, social and governance indicator we track
          {allTerritories ? ' across Borneo' : ` for ${territory}`} — compiled from official sources and explained in
          plain language, so you can read the whole picture in one place instead of gathering each figure yourself.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 22, border: `1px solid ${C.line}` }}>
          {cells.map((g, i) => (
            <div
              key={g.k}
              style={{ flex: '1 1 auto', padding: '12px 18px', borderRight: i < cells.length - 1 ? `1px solid ${C.line}` : 'none' }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint }}>
                {g.k}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{g.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Executive summary -----------------------------------------------------
export function ExecutiveSummarySection({ summaryText, takeaways }) {
  return (
    <div style={block}>
      <p style={eyebrow}>Overview</p>
      <h2 style={h2}>Executive Summary</h2>
      <p style={{ fontSize: 15, lineHeight: 1.72, margin: '16px 0 0', maxWidth: '68ch' }}>{summaryText}</p>
      <div style={{ marginTop: 22, borderTop: `1px solid ${C.line}`, display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 40 }}>
        {takeaways.map((t, i) => (
          <div key={i} style={{ position: 'relative', padding: '13px 0 13px 20px', borderBottom: `1px solid ${C.line}`, fontSize: 13.5, lineHeight: 1.55 }}>
            <span style={{ position: 'absolute', left: 0, top: 19, width: 8, height: 8, background: C.accent, borderRadius: 1 }} />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- ESG indicators --------------------------------------------------------
function IndicatorValue({ reading }) {
  if (reading.value == null) return <span style={{ fontWeight: 800, color: C.faint }}>No data</span>;
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', textAlign: 'right' }}>
      {reading.value}
      {reading.unit && <em style={unitStyle}>{reading.unit}</em>}
    </span>
  );
}

function Indicator({ it, multiTerritory }) {
  const single = it.readings.length === 1;
  const r0 = it.readings[0];
  return (
    <div style={{ padding: '13px 0', borderBottom: `1px solid ${C.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700 }}>{it.name}</span>
        {single && <IndicatorValue reading={r0} />}
      </div>

      {single ? (
        <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {multiTerritory && (
            <>
              <span style={{ fontWeight: 700, color: C.soft }}>{r0.territory}</span>
              <span style={sep}>·</span>
            </>
          )}
          <span>{r0.year}</span>
          <span style={sep}>·</span>
          <span>{r0.sourceFamily}</span>
          <span style={sep}>·</span>
          <span>{sdgShort(it.sdg)}</span>
          <span style={sep}>·</span>
          <Conf c={r0.confidence} />
        </div>
      ) : (
        <div style={{ marginTop: 7, display: 'grid', gap: 5 }}>
          {it.readings.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', fontSize: 12.5 }}>
              <span style={{ fontWeight: 700, minWidth: 84 }}>{r.territory}</span>
              <span style={{ textAlign: 'right' }}>
                {r.value == null ? (
                  <span style={{ color: C.faint }}>No data</span>
                ) : (
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {r.value}
                    {r.unit && <em style={unitStyle}>{r.unit}</em>}
                  </span>
                )}
                <span style={{ color: C.faint, marginLeft: 6 }}>({r.year})</span>
                <span style={{ marginLeft: 8 }}><Conf c={r.confidence} /></span>
              </span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 13, color: C.soft, margin: '8px 0 0', lineHeight: 1.55, maxWidth: '74ch' }}>{it.explanation}</p>
    </div>
  );
}

export function EsgIndicatorSection({ pillars, multiTerritory }) {
  return (
    <div style={block}>
      <p style={eyebrow}>The data</p>
      <h2 style={h2}>ESG Indicators</h2>
      <p style={desc}>
        All tracked indicators, grouped Environment · Social · Governance. Each shows its value, source and
        confidence, with a one-line explanation of what it means.
      </p>

      {pillars.map((p) => {
        const twoCol = p.indicators.length > 1 && !multiTerritory;
        return (
          <div key={p.key} style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 8, borderBottom: `2px solid ${C.ink}` }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{p.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.faint }}>
                {p.indicators.length} indicator{p.indicators.length === 1 ? '' : 's'}
              </span>
            </div>
            <div style={twoCol ? { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 40 } : { display: 'block', maxWidth: multiTerritory ? '100%' : '52ch' }}>
              {p.indicators.map((it, i) => (
                <Indicator key={i} it={it} multiTerritory={multiTerritory} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- SDG coverage ----------------------------------------------------------
export function SdgCoverageSection({ sdg }) {
  const th = {
    padding: '9px 12px 9px 0', borderBottom: `2px solid ${C.ink}`, fontFamily: MONO, fontSize: 10.5,
    fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.ink, whiteSpace: 'nowrap',
  };
  const td = { padding: '10px 12px 10px 0', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
  return (
    <div style={block}>
      <p style={eyebrow}>The other lens</p>
      <h2 style={h2}>SDG Coverage</h2>
      <p style={desc}>The same indicators mapped to the UN Sustainable Development Goals they inform — for readers working from SDGs, not ESG pillars.</p>
      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 520 }}>
          <thead>
            <tr>
              <th style={th}>Goal</th>
              <th style={{ ...th, textAlign: 'right' }}>Indicators</th>
              <th style={{ ...th, textAlign: 'right' }}>Latest</th>
              <th style={th}>Lead indicator</th>
            </tr>
          </thead>
          <tbody>
            {sdg.map((s) => (
              <tr key={s.goal}>
                <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {sdgShort(s.goal)}{s.label ? ` · ${s.label}` : ''}
                </td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.count}</td>
                <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.latestYear || '—'}</td>
                <td style={{ ...td, color: C.soft }}>{s.lead}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Coverage & limitations ------------------------------------------------
export function CoverageLimitationsSection({ coverage }) {
  const covH = {
    margin: '0 0 10px', fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: C.soft, paddingBottom: 7, borderBottom: `1px solid ${C.line}`,
  };
  const covUl = { listStyle: 'none', margin: 0, padding: 0 };
  const covLi = { position: 'relative', paddingLeft: 16, fontSize: 13, lineHeight: 1.55, marginBottom: 12, color: C.ink };
  const dash = { position: 'absolute', left: 0, color: C.faint };
  const tagStyle = (label) => {
    const color = label === 'Manual' ? C.man : label === 'Medium' ? C.med : C.high;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color, marginRight: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
        {label}
      </span>
    );
  };
  return (
    <div style={block}>
      <p style={eyebrow}>Honesty</p>
      <h2 style={h2}>Coverage &amp; Limitations</h2>
      <p style={desc}>Exactly what this profile does not cover, and which figures to treat with care — so a gap is never mistaken for a zero.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginTop: 16 }}>
        <div>
          <h4 style={covH}>Gaps in coverage</h4>
          <ul style={covUl}>
            {coverage.gaps.map((g, i) => (
              <li key={i} style={covLi}>
                <span style={dash}>—</span>
                <LeadEmphasis text={g} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 style={covH}>Measured but flagged</h4>
          <ul style={covUl}>
            {coverage.flagged.map((f, i) => (
              <li key={i} style={covLi}>
                <span style={dash}>—</span>
                {f.tag && tagStyle(f.tag)}
                {f.tag ? f.text : <LeadEmphasis text={f.text} />}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---- Methodology -----------------------------------------------------------
export function MethodologySection({ sources }) {
  const dt = { fontWeight: 800, color: C.ink, marginTop: 13 };
  const dd = { margin: '3px 0 0' };
  return (
    <div style={block}>
      <p style={eyebrow}>Provenance</p>
      <h2 style={h2}>Methodology &amp; Sources</h2>
      <dl style={{ fontSize: 13, color: C.soft, lineHeight: 1.7, marginTop: 16 }}>
        <dt style={dt}>Confidence ratings</dt>
        <dd style={{ ...dd, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <span><Conf c="high" /> officially measured / live feed</span>
          <span><Conf c="medium" /> modelled or national figure</span>
          <span><Conf c="manual" /> hand-entered from a cited report</span>
        </dd>
        <dt style={dt}>Sources in this profile</dt>
        <dd style={dd}>{sources.join(' · ')}</dd>
        <dt style={dt}>Note on figures</dt>
        <dd style={dd}>Values are shown as reported by each source, at the level indicated (state, national or satellite). No values are estimated or imputed to fill gaps.</dd>
      </dl>
    </div>
  );
}
