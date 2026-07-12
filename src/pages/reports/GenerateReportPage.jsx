import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SDG_GOALS,
  TERRITORIES,
  extractYear,
  getCanonicalRows,
  getRowsForSdg,
  summarizeRows,
  useIndicators,
  useResilience,
} from '../../data/useIndicators';
import { getPosts } from '../../services/communityService';
import { generatePdfFromSections } from '../../utils/pdfReport';
import { Button } from '../../components/ui';
import { COLORS, FONT, RADII, SHADOWS } from '../../theme';
import {
  CommunitySection,
  HexagonSection,
  IndicatorTableSection,
  MethodologySection,
  ReportCoverSection,
  ResilienceSection,
  SdgSummarySection,
} from './ReportSections';

const HEXAGON_PILLARS = ['Food', 'Energy', 'Education', 'Shelter', 'Healthcare', 'Entertainment'];

const DEFAULT_SECTIONS = {
  resilience: true,
  hexagon: true,
  table: true,
  sdg: true,
  community: false,
  methodology: true,
};

const SECTION_TOGGLES = [
  { key: 'resilience', label: 'Resilience Index & RAG Status' },
  { key: 'hexagon', label: 'True Wealth Hexagon Pillar Scores' },
  { key: 'table', label: 'Canonical Indicator Table' },
  { key: 'sdg', label: 'SDG Progress Summary' },
  { key: 'community', label: 'Community Reports' },
  { key: 'methodology', label: 'Methodology & Provenance Footer' },
];

