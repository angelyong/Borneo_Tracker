/**
 * Methodology — True Wealth Resilience Index
 *
 * A plain-language explanation of how the headline resilience numbers are
 * computed. Theme-aware: every colour references a CSS custom property from
 * src/theme.css, so the page reads correctly in both light and dark mode.
 */

const PILLARS = ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'];

const RAG = [
  {
    label: 'Resilient',
    range: 'Score ≥ 70',
    color: 'var(--color-green)',
    soft: 'var(--color-green-soft)',
    note: 'The territory can broadly sustain its people on this measure.',
  },
  {
    label: 'At Risk',
    range: 'Score 40 – 69',
    color: 'var(--color-amber-dark)',
    soft: 'var(--color-yellow-soft)',
    note: 'Adequate today, but exposed — a shock could tip it over.',
  },
  {
    label: 'Critical',
    range: 'Score < 40',
    color: 'var(--color-red)',
    soft: 'var(--color-red-soft)',
    note: 'A structural gap in survival capacity that needs attention now.',
  },
];

const CONFIDENCE = [
  { flag: 'High', color: 'var(--color-green)', note: 'State / province-level data measured for the territory itself.' },
  { flag: 'Medium', color: 'var(--color-amber-dark)', note: 'National figure applied to a territory as a proxy.' },
  { flag: 'Lower', color: 'var(--color-red)', note: 'Modelled estimates or manually compiled sources.' },
];

