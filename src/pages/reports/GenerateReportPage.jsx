import { useMemo, useRef, useState } from 'react';
import { TERRITORIES, useIndicators } from '../../data/useIndicators';
import { buildProfile } from './reportContent';
import { generatePdfFromSections } from '../../utils/pdfReport';
import { Button } from '../../components/ui';
import { COLORS, FONT, RADII, SHADOWS } from '../../theme';
import {
  ReportMasthead,
  ExecutiveSummarySection,
  EsgIndicatorSection,
  SdgCoverageSection,
  CoverageLimitationsSection,
  MethodologySection,
} from './ReportSections';

const ALL_BORNEO = 'All Borneo';
const TERRITORY_OPTIONS = [...TERRITORIES, ALL_BORNEO];

const DEFAULT_SECTIONS = {
  summary: true,
  sdg: true,
  coverage: true,
  methodology: true,
};

const SECTION_TOGGLES = [
  { key: 'summary', label: 'Executive Summary' },
  { key: 'sdg', label: 'SDG Coverage' },
  { key: 'coverage', label: 'Coverage & Limitations' },
  { key: 'methodology', label: 'Methodology & Sources' },
];

const GenerateReportPage = () => {
  const { data, loading, error } = useIndicators();

  const [territory, setTerritory] = useState(TERRITORIES[0]);
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [generating, setGenerating] = useState(false);

  const mastheadRef = useRef(null);
  const summaryRef = useRef(null);
  const esgRef = useRef(null);
  const sdgRef = useRef(null);
  const coverageRef = useRef(null);
  const methodologyRef = useRef(null);

  const allTerritories = territory === ALL_BORNEO;

  const rows = useMemo(() => {
    const all = data?.rows || [];
    return allTerritories ? all : all.filter((row) => row.territory === territory);
  }, [data, territory, allTerritories]);

  const profile = useMemo(
    () => buildProfile(rows, { territory, allTerritories }),
    [rows, territory, allTerritories]
  );

  // Generated on first render; a report is a point-in-time snapshot.
  const generatedShort = useMemo(
    () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    []
  );

  const toggleSection = (key) => setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const orderedSections = [
        mastheadRef.current,
        sections.summary ? summaryRef.current : null,
        esgRef.current,
        sections.sdg ? sdgRef.current : null,
        sections.coverage ? coverageRef.current : null,
        sections.methodology ? methodologyRef.current : null,
      ];
      const filename = `esg-sdg-profile-${territory}`.toLowerCase().replace(/\s+/g, '-');
      await generatePdfFromSections(orderedSections, `${filename}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Generate Report</h1>
        <p style={styles.subtitle}>
          A citable ESG &amp; SDG data profile for one territory &mdash; every indicator we&rsquo;ve gathered,
          explained in plain language and downloadable as a PDF. Built for compliance buyers, suppliers and
          investors, not just internal dashboards.
        </p>
      </header>

      <div style={styles.controlsCard}>
        <div style={styles.controlsRow}>
          <label style={styles.controlLabel}>
            1. Select Territory
            <select value={territory} onChange={(e) => setTerritory(e.target.value)} style={styles.select}>
              {TERRITORY_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div style={styles.controlLabel}>
            2. Include Sections
            <div style={styles.checkboxGrid}>
              {SECTION_TOGGLES.map(({ key, label }) => (
                <label key={key} style={styles.checkboxRow}>
                  <input type="checkbox" checked={sections[key]} onChange={() => toggleSection(key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={styles.generateRow}>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={generating || loading || !!error || !profile.pillars.length}
            style={{ minWidth: 220 }}
          >
            {generating ? 'Generating PDF…' : 'Generate & Download PDF'}
          </Button>
        </div>
      </div>

      {loading && <div style={styles.stateCard}>Loading real indicator data…</div>}
      {error && <div style={{ ...styles.stateCard, color: COLORS.red }}>{error}</div>}
      {!loading && !error && !profile.pillars.length && (
        <div style={styles.stateCard}>No indicators are available for this selection.</div>
      )}

      {!loading && !error && profile.pillars.length > 0 && (
        <div style={styles.previewWrap}>
          <div ref={mastheadRef}>
            <ReportMasthead
              territory={territory}
              allTerritories={allTerritories}
              glance={profile.glance}
              generatedShort={generatedShort}
            />
          </div>

          {sections.summary && (
            <div ref={summaryRef}>
              <ExecutiveSummarySection summaryText={profile.summaryText} takeaways={profile.takeaways} />
            </div>
          )}

          <div ref={esgRef}>
            <EsgIndicatorSection pillars={profile.pillars} multiTerritory={profile.multiTerritory} />
          </div>

          {sections.sdg && (
            <div ref={sdgRef}>
              <SdgCoverageSection sdg={profile.sdg} />
            </div>
          )}

          {sections.coverage && (
            <div ref={coverageRef}>
              <CoverageLimitationsSection coverage={profile.coverage} />
            </div>
          )}

          {sections.methodology && (
            <div ref={methodologyRef}>
              <MethodologySection sources={profile.sources} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  page: { padding: 28, maxWidth: 900, margin: '0 auto', fontFamily: FONT },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 800, color: COLORS.ink, margin: 0 },
  subtitle: { fontSize: 14, color: COLORS.muted, margin: '6px 0 0', maxWidth: 640, lineHeight: 1.5 },

  controlsCard: {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADII.lg,
    padding: 24,
    marginBottom: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  controlsRow: { display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' },
  controlLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.ink,
  },
  select: {
    padding: '9px 14px',
    borderRadius: RADII.md,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
    fontWeight: 500,
    color: COLORS.ink,
    background: COLORS.card,
    minWidth: 180,
  },
  rangeRow: { display: 'flex', alignItems: 'center', gap: 8 },
  yearInput: {
    width: 90,
    padding: '9px 12px',
    borderRadius: RADII.md,
    border: `1px solid ${COLORS.border}`,
    fontSize: 14,
    color: COLORS.ink,
    background: COLORS.card,
  },
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px 24px',
    fontWeight: 500,
  },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: COLORS.ink, cursor: 'pointer' },
  generateRow: { display: 'flex', justifyContent: 'flex-end', paddingTop: 4, borderTop: `1px solid ${COLORS.border}` },

  stateCard: {
    background: COLORS.card,
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADII.lg,
    padding: 28,
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 14.5,
  },

  // Deliberately literal white — this represents the printed PDF page itself,
  // not app UI, so it stays the same in both light and dark mode.
  previewWrap: {
    maxWidth: 820,
    margin: '0 auto',
    background: '#fff',
    boxShadow: SHADOWS.panel,
    borderRadius: RADII.sm,
    overflow: 'hidden',
  },
};

export default GenerateReportPage;