const GenerateReportPage = () => {
  const { data, loading, error } = useIndicators();
  const { data: resilienceData } = useResilience();

  const [territory, setTerritory] = useState(TERRITORIES[0]);
  const [fromYear, setFromYear] = useState(null);
  const [toYear, setToYear] = useState(null);
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [generating, setGenerating] = useState(false);

  const coverRef = useRef(null);
  const resilienceRef = useRef(null);
  const hexagonRef = useRef(null);
  const tableRef = useRef(null);
  const sdgRef = useRef(null);
  const communityRef = useRef(null);
  const methodologyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getPosts().then((posts) => {
      if (!cancelled) setCommunityPosts(posts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allTerritoryRows = useMemo(
    () => (data?.rows ? getCanonicalRows(data.rows, territory) : []),
    [data, territory]
  );

  // Defaults span exactly the years this territory actually has data for, so
  // nothing is silently hidden the first time a territory is opened.
  const yearBounds = useMemo(() => {
    const years = allTerritoryRows.map((row) => extractYear(row.year)).filter(Number.isFinite);
    const currentYear = new Date().getFullYear();
    return years.length ? { min: Math.min(...years), max: Math.max(...years) } : { min: currentYear, max: currentYear };
  }, [allTerritoryRows]);

  // Re-sync the range whenever the applicable bounds change (territory switch,
  // or data finishing its initial load) — done during render, not an effect,
  // per React's guidance for resetting state when a dependency changes.
  const boundsKey = `${territory}:${yearBounds.min}:${yearBounds.max}`;
  const [appliedBoundsKey, setAppliedBoundsKey] = useState(null);
  if (boundsKey !== appliedBoundsKey) {
    setAppliedBoundsKey(boundsKey);
    setFromYear(yearBounds.min);
    setToYear(yearBounds.max);
  }

  const withinRange = (yearValue) => {
    const year = extractYear(yearValue);
    // Rows without a parseable year are kept rather than silently dropped.
    return Number.isFinite(year) ? year >= fromYear && year <= toYear : true;
  };

  const filteredRows = useMemo(
    () => allTerritoryRows.filter((row) => withinRange(row.year)).sort((a, b) => a.indicator.localeCompare(b.indicator)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTerritoryRows, fromYear, toYear]
  );

  const goalSummaries = useMemo(
    () =>
      SDG_GOALS.map(({ goal, label }) => {
        const rows = getRowsForSdg(data?.rows || [], territory, goal).filter((row) => withinRange(row.year));
        const summary = summarizeRows(rows);
        return { goal, label, count: summary.count, latestYear: summary.latestYear };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, territory, fromYear, toYear]
  );

  const communityPostsForTerritory = useMemo(
    () =>
      communityPosts
        .filter((post) => post.territory === territory || post.territory === 'All Borneo')
        .filter((post) => {
          const year = new Date(post.createdAt).getFullYear();
          return Number.isFinite(fromYear) ? year >= fromYear && year <= toYear : true;
        }),
    [communityPosts, territory, fromYear, toYear]
  );

  const sources = useMemo(
    () => [...new Set(filteredRows.map((row) => row.source).filter(Boolean))].sort(),
    [filteredRows]
  );

  const resilienceView = resilienceData?.territories?.[territory] || null;

  const generatedAt = useMemo(
    () => `${new Date().toLocaleString('en-MY', { dateStyle: 'long', timeStyle: 'short' })} (local time)`,
    []
  );

  const toggleSection = (key) => setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const orderedSections = [
        coverRef.current,
        sections.resilience ? resilienceRef.current : null,
        sections.hexagon ? hexagonRef.current : null,
        sections.table ? tableRef.current : null,
        sections.sdg ? sdgRef.current : null,
        sections.community ? communityRef.current : null,
        sections.methodology ? methodologyRef.current : null,
      ];
      const filename = `borneo-tracker-report-${territory}-${fromYear}-${toYear}`
        .toLowerCase()
        .replace(/\s+/g, '-');
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
          A citable PDF snapshot of one territory&rsquo;s True Wealth and ESG data &mdash; built for compliance
          buyers, suppliers, and investors, not just internal dashboards.
        </p>
      </header>

      <div style={styles.controlsCard}>
        <div style={styles.controlsRow}>
          <label style={styles.controlLabel}>
            1. Select Territory
            <select value={territory} onChange={(e) => setTerritory(e.target.value)} style={styles.select}>
              {TERRITORIES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.controlLabel}>
            2. Select Date Range
            <div style={styles.rangeRow}>
              <input
                type="number"
                value={fromYear ?? ''}
                onChange={(e) => setFromYear(Number(e.target.value))}
                style={styles.yearInput}
              />
              <span style={{ color: COLORS.muted }}>to</span>
              <input
                type="number"
                value={toYear ?? ''}
                onChange={(e) => setToYear(Number(e.target.value))}
                style={styles.yearInput}
              />
            </div>
          </label>
        </div>

        <div style={styles.controlLabel}>
          3. Include Sections
          <div style={styles.checkboxGrid}>
            {SECTION_TOGGLES.map(({ key, label }) => (
              <label key={key} style={styles.checkboxRow}>
                <input type="checkbox" checked={sections[key]} onChange={() => toggleSection(key)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={styles.generateRow}>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={generating || loading || !!error}
            style={{ minWidth: 220 }}
          >
            {generating ? 'Generating PDF…' : 'Generate & Download PDF'}
          </Button>
        </div>
      </div>

      {loading && <div style={styles.stateCard}>Loading real indicator data…</div>}
      {error && <div style={{ ...styles.stateCard, color: COLORS.red }}>{error}</div>}

      {!loading && !error && (
        <div style={styles.previewWrap}>
          <div ref={coverRef}>
            <ReportCoverSection territory={territory} fromYear={fromYear} toYear={toYear} generatedAt={generatedAt} />
          </div>

          {sections.resilience && (
            <div ref={resilienceRef} style={styles.sectionDivider}>
              <ResilienceSection resilienceView={resilienceView} />
            </div>
          )}

          {sections.hexagon && (
            <div ref={hexagonRef} style={styles.sectionDivider}>
              <HexagonSection
                pillarScores={resilienceView?.pillarScores || {}}
                unscoredPillars={resilienceView?.unscoredPillars || HEXAGON_PILLARS}
              />
            </div>
          )}

          {sections.table && (
            <div ref={tableRef} style={styles.sectionDivider}>
              <IndicatorTableSection rows={filteredRows} />
            </div>
          )}

          {sections.sdg && (
            <div ref={sdgRef} style={styles.sectionDivider}>
              <SdgSummarySection goalSummaries={goalSummaries} />
            </div>
          )}

          {sections.community && (
            <div ref={communityRef} style={styles.sectionDivider}>
              <CommunitySection posts={communityPostsForTerritory} />
            </div>
          )}

          {sections.methodology && (
            <div ref={methodologyRef} style={styles.sectionDivider}>
              <MethodologySection generatedAt={generatedAt} sources={sources} method={resilienceData?.method || ''} />
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
  subtitle: { fontSize: 14, color: COLORS.muted, margin: '6px 0 0', maxWidth: 620, lineHeight: 1.5 },

  controlsCard: {
    background: '#fff',
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADII.lg,
    padding: 24,
    marginBottom: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  controlsRow: { display: 'flex', gap: 32, flexWrap: 'wrap' },
  controlLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
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
    background: '#fff',
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
    background: '#fff',
    border: `1px solid ${COLORS.border}`,
    borderRadius: RADII.lg,
    padding: 28,
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 14.5,
  },

  previewWrap: {
    maxWidth: 794,
    margin: '0 auto',
    background: '#fff',
    boxShadow: SHADOWS.panel,
    borderRadius: RADII.sm,
    overflow: 'hidden',
  },
  sectionDivider: { borderTop: `1px solid ${COLORS.border}` },
};

export default GenerateReportPage;
