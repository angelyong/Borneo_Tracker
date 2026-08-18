// Impact Simulator — Stage IS-3D: safety/UX hardening on top of IS-3C's
// visual before/after. Adds the mandatory "illustrative, not a forecast"
// disclaimer, unit/year labelling, colour-independent RAG status, keyboard/
// ARIA accessibility, and graceful handling of unscored data and a failed
// model load. Slider logic, clamping, reset, and territory-switch behaviour
// are unchanged from IS-3B. See docs/IMPACT_SIMULATOR_SPEC.md §0, §3, §5.
//
// Architecture note: the model is now fetched at runtime via
// useResilienceModel() instead of statically imported, specifically so a
// missing/broken resilience_model.json surfaces as a normal error state on
// this page (this stage's edge-case requirement) rather than breaking the
// production build. resilienceModel.js itself is untouched — its
// recompute(territory, overrides, model) already accepted an explicit model
// as a 3rd argument since IS-2A/IS-2B, precisely for a caller like this one
// that fetches its own copy.

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TERRITORIES, useResilienceModel } from '../../data/useIndicators';
import { recompute } from '../../utils/resilienceModel';
import HexRadar from '../../components/HexRadar';
import RagGauge from '../../components/RagGauge';
import WeakestLinkBars from '../../components/WeakestLinkBars';
import ProvenanceChip from '../../components/ProvenanceChip';
import IntegrityChip from '../../components/IntegrityChip';

const RAG_COLORS = { green: '#16a34a', amber: '#f59e0b', red: '#dc2626' };

// Per-pillar preference order for which indicator gets a slider, when a
// pillar has more than one indicator mapped to it (see
// resilience_model.json's indicatorToPillar). This is a UI ordering choice,
// not a scoring parameter — the actual min/max/current-value still come
// from the loaded model, never invented here. Not every territory has every
// candidate scored (e.g. Sabah/Sarawak have no scored Education indicator
// at all this run) — resolved per-territory below, never guessed.
const PILLAR_INDICATOR_CANDIDATES = {
  Food: ['Paddy production per capita', 'Agricultural land'],
  Energy: ['Electricity access', 'Electrification ratio', 'Domestic electrification ratio', 'Renewable electricity (% output)'],
  Education: ['Adult literacy', 'Mean years schooling (RLS)', 'School enrolment (primary, gross)', 'School enrolment (secondary, gross)'],
  Shelter: ['Clean water access', 'Basic sanitation access'],
  Healthcare: ['Life expectancy', 'Hospital beds (per 1k)'],
  Entertainment: ['Internet use'],
};

function resolveSliderIndicator(pillar, inputs) {
  const candidates = PILLAR_INDICATOR_CANDIDATES[pillar] || [];
  return candidates.find((name) => inputs[name]) || null;
}

function RagStatus({ rag, t }) {
  if (!rag) return null;
  const color = RAG_COLORS[rag] || 'var(--color-muted)';
  const label = t(`simulator.ragStatus_${rag}`, t('simulator.ragStatus_unknown'));
  return (
    <span style={{ ...styles.ragStatus, color }}>
      <span aria-hidden="true" style={{ ...styles.ragDot, backgroundColor: color }} />
      {label}
    </span>
  );
}

