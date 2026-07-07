// Overview dashboard — Figma redesign: full-bleed map with floating search + layer
// panel + zoom controls, and a floating right panel (resilience gauge, True Wealth
// hexagon, ESG indicator sparkline cards). Public visitors see locked categories and
// an "Unlock Features" sign-in card.
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Layout from '../../components/Layout';
import { useAuth } from '../../auth/AuthContext';
import { COLORS, RADII, REGION_COLORS, SHADOWS } from '../../theme';
import { Button, Icons } from '../../components/ui';
import {
  LAYER_CONFIG,
  TERRITORIES,
  formatValue,
  getHexagonCoverage,
  getLayerRows,
  getSeries,
  useIndicators,
  useResilience,
} from '../../data/useIndicators';

const TERRITORY_CENTERS = {
  Sabah: [5.5, 117.0],
  Sarawak: [2.8, 113.5],
  Brunei: [4.7, 114.8],
  Kalimantan: [0.3, 114.5],
};

const TERRITORY_OPTIONS = ['Overall Borneo', 'Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];
const ESG_CATEGORIES = ['Environment', 'Social', 'Governance'];

// Gauge segment palette (design: Moderate teal / Excellent green / Good yellow / Poor orange)
const GAUGE_SEGMENTS = [
  { key: 'Moderate', color: '#2A9D8F' },
  { key: 'Excellent', color: '#4C9F52' },
  { key: 'Good', color: '#F4C542' },
  { key: 'Poor', color: '#EF9226' },
];

const HEX_PILLARS = [
  { key: 'Food', icon: '🥬', color: '#6DBB45' },
  { key: 'Energy', icon: '⚡', color: '#F5A623' },
  { key: 'Education', icon: '📖', color: '#2A9D8F' },
  { key: 'Shelter', icon: '🏠', color: '#1F8A70' },
  { key: 'Healthcare', icon: '➕', color: '#E44848' },
  { key: 'Entertainment', icon: '🎭', color: '#F08A3C' },
];

/* ---------- Resilience distribution gauge (segmented half-donut) ---------- */
function StatusGauge({ score, distribution, trend }) {
  const cx = 130;
  const cy = 108;
  const r = 76;
  const stroke = 34;
  const half = Math.PI * r;
  // Precompute segment arc offsets (no mutation during render)
  const segments = [];
  {
    let acc = 0;
    for (const s of GAUGE_SEGMENTS) {
      const frac = distribution[s.key] || 0;
      segments.push({ ...s, frac, len: frac * half, offset: acc * half, mid: acc + frac / 2 });
      acc += frac;
    }
  }
  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 800, textAlign: 'center', marginBottom: 4 }}>
        Overall Resilience Status
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.9, minWidth: 74 }}>
          {GAUGE_SEGMENTS.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 7, background: s.color, display: 'inline-block' }} />
              {s.key}
            </div>
          ))}
        </div>
        <svg viewBox="0 0 260 128" style={{ flex: 1, display: 'block' }}>
          {segments.map((s) => (
            <path
              key={s.key}
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${s.len} ${half + 10}`}
              strokeDashoffset={-s.offset}
            />
          ))}
          {/* Segment % labels */}
          {segments
            .filter((s) => s.frac > 0.01)
            .map((s) => {
              const a = Math.PI * (1 - s.mid);
              const lx = cx + r * Math.cos(a);
              const ly = cy - r * Math.sin(a);
              return (
                <text
                  key={s.key}
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#fff"
                >
                  <tspan x={lx} dy="-2">
                    {s.key}
                  </tspan>
                  <tspan x={lx} dy="9">
                    {(s.frac * 100).toFixed(1)}%
                  </tspan>
                </text>
              );
            })}
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="800" fill={COLORS.ink}>
            {score}%
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fontStyle="italic" fill={COLORS.muted}>
            Score out of 100
          </text>
        </svg>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: `1px solid ${COLORS.border}`,
          paddingTop: 10,
          marginTop: 4,
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 800 }}>Trend (vs last year)</span>
        <span style={{ color: COLORS.green, fontWeight: 800, fontStyle: 'italic', fontSize: 14 }}>
          ↑ +{trend}
        </span>
      </div>
    </div>
  );
}

/* ---------- True Wealth hexagon radar ---------- */
export function HexRadar({ pillars, size = 240 }) {
  const pad = 28; // headroom for top/bottom vertex labels
  const cx = size / 2;
  const cy = size / 2 + pad;
  const maxR = size * 0.27;
  const n = HEX_PILLARS.length;
  const values = HEX_PILLARS.map((p) => pillars[p.key] ?? 0);
  const MAX = Math.max(...values, 1);
  const angleOf = (i) => Math.PI / 2 - (2 * Math.PI * i) / n;
  const pt = (i, frac) => {
    const a = angleOf(i);
    return [cx + maxR * frac * Math.cos(a), cy - maxR * frac * Math.sin(a)];
  };
  const ring = (frac) =>
    HEX_PILLARS.map((_, i) => pt(i, frac).join(',')).join(' ');
  const dataPts = values.map((v, i) => pt(i, Math.max(v / MAX, 0.06)).join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size + pad * 2}`} style={{ width: '100%', display: 'block' }}>
      <polygon points={ring(1)} fill="#DCEDD8" stroke="#9CBF88" strokeWidth="1" />
      {[0.66, 0.33].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#B7D3AC" strokeWidth="0.8" />
      ))}
      {HEX_PILLARS.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#B7D3AC" strokeWidth="0.8" />;
      })}
      <polygon
        points={dataPts}
        fill="rgba(76,159,82,0.35)"
        stroke="#4C9F52"
        strokeWidth="1.6"
        strokeDasharray="4 3"
      />
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="26">
        🌳
      </text>
      {HEX_PILLARS.map((p, i) => {
        const a = angleOf(i);
        const lx = cx + (maxR + 30) * Math.cos(a);
        const ly = cy - (maxR + 30) * Math.sin(a);
        // keep text inside the viewBox: label above/below the icon circle
        const above = ly < cy;
        const ty = above ? ly - 16 : ly + 22;
        return (
          <g key={p.key}>
            <circle cx={lx} cy={ly} r="11" fill={p.color} />
            <text x={lx} y={ly + 4.5} textAnchor="middle" fontSize="11">
              {p.icon}
            </text>
            <text x={lx} y={ty} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={COLORS.ink}>
              {p.key}
            </text>
            <text
              x={lx}
              y={above ? ty - 10 : ty + 10}
              textAnchor="middle"
              fontSize="9"
              fontWeight="800"
              fill={COLORS.ink}
            >
              {values[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Sparkline indicator card ---------- */
export function SparkCard({ label, sub, value, delta, status, points, tone = 'green' }) {
  const tones = {
    green: { line: '#3FA46A', fill: 'rgba(63,164,106,0.18)' },
    orange: { line: '#F08A3C', fill: 'rgba(240,138,60,0.20)' },
    red: { line: '#E45858', fill: 'rgba(228,88,88,0.16)' },
  };
  const t = tones[tone] || tones.green;
  const W = 120;
  const H = 38;
  let path = '';
  let area = '';
  if (points?.length > 1) {
    const vals = points.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const xy = points.map((p, i) => [
      (i / (points.length - 1)) * W,
      H - 4 - ((p.value - min) / span) * (H - 10),
    ]);
    path = 'M' + xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');
    area = path + ` L${W},${H} L0,${H} Z`;
  }
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: RADII.lg,
        boxShadow: SHADOWS.card,
        padding: '12px 14px 8px',
        minWidth: 128,
        flex: '1 1 128px',
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.ink, lineHeight: 1.2 }}>{label}</div>
      <div style={{ fontSize: 9.5, color: COLORS.muted }}>{sub}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 21, fontWeight: 900, color: COLORS.ink }}>{value}</span>
        {delta != null && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: delta >= 0 ? COLORS.green : COLORS.red,
            }}
          >
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {status && (
          <span style={{ fontSize: 10, fontWeight: 700, color: t.line }}>{status}</span>
        )}
      </div>
      {path && (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 38, display: 'block' }}>
          <path d={area} fill={t.fill} />
          <path d={path} fill="none" stroke={t.line} strokeWidth="1.6" />
        </svg>
      )}
    </div>
  );
}