export default function MethodologyPage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <p style={styles.kicker}>METHODOLOGY</p>
          <h1 style={styles.title}>Methodology — True Wealth Resilience Index</h1>
          <p style={styles.lede}>
            How Borneo Tracker turns raw indicators into a single, honest read on whether a
            territory can actually sustain the people who live in it.
          </p>
        </header>

        <Section title="What it measures">
          <p style={styles.p}>
            The Resilience Index is <Em>not</Em> GDP, and it is not a measure of money. It asks a
            different question: can each Borneo territory sustain its own people? We answer that
            across six survival pillars — the <strong style={styles.strong}>True Wealth Hexagon</strong>:
          </p>
          <div style={styles.chips}>
            {PILLARS.map((name) => (
              <span key={name} style={styles.chip}>{name}</span>
            ))}
          </div>
          <p style={styles.p}>
            A place can post a rising GDP while its people grow less food-secure, less housed, or
            less healthy. GDP is explicitly rejected as the yardstick here. True Wealth is measured
            by lived capacity to endure, not by the value of what is bought and sold.
          </p>
        </Section>

        <Section title="Step 1 — Normalise each indicator (0–100)">
          <p style={styles.p}>
            Every indicator is rescaled onto a common 0–100 resilience score so that, say,
            electricity access (a percentage) and hospital beds (a rate) can live on the same axis:
          </p>
          <Formula>
            resilience_score = clamp( (value − floor) / (target − floor) × 100 , 0 , 100 )
          </Formula>
          <ul style={styles.list}>
            <li style={styles.li}>
              <strong style={styles.strong}>target</strong> — the point of full self-sufficiency or
              adequacy. For electricity access the target is 100%; for a health measure it is the
              level at which the population's need is met.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>floor</strong> — the level at which there is effectively
              no resilience on that measure.
            </li>
            <li style={styles.li}>
              <strong style={styles.strong}>"Lower is better" indicators</strong> — poverty,
              deforestation, and their kin are inverted before scoring, so that less poverty and
              less forest loss both push the score up.
            </li>
          </ul>
          <p style={styles.p}>
            The scale is deliberately <Em>target-based</Em>, not a ranking against neighbouring
            territories. A territory is measured against full self-sufficiency, not against how
            badly its neighbours are doing — the index expresses sovereignty and self-reliance, not
            relative standing.
          </p>
        </Section>

        <Section title="Step 2 — Pillar score">
          <p style={styles.p}>
            Each of the six pillars usually draws on several indicators. The
            <strong style={styles.strong}> pillar score</strong> is simply the mean of that pillar's
            scored indicators — one 0–100 number per pillar.
          </p>
        </Section>

        <Section title="Step 3 — Two headline numbers">
          <p style={styles.p}>
            From the six pillar scores we surface two figures that say different things:
          </p>
          <div style={styles.twoUp}>
            <div style={styles.metricCard}>
              <p style={styles.metricName}>Resilience Index</p>
              <p style={styles.metricType}>Arithmetic mean</p>
              <p style={styles.metricBody}>
                The plain average of the six <Em>equal-weight</Em> pillars. The hexagon is
                symmetric — no pillar outranks another — so a strong pillar can lift a weak one in
                this number.
              </p>
            </div>
            <div style={styles.metricCard}>
              <p style={styles.metricName}>Strict — True Resilience</p>
              <p style={styles.metricType}>Geometric mean</p>
              <p style={styles.metricBody}>
                The geometric mean collapses toward zero if <Em>any</Em> pillar is near zero. No
                food means no resilience, however good everything else is. A strong pillar cannot
                paper over a failing one here.
              </p>
            </div>
          </div>
          <p style={styles.p}>
            The <strong style={styles.strong}>gap between the two</strong> is the imbalance, or
            fragility penalty: a wide gap means the territory's strength is uneven and therefore
            brittle. Alongside both numbers we always surface the
            <strong style={styles.strong}> Weakest Pillar</strong> — the limiting factor that a
            single average would otherwise hide.
          </p>
        </Section>

        <Section title="Step 4 — Status (RAG)">
          <p style={styles.p}>
            Each score is given a red / amber / green status so the picture reads at a glance:
          </p>
          <div style={styles.legend}>
            {RAG.map((item) => (
              <div key={item.label} style={{ ...styles.legendRow, backgroundColor: item.soft }}>
                <span style={{ ...styles.dot, backgroundColor: item.color }} />
                <div style={styles.legendText}>
                  <span style={{ ...styles.legendLabel, color: item.color }}>
                    {item.label} <span style={styles.legendRange}>· {item.range}</span>
                  </span>
                  <span style={styles.legendNote}>{item.note}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Ethics — the E of ABCDE">
          <p style={styles.p}>
            A number is only as trustworthy as the data behind it, so every score carries a
            <strong style={styles.strong}> confidence flag</strong> drawn from the level of its
            source:
          </p>
          <div style={styles.confidence}>
            {CONFIDENCE.map((item) => (
              <div key={item.flag} style={styles.confRow}>
                <span style={{ ...styles.confBadge, color: item.color, borderColor: item.color }}>
                  {item.flag}
                </span>
                <span style={styles.confNote}>{item.note}</span>
              </div>
            ))}
          </div>
          <p style={styles.p}>
            Where data is missing, it is shown as a <Em>gap</Em> — never quietly imputed or filled
            with a guess. An honest gap is more useful than a confident fabrication. Honesty is the
            product.
          </p>
        </Section>

        <div style={styles.closing}>
          <p style={styles.closingText}>
            ESG and SDG are alternative reporting lenses on the same underlying data — useful ways
            to slice it for different audiences. The hero, though, is <strong style={styles.strong}>
            True Wealth</strong>: the question of whether a place can keep its people whole.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Small building blocks ─────────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}

function Formula({ children }) {
  return (
    <div style={styles.formulaWrap}>
      <code style={styles.formula}>{children}</code>
    </div>
  );
}

function Em({ children }) {
  return <em style={styles.em}>{children}</em>;
}

/* ── Styles (all colours via theme.css custom properties) ──────────────── */

const styles = {
  page: {
    width: '100%',
    minHeight: '100%',
    backgroundColor: 'var(--color-main-bg)',
    color: 'var(--color-ink)',
    fontFamily: 'Inter, Arial, sans-serif',
  },
  container: {
    maxWidth: 820,
    margin: '0 auto',
    padding: '48px 24px 88px',
  },

  header: {
    marginBottom: 40,
  },
  kicker: {
    margin: '0 0 10px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'var(--color-muted)',
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.25,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: 'var(--color-ink)',
  },
  lede: {
    margin: '16px 0 0',
    maxWidth: '62ch',
    fontSize: 17,
    lineHeight: 1.6,
    color: 'var(--color-muted)',
  },

  section: {
    marginTop: 40,
    paddingTop: 28,
    borderTop: '1px solid var(--color-border)',
  },
  h2: {
    margin: '0 0 14px',
    fontSize: 21,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: 'var(--color-ink)',
  },
  p: {
    margin: '0 0 14px',
    maxWidth: '65ch',
    fontSize: 15.5,
    lineHeight: 1.75,
    color: 'var(--color-ink)',
  },
  strong: {
    fontWeight: 700,
    color: 'var(--color-ink)',
  },
  em: {
    fontStyle: 'italic',
    color: 'var(--color-ink)',
  },

  list: {
    margin: '0 0 14px',
    padding: '0 0 0 20px',
    maxWidth: '65ch',
    listStyle: 'disc',
  },
  li: {
    margin: '0 0 10px',
    fontSize: 15.5,
    lineHeight: 1.7,
    color: 'var(--color-ink)',
  },

  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    margin: '4px 0 18px',
  },
  chip: {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: 999,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-green-soft)',
    color: 'var(--color-ink)',
    fontSize: 13.5,
    fontWeight: 600,
  },

  formulaWrap: {
    margin: '4px 0 18px',
    padding: '16px 18px',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
    overflowX: 'auto',
  },
  formula: {
    display: 'block',
    fontFamily: 'ui-monospace, "SFMono-Regular", "Menlo", "Consolas", monospace',
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--color-ink)',
    whiteSpace: 'pre',
  },

  twoUp: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 14,
    margin: '4px 0 18px',
  },
  metricCard: {
    padding: '18px 18px 16px',
    borderRadius: 12,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
  },
  metricName: {
    margin: '0 0 2px',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-ink)',
  },
  metricType: {
    margin: '0 0 10px',
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--color-faint)',
  },
  metricBody: {
    margin: 0,
    fontSize: 14.5,
    lineHeight: 1.65,
    color: 'var(--color-muted)',
  },

  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    margin: '4px 0 6px',
  },
  legendRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
  },
  dot: {
    flexShrink: 0,
    width: 14,
    height: 14,
    marginTop: 3,
    borderRadius: '50%',
  },
  legendText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  legendLabel: {
    fontSize: 15,
    fontWeight: 700,
  },
  legendRange: {
    fontWeight: 600,
    color: 'var(--color-muted)',
  },
  legendNote: {
    fontSize: 13.5,
    lineHeight: 1.5,
    color: 'var(--color-ink)',
  },

  confidence: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    margin: '4px 0 16px',
  },
  confRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
  },
  confBadge: {
    flexShrink: 0,
    minWidth: 68,
    textAlign: 'center',
    padding: '3px 10px',
    borderRadius: 999,
    border: '1.5px solid',
    fontSize: 12.5,
    fontWeight: 700,
  },
  confNote: {
    fontSize: 15,
    lineHeight: 1.6,
    color: 'var(--color-ink)',
  },

  closing: {
    marginTop: 40,
    padding: '20px 22px',
    borderRadius: 12,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-green-soft)',
  },
  closingText: {
    margin: 0,
    maxWidth: '66ch',
    fontSize: 15.5,
    lineHeight: 1.7,
    color: 'var(--color-ink)',
  },
};
