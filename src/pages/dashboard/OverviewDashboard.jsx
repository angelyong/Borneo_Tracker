import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import {
  CATEGORY_TO_PILLAR,
  LAYER_CONFIG,
  TERRITORIES,
  formatValue,
  getHexagonCoverage,
  getLayerRows,
  getRowsForPillar,
  layerColorScale,
  summarizeRows,
  titleCaseConfidence,
  useIndicators,
  useResilience,
} from '../../data/useIndicators';

import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const TERRITORY_CENTERS = {
  Sabah: [5.5, 117.0],
  Sarawak: [2.8, 113.5],
  Brunei: [4.7, 114.8],
  Kalimantan: [0.3, 114.5],
};

const TERRITORY_OPTIONS = ['Overall Borneo', 'Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];
const ESG_CATEGORIES = ['Environment', 'Social', 'Governance'];
const RAG_COLORS = { green: '#16a34a', amber: '#f59e0b', red: '#dc2626' };

const ResizeMap = () => {
  const map = useMap();

  useEffect(() => {
    const resizeMap = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    };

    resizeMap();

    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      resizeMap();
    });

    observer.observe(container);
    window.addEventListener('resize', resizeMap);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resizeMap);
    };
  }, [map]);

  return null;
};

function RagGauge({ score, thresholds }) {
  const cx = 110;
  const cy = 110;
  const r = 80;
  const strokeW = 28;
  const circumference = Math.PI * r;

  const zones = [
    { from: 0, to: thresholds.amber, color: RAG_COLORS.red },
    { from: thresholds.amber, to: thresholds.green, color: RAG_COLORS.amber },
    { from: thresholds.green, to: 100, color: RAG_COLORS.green },
  ];

  const theta = Math.PI * (1 - Math.min(100, Math.max(0, score)) / 100);
  const needleR = r + strokeW / 2;
  const nx = cx + needleR * Math.cos(theta);
  const ny = cy - needleR * Math.sin(theta);

  return (
    <svg viewBox="0 0 220 120" style={styles.gaugeSvg}>
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

      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="#1f2937" />
    </svg>
  );
}