const ImpactSimulator = () => {
  const { t } = useTranslation();
  const { data: model, loading, error } = useResilienceModel();
  const [selectedTerritory, setSelectedTerritory] = useState('Sabah');
  const [overrides, setOverrides] = useState({});

  const baselineInputs = useMemo(
    () => model?.baseline?.[selectedTerritory]?.inputs || {},
    [model, selectedTerritory]
  );
  const thresholds = model?.index?.ragThresholds;

  const sliders = useMemo(() => {
    if (!model) return [];
    return model.pillars.map((pillar) => {
      const indicator = resolveSliderIndicator(pillar, baselineInputs);
      if (!indicator) return { pillar, indicator: null };
      const spec = model.bounds[indicator];
      const input = baselineInputs[indicator];
      return {
        pillar,
        indicator,
        unit: input.unit,
        min: Math.min(spec.best, spec.worst),
        max: Math.max(spec.best, spec.worst),
        baselineValue: input.value,
        confidence: input.confidence,
        source: input.source,
        year: input.year,
      };
    });
  }, [model, baselineInputs]);

  const handleTerritoryChange = (territory) => {
    setSelectedTerritory(territory);
    setOverrides({});
  };

  const handleSliderChange = (indicator, value) => {
    setOverrides((prev) => ({ ...prev, [indicator]: value }));
  };

  const handleReset = () => setOverrides({});

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          <div style={styles.stateBox} role="status">
            {t('simulator.loading')}
          </div>
        </div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div style={styles.container}>
        <div style={styles.content}>
          <div style={styles.errorBox} role="alert">
            {t('simulator.error')}
          </div>
        </div>
      </div>
    );
  }

  const baselineResult = recompute(selectedTerritory, {}, model);
  const scenarioResult = recompute(selectedTerritory, overrides, model);
  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div style={styles.container}>
      <div style={styles.rightCol}>
        <div style={styles.content}>
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <h1 style={styles.pageTitle}>{t('simulator.title')}</h1>
              <p style={styles.pageSubtitle}>{t('simulator.subtitle')}</p>
            </div>
            <div style={styles.headerRight}>
              <IntegrityChip scope="model" />
              <select
                value={selectedTerritory}
                onChange={(event) => handleTerritoryChange(event.target.value)}
                style={styles.dropdown}
                aria-label={t('simulator.territorySelectorLabel')}
              >
                {TERRITORIES.map((territory) => (
                  <option key={territory} value={territory}>
                    {territory}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasOverrides}
                style={{ ...styles.resetButton, opacity: hasOverrides ? 1 : 0.5 }}
              >
                {t('simulator.resetButton')}
              </button>
            </div>
          </div>

          <div style={styles.illustrativeBanner}>{t('simulator.illustrative')}</div>

          <div style={styles.panelsRow}>
            <div style={styles.panel}>
              <div style={styles.panelTitle}>{t('simulator.baselineLabel')}</div>
              {thresholds && <RagGauge score={baselineResult.index} thresholds={thresholds} maxWidth={180} />}
              <div style={styles.indexNumber}>{baselineResult.index ?? t('simulator.noIndex')}</div>
              <RagStatus rag={baselineResult.rag} t={t} />
              <HexRadar
                pillars={baselineResult.pillarScores}
                max={100}
                weakest={baselineResult.weakestPillar}
                maxWidth={160}
                missingLabel={t('dashboard.noComparableData')}
                incompleteLabel={t('regional.scoredPillarsTitle', {
                  count: Object.values(baselineResult.pillarScores).filter(Number.isFinite).length,
                })}
                ariaLabel={t('regional.scoredPillarsTitle', {
                  count: Object.values(baselineResult.pillarScores).filter(Number.isFinite).length,
                })}
              />
              <div style={styles.weakestBarsWrap}>
                <WeakestLinkBars
                  territory={baselineResult}
                  title={t('dashboard.weakestLinkFirst')}
                  missingLabel={t('dashboard.noComparableData')}
                />
              </div>
              <div style={styles.panelDisclaimer}>{t('simulator.illustrative')}</div>
            </div>

            <div style={styles.panel}>
              <div style={styles.panelTitle}>{t('simulator.scenarioLabel')}</div>
              {thresholds && <RagGauge score={scenarioResult.index} thresholds={thresholds} maxWidth={180} />}
              <div style={styles.indexNumber}>{scenarioResult.index ?? t('simulator.noIndex')}</div>
              <RagStatus rag={scenarioResult.rag} t={t} />
              <HexRadar
                pillars={scenarioResult.pillarScores}
                max={100}
                weakest={scenarioResult.weakestPillar}
                maxWidth={160}
                missingLabel={t('dashboard.noComparableData')}
                incompleteLabel={t('regional.scoredPillarsTitle', {
                  count: Object.values(scenarioResult.pillarScores).filter(Number.isFinite).length,
                })}
                ariaLabel={t('regional.scoredPillarsTitle', {
                  count: Object.values(scenarioResult.pillarScores).filter(Number.isFinite).length,
                })}
              />
              <div style={styles.weakestBarsWrap}>
                <WeakestLinkBars
                  territory={scenarioResult}
                  title={t('dashboard.weakestLinkFirst')}
                  missingLabel={t('dashboard.noComparableData')}
                />
              </div>
              <div style={styles.panelDisclaimer}>{t('simulator.illustrative')}</div>
            </div>
          </div>

          <div style={styles.slidersBox}>
            <div style={styles.sectionTitle}>{t('simulator.slidersTitle')}</div>
            <div style={styles.sectionSubtitle}>{t('simulator.slidersSubtitle')}</div>
            {sliders.map(({ pillar, indicator, unit, min, max, baselineValue, confidence, source, year }) => {
              if (!indicator) {
                return (
                  <div key={pillar} style={styles.sliderRow}>
                    <div style={styles.sliderLabel}>{pillar}</div>
                    <div style={styles.noIndicator}>{t('simulator.noInputsForPillar')}</div>
                  </div>
                );
              }
              const current = overrides[indicator] ?? baselineValue;
              const step = (max - min) / 100 || 1;
              const ariaLabel = t('simulator.sliderAriaLabel', { pillar, indicator, value: current, unit });
              return (
                <div key={pillar} style={styles.sliderRow}>
                  <div style={styles.sliderLabelRow}>
                    <span style={styles.sliderLabel}>
                      {pillar} — {indicator}
                      {year ? <span style={styles.yearNote}> ({t('simulator.dataYear', { year })})</span> : null}
                    </span>
                    <span style={styles.sliderValue}>
                      {current} {unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={current}
                    onChange={(event) => handleSliderChange(indicator, Number(event.target.value))}
                    style={styles.slider}
                    aria-label={ariaLabel}
                    aria-valuenow={current}
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-valuetext={`${current} ${unit}`}
                  />
                  <ProvenanceChip confidence={confidence} source={source} year={year} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    minHeight: '100%',
    width: '100%',
    backgroundColor: 'var(--color-page-bg)',
    fontFamily: 'Inter, Arial, sans-serif',
    overflow: 'visible',
  },
  rightCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    overflow: 'visible',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
    boxSizing: 'border-box',
  },
  stateBox: {
    fontSize: '14px',
    color: 'var(--color-muted)',
    padding: '24px',
    textAlign: 'center',
  },
  errorBox: {
    fontSize: '14px',
    color: 'var(--color-red)',
    backgroundColor: 'var(--color-red-soft)',
    border: '1px solid var(--color-red)',
    borderRadius: '10px',
    padding: '16px 18px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  headerLeft: { flex: 1 },
  headerRight: { flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 },
  pageTitle: { fontSize: '24px', fontWeight: '700', color: 'var(--color-ink)', margin: 0 },
  pageSubtitle: { fontSize: '14px', color: 'var(--color-muted)', margin: '4px 0 0 0' },
  dropdown: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
    color: 'var(--color-ink)',
    fontSize: '14px',
  },
  resetButton: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
    color: 'var(--color-ink)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  illustrativeBanner: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--color-amber-dark)',
    backgroundColor: 'var(--color-yellow-soft)',
    borderRadius: '8px',
    padding: '8px 12px',
    marginBottom: '16px',
    display: 'inline-block',
  },
  panelsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  },
  panel: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  panelTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    alignSelf: 'flex-start',
    marginBottom: '4px',
  },
  indexNumber: {
    fontSize: '24px',
    fontWeight: '800',
    color: 'var(--color-ink)',
    fontVariantNumeric: 'tabular-nums',
  },
  ragStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '12px',
    fontWeight: '700',
    marginTop: '2px',
    marginBottom: '8px',
  },
  ragDot: { width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' },
  weakestBarsWrap: {
    width: '100%',
    marginTop: '12px',
    borderTop: '1px solid var(--color-border)',
    paddingTop: '12px',
  },
  panelDisclaimer: {
    width: '100%',
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px dashed var(--color-border)',
    fontSize: '10.5px',
    color: 'var(--color-muted)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  slidersBox: {
    backgroundColor: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    padding: '16px 18px',
  },
  sectionTitle: { fontSize: '13px', fontWeight: '700', color: 'var(--color-ink)', marginBottom: '2px' },
  sectionSubtitle: { fontSize: '11px', color: 'var(--color-muted)', marginBottom: '12px' },
  sliderRow: { marginBottom: '16px' },
  sliderLabelRow: { display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' },
  sliderLabel: { fontSize: '12.5px', fontWeight: '600', color: 'var(--color-ink)' },
  yearNote: { fontWeight: '400', color: 'var(--color-muted)' },
  sliderValue: { fontSize: '12.5px', fontWeight: '700', color: 'var(--color-ink)', fontVariantNumeric: 'tabular-nums' },
  slider: { width: '100%', marginBottom: '4px' },
  noIndicator: { fontSize: '12px', color: 'var(--color-muted)' },
};

export default ImpactSimulator;