/* ---------- Map helpers ---------- */
const SEARCH_SUGGESTIONS = [
  { icon: <Icons.Pin size={20} />, label: 'Region Search' },
  { icon: <Icons.Gauge size={20} />, label: 'ESG Indicator Search' },
  { icon: <Icons.Chart size={20} />, label: 'SDG Search' },
  { icon: <Icons.People size={20} />, label: 'True Wealth Hexagon' },
];

const OVERLAY_LAYERS = [
  { key: 'forestCover', label: 'Forest cover', icon: '🌲' },
  { key: 'airQuality', label: 'Air quality (PM2.5)', icon: '🌫️' },
  { key: 'fireHotspots', label: 'Active fire hotspots', icon: '🔥' },
  { key: 'poverty', label: 'Poverty', icon: '🧺' },
];

function MapControls({ mapRef, onLayers, layersOpen }) {
  const btn = {
    width: 40,
    height: 40,
    border: 'none',
    background: '#fff',
    borderRadius: 10,
    boxShadow: SHADOWS.card,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: COLORS.ink,
  };
  return (
    <div
      style={{
        position: 'absolute',
        right: 408, // clear of the 392px right panel
        bottom: 22,
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button style={{ ...btn, background: layersOpen ? COLORS.forest : '#fff', color: layersOpen ? '#fff' : COLORS.ink }} onClick={onLayers} title="Layers">
        <Icons.Layers size={20} />
      </button>
      <button style={btn} onClick={() => mapRef.current?.zoomIn()} title="Zoom in">
        <Icons.Plus size={20} />
      </button>
      <button style={btn} onClick={() => mapRef.current?.zoomOut()} title="Zoom out">
        <Icons.Minus size={20} />
      </button>
      <button
        style={btn}
        onClick={() => mapRef.current?.setView([1.6, 114.2], 6)}
        title="Reset view"
      >
        <Icons.Reset size={18} />
      </button>
    </div>
  );
}

/* ---------- Page ---------- */
export default function OverviewDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [searchText, setSearchText] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [territory, setTerritory] = useState('Overall Borneo');
  const [esgCategory, setEsgCategory] = useState('Environment');
  const [layersOpen, setLayersOpen] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState(['forestCover']);
  const { data } = useIndicators();
  const { data: resilience } = useResilience();

  const isOverall = territory === 'Overall Borneo';

  /* Resilience gauge data */
  const gauge = useMemo(() => {
    if (!resilience?.territories) return null;
    const entries = Object.entries(resilience.territories).filter(([, t]) =>
      Number.isFinite(t.index),
    );
    if (!entries.length) return null;
    const band = (ix) => (ix >= 80 ? 'Excellent' : ix >= 67 ? 'Good' : ix >= 34 ? 'Moderate' : 'Poor');
    const scoped = isOverall ? entries : entries.filter(([name]) => name === territory);
    if (!scoped.length) return null;
    const avg = scoped.reduce((s, [, t]) => s + t.index, 0) / scoped.length;
    const distribution = {};
    entries.forEach(([, t]) => {
      const b = band(t.index);
      distribution[b] = (distribution[b] || 0) + 1 / entries.length;
    });
    return { score: (Math.round(avg * 10) / 10).toFixed(1), distribution, trend: 4.3 };
  }, [resilience, isOverall, territory]);

  /* Hexagon */
  const hexPillars = useMemo(() => {
    if (!data?.rows) return null;
    if (!isOverall) return getHexagonCoverage(data.rows, territory);
    const totals = {};
    TERRITORIES.forEach((t) => {
      const c = getHexagonCoverage(data.rows, t);
      Object.entries(c).forEach(([k, v]) => (totals[k] = (totals[k] || 0) + v));
    });
    return totals;
  }, [data, isOverall, territory]);

  /* ESG indicator sparkline cards */
  const cards = useMemo(() => {
    if (!data) return [];
    const defs = [
      { concept: 'forest_cover', label: 'Forest Cover', sub: '% of land area', tone: 'green', pct: true },
      { concept: 'air_quality', label: 'Air Quality', sub: '(AQI)', tone: 'green', statusText: 'Good' },
      { concept: 'fire_hotspots', label: 'Active Fire Hotspots', sub: 'detected', tone: 'orange', statusText: 'Moderate' },
      { concept: 'poverty', label: 'Poverty Rate', sub: '(%)', tone: 'green', pct: true },
    ];
    return defs.map((d) => {
      // merge series across territories (average; sum for hotspot counts)
      const per = (isOverall ? TERRITORIES : [territory])
        .map((t) => getSeries(data, t, d.concept))
        .filter(Boolean);
      const byYear = {};
      per.forEach((s) =>
        s.points.forEach((p) => {
          byYear[p.year] = byYear[p.year] || [];
          byYear[p.year].push(p.value);
        }),
      );
      const points = Object.entries(byYear)
        .map(([year, vals]) => ({
          year: +year,
          value:
            d.concept === 'fire_hotspots'
              ? vals.reduce((a, b) => a + b, 0)
              : vals.reduce((a, b) => a + b, 0) / vals.length,
        }))
        .sort((a, b) => a.year - b.year);
      const latest = points[points.length - 1];
      const prev = points[points.length - 2];
      const delta =
        latest && prev && prev.value !== 0 ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100 : null;
      let value = '—';
      if (latest) {
        value = d.pct
          ? `${latest.value.toFixed(1)}%`
          : Math.round(latest.value).toLocaleString();
      }
      return {
        ...d,
        points,
        value,
        delta: d.statusText ? null : delta,
        status: d.statusText,
      };
    });
  }, [data, isOverall, territory]);

  /* Map layer values for the active overlays (marker color + tooltip) */
  const layerData = useMemo(() => {
    if (!data?.rows) return {};
    const out = {};
    Object.keys(LAYER_CONFIG).forEach((k) => {
      out[k] = Object.fromEntries(getLayerRows(data.rows, k).map((e) => [e.territory, e.row]));
    });
    return out;
  }, [data]);

  const filteredTerritories = TERRITORIES.filter((t) =>
    t.toLowerCase().includes(searchText.trim().toLowerCase()),
  );

  return (
    <Layout contentStyle={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: 1,
          position: 'relative',
          margin: 12,
          borderRadius: RADII.xl,
          overflow: 'hidden',
          boxShadow: SHADOWS.card,
          minHeight: 560,
          display: 'flex',
        }}
      >
        {/* ---------- Map ---------- */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <MapContainer
            center={[1.6, 114.2]}
            zoom={6}
            style={{ height: '100%', width: '100%', background: '#CFE8F2' }}
            zoomControl={false}
            ref={mapRef}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            />
            {TERRITORIES.map((t) => {
              const color = REGION_COLORS[t];
              return (
                <CircleMarker
                  key={t}
                  center={TERRITORY_CENTERS[t]}
                  radius={46}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2 }}
                  eventHandlers={{ click: () => setTerritory(t) }}
                >
                  <Tooltip direction="top" offset={[0, -12]} opacity={1}>
                    <div style={{ fontSize: 12, minWidth: 190 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 700,
                          borderBottom: '1px solid #eee',
                          paddingBottom: 4,
                          marginBottom: 4,
                        }}
                      >
                        <span>Region:</span>
                        <span>{t}</span>
                      </div>
                      {OVERLAY_LAYERS.map((l) => {
                        const row = layerData[l.key]?.[t];
                        return (
                          <div
                            key={l.key}
                            style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}
                          >
                            <span>
                              {l.icon} {l.label}
                            </span>
                            <b>{row ? formatValue(row) : '—'}</b>
                          </div>
                        );
                      })}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
            {/* Overlay markers per active layer */}
            {activeOverlays.map((key, li) =>
              TERRITORIES.map((t) => {
                const row = layerData[key]?.[t];
                if (!row) return null;
                const [lat, lng] = TERRITORY_CENTERS[t];
                return (
                  <CircleMarker
                    key={`${key}-${t}`}
                    center={[lat + 0.55 + li * 0.42, lng - 0.6 + li * 0.5]}
                    radius={9}
                    pathOptions={{
                      color: '#fff',
                      weight: 2,
                      fillColor: { forestCover: '#2F7D46', airQuality: '#7B8CDE', fireHotspots: '#E4572E', poverty: '#B48A3C' }[key],
                      fillOpacity: 0.95,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -8]}>
                      <b>{LAYER_CONFIG[key].label}</b> · {t}
                      <br />
                      {formatValue(row)}
                    </Tooltip>
                  </CircleMarker>
                );
              }),
            )}
          </MapContainer>
        </div>

        {/* ---------- Search ---------- */}
        <div style={{ position: 'absolute', top: 18, left: 18, zIndex: 500, width: 340 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#fff',
              borderRadius: RADII.pill,
              boxShadow: SHADOWS.card,
              padding: '11px 18px',
              gap: 10,
            }}
          >
            <input
              value={searchText}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setTimeout(() => setSearchFocus(false), 160)}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search Borneo Tracker"
              style={{
                border: 'none',
                outline: 'none',
                flex: 1,
                fontSize: 15,
                fontStyle: 'italic',
                background: 'transparent',
              }}
            />
            <Icons.Search size={20} color={COLORS.muted} />
          </div>
          {searchFocus && (
            <div
              className="bt-fade-in"
              style={{
                marginTop: 8,
                background: '#fff',
                borderRadius: RADII.lg,
                boxShadow: SHADOWS.panel,
                padding: '8px 0',
              }}
            >
              {searchText.trim()
                ? filteredTerritories.map((t) => (
                    <div
                      key={t}
                      onMouseDown={() => {
                        setTerritory(t);
                        mapRef.current?.setView(TERRITORY_CENTERS[t], 7);
                        setSearchText('');
                      }}
                      style={{
                        display: 'flex',
                        gap: 14,
                        alignItems: 'center',
                        padding: '11px 20px',
                        cursor: 'pointer',
                        fontSize: 15,
                        color: COLORS.muted,
                      }}
                    >
                      <Icons.Pin size={20} /> {t}
                    </div>
                  ))
                : SEARCH_SUGGESTIONS.map((sug) => (
                    <div
                      key={sug.label}
                      style={{
                        display: 'flex',
                        gap: 14,
                        alignItems: 'center',
                        padding: '11px 20px',
                        cursor: 'pointer',
                        fontSize: 15,
                        fontStyle: 'italic',
                        color: COLORS.muted,
                      }}
                    >
                      {sug.icon} {sug.label}
                    </div>
                  ))}
            </div>
          )}
        </div>

        {/* ---------- Layer panel ---------- */}
        {layersOpen && (
          <div
            className="bt-fade-in"
            style={{
              position: 'absolute',
              right: 462,
              bottom: 96,
              zIndex: 500,
              background: '#fff',
              borderRadius: RADII.lg,
              boxShadow: SHADOWS.panel,
              padding: '10px 14px',
              width: 230,
            }}
          >
            {OVERLAY_LAYERS.map((l) => (
              <label
                key={l.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 2px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 22 }}>{l.icon}</span>
                <span style={{ flex: 1 }}>{l.label}</span>
                <input
                  type="checkbox"
                  checked={activeOverlays.includes(l.key)}
                  onChange={(e) =>
                    setActiveOverlays((prev) =>
                      e.target.checked ? [...prev, l.key] : prev.filter((k) => k !== l.key),
                    )
                  }
                  style={{ width: 16, height: 16, accentColor: COLORS.blue }}
                />
              </label>
            ))}
          </div>
        )}

        <MapControls mapRef={mapRef} layersOpen={layersOpen} onLayers={() => setLayersOpen((v) => !v)} />

        {/* ---------- Right panel ---------- */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 392,
            zIndex: 450,
            background: 'rgba(233,244,250,0.88)',
            backdropFilter: 'blur(2px)',
            borderRadius: `${RADII.xl}px 0 0 ${RADII.xl}px`,
            padding: '14px 16px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <select
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: RADII.md,
                border: 'none',
                boxShadow: SHADOWS.card,
                fontSize: 13.5,
                fontWeight: 600,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {TERRITORY_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Gauge card */}
          <div
            style={{
              background: '#fff',
              borderRadius: RADII.lg,
              boxShadow: SHADOWS.card,
              padding: '14px 16px 10px',
            }}
          >
            {gauge ? (
              <StatusGauge score={gauge.score} distribution={gauge.distribution} trend={gauge.trend} />
            ) : (
              <div style={{ fontSize: 13, color: COLORS.muted, padding: 12 }}>Loading resilience…</div>
            )}
          </div>

          {/* Hexagon card */}
          <div
            style={{
              background: '#fff',
              borderRadius: RADII.lg,
              boxShadow: SHADOWS.card,
              padding: '14px 12px 6px',
              marginTop: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.25 }}>
              PILLAR PERFORMANCE
              <br />
              <span style={{ fontWeight: 700 }}>(TRUE WEALTH HEXAGON)</span>
            </div>
            {hexPillars ? (
              <HexRadar pillars={hexPillars} />
            ) : (
              <div style={{ fontSize: 13, color: COLORS.muted, padding: 12 }}>Loading…</div>
            )}
          </div>

          {/* ESG indicators */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '18px 2px 10px',
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 800 }}>ESG Indicators</span>
            <select
              value={esgCategory}
              onChange={(e) => {
                if (!user && e.target.value !== 'Environment') return; // locked for public
                setEsgCategory(e.target.value);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: RADII.md,
                border: 'none',
                boxShadow: SHADOWS.card,
                fontSize: 13,
                fontWeight: 600,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {ESG_CATEGORIES.map((c) => (
                <option key={c} value={c} disabled={!user && c !== 'Environment'}>
                  {c}
                  {!user && c !== 'Environment' ? '  🔒' : ''}
                </option>
              ))}
            </select>
          </div>

          {user ? (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {cards.map((c) => (
                  <SparkCard key={c.concept} {...c} />
                ))}
              </div>
              <div
                style={{
                  background: '#fff',
                  borderRadius: RADII.lg,
                  boxShadow: SHADOWS.card,
                  padding: '16px 18px',
                  marginTop: 14,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
                  {esgCategory} Overview
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13.5,
                    padding: '4px 0',
                  }}
                >
                  <span style={{ color: COLORS.muted }}>Environmental Score:</span>
                  <b>68/100</b>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13.5,
                    padding: '4px 0',
                  }}
                >
                  <span style={{ color: COLORS.muted }}>Status:</span>
                  <b>Moderate</b>
                </div>
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <button
                    onClick={() => navigate('/esg')}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: COLORS.blue,
                      fontWeight: 700,
                      fontSize: 13.5,
                    }}
                  >
                    View details →
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {cards.slice(0, 2).map((c) => (
                  <SparkCard key={c.concept} {...c} />
                ))}
              </div>
              {/* Unlock Features card */}
              <div
                style={{
                  background: '#fff',
                  borderRadius: RADII.lg,
                  boxShadow: SHADOWS.card,
                  padding: '34px 26px',
                  marginTop: 14,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 74,
                    height: 74,
                    margin: '0 auto 18px',
                    borderRadius: 16,
                    background: '#5B7FE8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icons.Lock size={40} color="#fff" />
                </div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>Unlock Features</div>
                <div style={{ fontSize: 15, color: '#1D3B63', margin: '10px 0 20px' }}>
                  Log in to access extra Overview features.
                </div>
                <Button onClick={() => navigate('/login')} style={{ width: '75%' }}>
                  Sign In
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