function HexRadar({ pillars }) {
  const keys = Object.keys(pillars);
  const values = Object.values(pillars);
  const cx = 90;
  const cy = 90;
  const maxR = 60;
  const n = keys.length;
  const MAX = Math.max(...values, 1);

  const angleOf = (i) => Math.PI / 2 - (2 * Math.PI * i) / n;

  const rings = [0.25, 0.5, 0.75, 1.0].map((frac) =>
    keys
      .map((_, i) => {
        const a = angleOf(i);
        return `${cx + maxR * frac * Math.cos(a)},${cy - maxR * frac * Math.sin(a)}`;
      })
      .join(' ')
  );

  const dataPoints = values.map((v, i) => {
    const a = angleOf(i);
    const frac = v / MAX;
    return `${cx + maxR * frac * Math.cos(a)},${cy - maxR * frac * Math.sin(a)}`;
  });

  const axes = keys.map((_, i) => {
    const a = angleOf(i);
    return {
      x: cx + maxR * Math.cos(a),
      y: cy - maxR * Math.sin(a),
    };
  });

  return (
    <svg viewBox="0 0 180 180" style={styles.hexSvg}>
      {rings.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#e5e7eb" strokeWidth="0.8" />
      ))}

      {axes.map((pt, i) => (
        <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="#e5e7eb" strokeWidth="0.8" />
      ))}

      <polygon points={dataPoints.join(' ')} fill="rgba(61,184,138,0.25)" stroke="#3db88a" strokeWidth="1.5" />

      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="18">
        🌿
      </text>

      {keys.map((key, i) => {
        const a = angleOf(i);
        const lx = cx + (maxR + 20) * Math.cos(a);
        const ly = cy - (maxR + 20) * Math.sin(a);

        return (
          <g key={key}>
            <text x={lx} y={ly - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#374151">
              {values[i]}
            </text>
            <text x={lx} y={ly + 8} textAnchor="middle" fontSize="8" fill="#6b7280">
              {key}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const OverviewDashboard = () => {
  const [searchText, setSearchText] = useState('');
  const [activeLayer, setActiveLayer] = useState('deforestation');
  const [panelTerritory, setPanelTerritory] = useState('Overall Borneo');
  const [esgCategory, setEsgCategory] = useState('Environment');
  const [panelWidth, setPanelWidth] = useState(360);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const { data, loading, error } = useIndicators();
  const { data: resilience } = useResilience();

  const onDragStart = useCallback(
    (e) => {
      isDragging.current = true;
      startX.current = e.clientX;
      startW.current = panelWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev) => {
        if (!isDragging.current) return;

        const delta = startX.current - ev.clientX;
        const newWidth = Math.min(520, Math.max(300, startW.current + delta));
        setPanelWidth(newWidth);
      };

      const onUp = () => {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [panelWidth]
  );

  const layerEntries = useMemo(() => {
    if (!data?.rows || !activeLayer) return [];

    return getLayerRows(data.rows, activeLayer).filter((entry) =>
      entry.territory.toLowerCase().includes(searchText.trim().toLowerCase())
    );
  }, [activeLayer, data, searchText]);

  const colorForValue = useMemo(() => layerColorScale(layerEntries, activeLayer), [activeLayer, layerEntries]);

  const isOverall = panelTerritory === 'Overall Borneo';

  const resilienceView = useMemo(() => {
    if (!resilience?.territories) return null;

    const thresholds = resilience.ragThresholds || { green: 67, amber: 34 };

    if (!isOverall) {
      const territory = resilience.territories[panelTerritory];

      if (!territory || !Number.isFinite(territory.index)) return null;

      return {
        index: territory.index,
        rag: territory.rag,
        thresholds,
        note: `Weakest pillar: ${territory.weakestPillar} · ${territory.scoredPillars.length}/6 pillars scored`,
      };
    }

    const scored = Object.values(resilience.territories).filter((t) => Number.isFinite(t.index));

    if (!scored.length) return null;

    const avg = scored.reduce((sum, t) => sum + t.index, 0) / scored.length;
    const index = Math.round(avg * 10) / 10;
    const rag = index >= thresholds.green ? 'green' : index >= thresholds.amber ? 'amber' : 'red';

    return {
      index,
      rag,
      thresholds,
      note: `Average of ${scored.length} territories`,
    };
  }, [isOverall, panelTerritory, resilience]);

  const hexCoverage = useMemo(() => {
    if (!data?.rows) return null;

    if (!isOverall) return getHexagonCoverage(data.rows, panelTerritory);

    const totals = {
      Food: 0,
      Energy: 0,
      Education: 0,
      Shelter: 0,
      Healthcare: 0,
      Entertainment: 0,
    };

    TERRITORIES.forEach((territory) => {
      const counts = getHexagonCoverage(data.rows, territory);

      Object.keys(totals).forEach((pillar) => {
        totals[pillar] += counts[pillar];
      });
    });

    return totals;
  }, [data, isOverall, panelTerritory]);

  const esgCard = useMemo(() => {
    if (!data?.rows) return null;

    const pillar = CATEGORY_TO_PILLAR[esgCategory];

    if (!isOverall) {
      const rows = getRowsForPillar(data.rows, panelTerritory, pillar);
      const summary = summarizeRows(rows);

      return {
        label: `${esgCategory} Overview`,
        meta: `${summary.count} indicator${summary.count === 1 ? '' : 's'} · latest ${summary.latestYear ?? '—'}`,
        items: rows.slice(0, 3).map((row) => ({
          k: row.indicator,
          v: formatValue(row),
        })),
      };
    }

    const perTerritory = TERRITORIES.map((territory) => ({
      territory,
      rows: getRowsForPillar(data.rows, territory, pillar),
    }));

    const summary = summarizeRows(perTerritory.flatMap((entry) => entry.rows));

    return {
      label: `${esgCategory} Overview`,
      meta: `${summary.count} indicator${summary.count === 1 ? '' : 's'} · latest ${summary.latestYear ?? '—'}`,
      items: perTerritory.map((entry) => ({
        k: entry.territory,
        v: `${entry.rows.length} indicator${entry.rows.length === 1 ? '' : 's'}`,
      })),
    };
  }, [data, esgCategory, isOverall, panelTerritory]);

  return (
    <div style={styles.root}>
      <div style={styles.mapWrapper}>
        <div style={styles.searchContainer}>
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search territories…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        <MapContainer
          center={[1.5, 114.6]}
          zoom={6}
          minZoom={6}
          maxZoom={8}
          maxBounds={[
            [-7.0, 108.5],
            [7.0, 119.5],
          ]}
          maxBoundsViscosity={1.0}
          style={styles.map}
          zoomControl={false}
        >
          <ResizeMap />

          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {layerEntries.map(({ territory, row }) => {
            const position = TERRITORY_CENTERS[territory];

            if (!position) return null;

            const color = colorForValue(row?.value);

            return (
              <CircleMarker
                key={`${activeLayer}-${territory}`}
                center={position}
                radius={18}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: row ? 0.7 : 0.25,
                  weight: 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <strong>{territory}</strong>
                  <br />
                  {row ? formatValue(row) : 'No data'}
                </Tooltip>

                <Popup>
                  <div style={styles.popupContent}>
                    <strong>{territory}</strong>
                    <div>{LAYER_CONFIG[activeLayer]?.label}</div>
                    <div>{row ? formatValue(row) : 'No data for this layer'}</div>
                    {row && (
                      <div style={styles.popupMeta}>
                        {row.year} · {titleCaseConfidence(row.confidence)}
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div style={{ ...styles.panel, width: panelWidth, minWidth: panelWidth }}>
        <div onMouseDown={onDragStart} style={styles.dragHandle} title="Drag to resize panel">
          <div style={styles.dragGrip} />
        </div>

        <div style={styles.panelDropdownRow}>
          <select
            value={panelTerritory}
            onChange={(e) => setPanelTerritory(e.target.value)}
            style={styles.panelDropdown}
          >
            {TERRITORY_OPTIONS.map((territory) => (
              <option key={territory} value={territory}>
                {territory}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Overall Resilience Status</div>

          {resilienceView ? (
            <>
              <RagGauge score={resilienceView.index} thresholds={resilienceView.thresholds} />

              <div style={styles.gaugeLegend}>
                {[
                  {
                    label: `Poor (<${resilienceView.thresholds.amber})`,
                    color: RAG_COLORS.red,
                  },
                  {
                    label: `Moderate (${resilienceView.thresholds.amber}–${resilienceView.thresholds.green})`,
                    color: RAG_COLORS.amber,
                  },
                  {
                    label: `Good (≥${resilienceView.thresholds.green})`,
                    color: RAG_COLORS.green,
                  },
                ].map((item) => (
                  <div key={item.label} style={styles.legendRow}>
                    <span style={{ ...styles.legendDot, background: item.color }} />
                    <span style={styles.legendLabel}>{item.label}</span>
                  </div>
                ))}
              </div>

              <div style={styles.scoreRow}>
                <span style={{ ...styles.scoreBig, color: RAG_COLORS[resilienceView.rag] || '#1f2937' }}>
                  {resilienceView.index}
                </span>
                <span style={styles.scoreCaption}>Resilience Index (0–100)</span>
              </div>

              <div style={styles.trendRow}>
                <span style={styles.trendLabel}>{resilienceView.note}</span>
              </div>
            </>
          ) : (
            <div style={styles.stateText}>Loading resilience scores…</div>
          )}
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Pillar Coverage</div>
          <div style={styles.sectionSubtitle}>(True Wealth Hexagon · indicators per pillar)</div>

          {hexCoverage ? <HexRadar pillars={hexCoverage} /> : <div style={styles.stateText}>Loading indicator data…</div>}
        </div>

        <div style={{ ...styles.section, borderBottom: 'none' }}>
          <div style={styles.esgHeader}>
            <span style={styles.sectionTitle}>ESG Indicators</span>

            <select value={esgCategory} onChange={(e) => setEsgCategory(e.target.value)} style={styles.esgDropdown}>
              {ESG_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {esgCard ? (
            <div style={styles.esgCard}>
              <div style={styles.esgCardTitle}>{esgCard.label}</div>

              <div style={styles.esgScoreRow}>
                <span style={styles.esgScoreLabel}>Coverage:</span>
                <span style={styles.esgScoreValue}>{esgCard.meta}</span>
              </div>

              {esgCard.items.length ? (
                esgCard.items.map((item) => (
                  <div key={item.k} style={styles.esgItemRow}>
                    <span style={styles.esgItemKey}>{item.k}</span>
                    <span style={styles.esgItemVal}>{item.v}</span>
                  </div>
                ))
              ) : (
                <div style={styles.stateText}>No canonical indicators for this pillar yet.</div>
              )}
            </div>
          ) : (
            <div style={styles.esgCard}>
              <div style={styles.stateText}>Loading indicator data…</div>
            </div>
          )}

          <div style={styles.liveSection}>
            <div style={styles.liveSectionTitle}>
              Live Layer: {activeLayer ? LAYER_CONFIG[activeLayer]?.label : 'None'}
            </div>

            <div style={styles.layerRadioGroup}>
              {Object.keys(LAYER_CONFIG).map((key) => (
                <label key={key} style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="active-layer"
                    checked={activeLayer === key}
                    onChange={() => setActiveLayer(key)}
                    style={styles.radioInput}
                  />
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                </label>
              ))}
            </div>

            {loading && <div style={styles.stateText}>Loading map data…</div>}
            {error && <div style={{ ...styles.stateText, color: '#b91c1c' }}>{error}</div>}

            {!loading &&
              !error &&
              layerEntries.map(({ territory, row }) => (
                <div key={territory} style={styles.summaryRow}>
                  <div>
                    <div style={styles.summaryTerritory}>{territory}</div>
                    <div style={styles.summaryMeta}>
                      {row ? `${row.year} · ${titleCaseConfidence(row.confidence)}` : 'No data'}
                    </div>
                  </div>

                  <div style={styles.summaryValue}>{row ? formatValue(row) : '—'}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  root: {
    display: 'flex',
    width: '100%',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    fontFamily: 'Inter, Arial, sans-serif',
  },

  mapWrapper: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    position: 'relative',
    backgroundColor: '#aad3df',
  },

  map: {
    width: '100%',
    height: '100%',
  },

  searchContainer: {
    position: 'absolute',
    top: '28px',
    left: '20%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    width: '35%',
    maxWidth: '400px',
  },

  searchBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '8px 16px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    border: '1px solid #e0e0e0',
  },

  searchIcon: {
    marginRight: '10px',
    fontSize: '16px',
    color: '#888',
  },

  searchInput: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '14px',
    width: '100%',
    color: '#333',
  },

  popupContent: {
    fontSize: '13px',
    lineHeight: 1.5,
  },

  popupMeta: {
    marginTop: '4px',
    color: '#64748b',
  },

  panel: {
    backgroundColor: '#ffffff',
    overflowY: 'auto',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    borderLeft: '1px solid #e5e7eb',
  },

  dragHandle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '6px',
    height: '100%',
    cursor: 'col-resize',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderLeft: '1px solid #e0e0e0',
  },

  dragGrip: {
    width: '3px',
    height: '32px',
    borderRadius: '2px',
    background:
      'repeating-linear-gradient(to bottom, #cbd5e1 0px, #cbd5e1 3px, transparent 3px, transparent 6px)',
  },

  panelDropdownRow: {
    padding: '12px 16px 0 22px',
    display: 'flex',
    justifyContent: 'flex-end',
  },

  panelDropdown: {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    fontWeight: '500',
    color: '#1f2937',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '150px',
  },

  section: {
    padding: '14px 16px 14px 22px',
    borderBottom: '1px solid #f3f4f6',
  },

  sectionTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '2px',
  },

  sectionSubtitle: {
    fontSize: '11px',
    color: '#6b7280',
    marginBottom: '8px',
  },

  gaugeSvg: {
    width: '100%',
    maxWidth: 220,
    display: 'block',
    margin: '0 auto',
  },

  gaugeLegend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 14px',
    margin: '4px 0 8px',
    justifyContent: 'center',
  },

  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },

  legendLabel: {
    fontSize: '11px',
    color: '#374151',
  },

  scoreRow: {
    textAlign: 'center',
    margin: '4px 0 2px',
  },

  scoreBig: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#1f2937',
  },

  scoreCaption: {
    display: 'block',
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '-2px',
  },

  trendRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
    padding: '8px 10px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },

  trendLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
  },

  hexSvg: {
    width: '100%',
    maxWidth: 180,
    display: 'block',
    margin: '0 auto',
  },

  esgHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },

  esgDropdown: {
    padding: '5px 10px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    backgroundColor: '#fff',
    fontSize: '12px',
    fontWeight: '500',
    color: '#1f2937',
    cursor: 'pointer',
    outline: 'none',
  },

  esgCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    padding: '12px 14px',
    marginBottom: '10px',
  },

  esgCardTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '8px',
  },

  esgScoreRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid #e5e7eb',
  },

  esgScoreLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },

  esgScoreValue: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1f2937',
  },

  esgItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    padding: '3px 0',
  },

  esgItemKey: {
    color: '#6b7280',
  },

  esgItemVal: {
    fontWeight: '600',
    color: '#1f2937',
  },

  liveSection: {
    backgroundColor: '#f8fafc',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '12px',
  },

  liveSectionTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '8px',
  },

  layerRadioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '10px',
  },

  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    color: '#34495e',
    cursor: 'pointer',
  },

  radioInput: {
    marginRight: '8px',
    width: '14px',
    height: '14px',
    cursor: 'pointer',
  },

  stateText: {
    fontSize: '12px',
    color: '#64748b',
    padding: '4px 0',
  },

  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '8px',
    marginTop: '4px',
  },

  summaryTerritory: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#334155',
  },

  summaryMeta: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '1px',
  },

  summaryValue: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'right',
  },
};

export default OverviewDashboard;