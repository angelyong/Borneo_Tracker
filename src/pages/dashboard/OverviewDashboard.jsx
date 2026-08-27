import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { GeoJSON, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import {
  CATEGORY_TO_PILLAR,
  LAYER_CONFIG,
  LAYER_GROUPS,
  layerComparability,
  TERRITORIES,
  buildDistrictChoropleth,
  formatValue,
  getDistrictLayerRows,
  getDistrictNameByKey,
  getDistrictParents,
  getDistrictsForParent,
  GDP_PER_CAPITA_USD,
  getHexagonCoverage,
  getLayerRows,
  getRowsForPillar,
  layerColorScale,
  shouldPreserveMapForNoBoundary,
  summarizeRows,
  territoryForParent,
  titleCaseConfidence,
  useBruneiGeo,
  useDistrictGeo,
  useDistricts,
  useIndicators,
  useResilience,
  useResilienceHistory,
} from '../../data/useIndicators';

import L from 'leaflet';

import DataFreshness from '../../components/DataFreshness';
import IntegrityChip from '../../components/IntegrityChip';
import PillarCoverage from '../../components/PillarCoverage';
import ProvenanceChip from '../../components/ProvenanceChip';
import ScoreExplainer from '../../components/ScoreExplainer';
import WeakestLinkBars from '../../components/WeakestLinkBars';
import RagGauge from '../../components/RagGauge';
import MoneyVsResilience from '../../components/MoneyVsResilience';
import HexRadar from '../../components/HexRadar';
import PillarDrilldownModal from '../../components/PillarDrilldownModal';
import { HEXAGON_PILLARS } from '../../components/hexagonPillars';
import AnswerStrip from '../../components/AnswerStrip';
import MomentumBadge, { MomentumMovers, MomentumSummary } from '../../components/MomentumBadge';
import { buildAnswerStrip } from '../../utils/answerStrip';
import { biggestMovers, computeMomentum, movementSummary } from '../../utils/momentum';
import { buildHeadline } from '../../utils/headline';
import { buildAggregateResilience, RESILIENCE_PILLARS } from '../../utils/resiliencePresentation';
import { makeSimulatorHref } from '../../utils/simulatorRoute';

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

const BORNEO_CENTER = [1.5, 114.6];
const DEFAULT_ZOOM = 6;

// SW / NE corners tracing the island itself — Kudat (north tip) to Banjarmasin (south tip)
const BORNEO_BOUNDS = [
  [-4.3, 108.8],
  [6.95, 119.2],
];

const TERRITORY_OPTIONS = ['Overall Borneo', 'Sabah', 'Sarawak', 'Brunei', 'Kalimantan'];
const ESG_CATEGORIES = ['Environment', 'Social', 'Governance'];
const RAG_COLORS = { green: '#16a34a', amber: '#f59e0b', red: '#dc2626' };

const ResizeMap = ({ triggerKey }) => {
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

  useEffect(() => {
    const id = setTimeout(() => {
      map.invalidateSize();
    }, 280);
    return () => clearTimeout(id);
  }, [map, triggerKey]);

  return null;
};

const BORNEO_SHIFT_LEFT_FRACTION = 0.18;

function applyBorneoFit(map) {
  // Fit Borneo (Sabah, Sarawak, Brunei, Kalimantan) centered in the map.
  map.fitBounds(BORNEO_BOUNDS, {
    paddingTopLeft: [40, 90],
    paddingBottomRight: [40, 30],
    animate: false,
  });

  // Nudge slightly left, same zoom.
  const shiftLeft = map.getSize().x * BORNEO_SHIFT_LEFT_FRACTION;
  map.panBy([shiftLeft, 0], { animate: false });

  // Lock this framing as the maximum zoom-out — users can zoom in but not past this.
  map.setMinZoom(map.getZoom());

  // Cap panning to exactly this framing: at the locked-out zoom there's no
  // slack to drag at all; zooming in opens up room to pan within this box only.
  map.setMaxBounds(map.getBounds());
}

const FitBorneoOnLoad = ({ onInitialView }) => {
  const map = useMap();

  useEffect(() => {
    // Defer one tick so the container has its final layout size.
    const id = setTimeout(() => {
      applyBorneoFit(map);
      // Snapshot the exact view the page opened on, so "recenter" can restore
      // this precisely later instead of recomputing a fit (which drifts if the
      // container size at click-time differs from load-time).
      onInitialView?.({ center: map.getCenter(), zoom: map.getZoom() });
    }, 250);
    return () => clearTimeout(id);
  }, [map, onInitialView]);

  return null;
};

// District-mode camera. District mode opens on the whole Borneo island; the map
// only flies to a district once the user actively selects one (dropdown or map
// click, via `zoomToDistrict`). Leaving district mode restores the Borneo framing.
// Right padding keeps the focus in the map area, not hidden behind the panel.
const MapFocus = ({ geo, parent, selectedKey, isDistrict, zoomToDistrict, boundaryUnavailable, panelWidth }) => {
  const map = useMap();
  const wasDistrict = useRef(false);
  const previousParent = useRef(null);
  const rightPad = (panelWidth || 360) + 40;

  useEffect(() => {
    if (!isDistrict) {
      if (wasDistrict.current) {
        wasDistrict.current = false;
        previousParent.current = null;
        applyBorneoFit(map);
      }
      return;
    }

    const enteringDistrict = !wasDistrict.current;
    const parentChanged = !enteringDistrict && previousParent.current !== parent;
    wasDistrict.current = true;
    previousParent.current = parent;
    // Unlock the Borneo-wide zoom/pan clamp so we can zoom into a district.
    map.setMinZoom(5);
    map.setMaxBounds(null);

    // The data artifact can honestly retain a district before a licensed,
    // verified boundary exists. Do not recenter or imply a selectable polygon
    // when that district is explicitly marked as not mappable. Entering District
    // mode still starts at the Borneo overview; later no-geometry selections
    // leave the user's current map context intact.
    if (shouldPreserveMapForNoBoundary({ boundaryUnavailable, enteringDistrict, parentChanged })) return;

    // Zoom to the chosen district only after an explicit selection.
    if (zoomToDistrict && selectedKey && geo) {
      const sel = geo.features.filter(
        (f) => f.properties.parent === parent && f.properties.key === selectedKey
      );
      if (sel.length) {
        const bounds = L.geoJSON({ type: 'FeatureCollection', features: sel }).getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            paddingTopLeft: [50, 70],
            paddingBottomRight: [rightPad, 40],
            maxZoom: 10,
            animate: true,
          });
          return;
        }
      }
    }

    // Default district-mode view: the whole Borneo island.
    map.fitBounds(BORNEO_BOUNDS, {
      paddingTopLeft: [40, 80],
      paddingBottomRight: [rightPad, 30],
      animate: true,
    });
  }, [map, geo, parent, selectedKey, isDistrict, zoomToDistrict, boundaryUnavailable, rightPad]);

  return null;
};

// A layer's on-screen name comes from its `labelKey` everywhere. Reading
// `config.label` in one place and deriving the name from the object key in
// another let the picker and the legend disagree about the same layer.
const layerLabel = (t, key) =>
  (LAYER_CONFIG[key]?.labelKey ? t(LAYER_CONFIG[key].labelKey) : null) || LAYER_CONFIG[key]?.label || key;

// RagGauge moved to src/components/RagGauge.jsx (imported above) to de-duplicate —
// the Impact Simulator reuses the same shared component (IS-3C).
// HexRadar moved to src/components/HexRadar.jsx (imported above) to de-duplicate —
// Regional_Detail renders the same shared component.

const OverviewDashboard = () => {
  const { t } = useTranslation();
  const { isChatbotOpen = false, openChatbot } = useOutletContext() || {};
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIdx, setSearchActiveIdx] = useState(0);
  const [activeLayer, setActiveLayer] = useState('deforestation');
  const [panelTerritory, setPanelTerritory] = useState('Overall Borneo');
  const [esgCategory, setEsgCategory] = useState('Environment');
  const [panelWidth, setPanelWidth] = useState(460);
  const [drilldownPillar, setDrilldownPillar] = useState(null);

  // Region vs District drill-down. `level` toggles the whole panel between the
  // 4-territory view (indicators.json) and the ADM2 district view (districts.json).
  const [level, setLevel] = useState('region');
  const [districtParent, setDistrictParent] = useState('Sabah');
  const [districtSel, setDistrictSel] = useState('');
  // Only zoom the map into a district once the user actively picks one; entering
  // district mode (or switching province) keeps the whole-Borneo overview.
  const [zoomToDistrict, setZoomToDistrict] = useState(false);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const initialViewRef = useRef(null);

  const { data, loading, error, generatedAt } = useIndicators();
  const { data: resilience } = useResilience();
  const { data: resilienceHistory } = useResilienceHistory();
  const { data: districtData, loading: districtLoading, generatedAt: districtGeneratedAt } = useDistricts();
  const { data: districtGeo } = useDistrictGeo();
  const { data: bruneiGeo } = useBruneiGeo();

  const isDistrict = level === 'district';
  const districtParents = useMemo(() => getDistrictParents(districtData), [districtData]);
  const districtOptions = useMemo(
    () => getDistrictsForParent(districtData, districtParent),
    [districtData, districtParent]
  );

  // Derive the effective district (falling back to the first available) rather than
  // syncing state in an effect — avoids cascading renders and keeps the <select>
  // controlled even right after the parent changes.
  const district = districtOptions.includes(districtSel) ? districtSel : districtOptions[0] || '';

  // `has_geometry: false` / `no_geometry` is an Ethics (E) contract from the
  // data pipeline: retain the observed district data, but never imply that a
  // boundary polygon exists. Older artifacts which predate the field retain
  // their existing map behaviour until the refreshed artifact is available.
  const districtOptionDetails = useMemo(
    () =>
      districtOptions.map((name) => {
        const row = (districtData?.rows || []).find(
          (entry) => entry.parent === districtParent && entry.territory === name
        );
        const boundaryUnavailable = row?.has_geometry === false || row?.geometry_status === 'no_geometry';
        return { name, boundaryUnavailable };
      }),
    [districtOptions, districtData, districtParent]
  );

  // The active scope feeding every panel card: district rows + name in district
  // mode, else the territory rows + selected territory.
  const scopeRows = useMemo(
    () => (isDistrict ? districtData?.rows || [] : data?.rows || []),
    [isDistrict, districtData, data]
  );
  const scopeName = isDistrict ? district : panelTerritory;
  const isOverall = !isDistrict && panelTerritory === 'Overall Borneo';

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  const handleInitialView = useCallback((view) => {
    initialViewRef.current = view;
  }, []);

  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (initialViewRef.current) {
      // Restore the exact view captured on first load — not a recomputed fit,
      // which can land somewhere slightly different if the container size at
      // click-time doesn't match load-time.
      map.setView(initialViewRef.current.center, initialViewRef.current.zoom, { animate: true });
    } else {
      applyBorneoFit(map);
    }
  }, []);

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
        const newWidth = Math.min(640, Math.max(300, startW.current + delta));
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
    return getLayerRows(data.rows, activeLayer);
  }, [activeLayer, data]);

  const colorForValue = useMemo(() => layerColorScale(layerEntries, activeLayer), [activeLayer, layerEntries]);

  // A choropleth asserts that the four numbers mean the same thing. When they
  // do not, say which way they differ rather than letting the colours imply a
  // ranking the data cannot support.
  const layerCompare = useMemo(
    () => (isDistrict ? null : layerComparability(layerEntries, activeLayer)),
    [activeLayer, isDistrict, layerEntries]
  );

  // Region-mode fill: colour each of the 4 territories by the active layer's value,
  // reusing the same relative RAG scale the circle markers used. Boundary polygons
  // are keyed by province, so each province rolls up to its parent territory.
  const territoryFill = useMemo(() => {
    const byTerritory = {};
    layerEntries.forEach(({ territory, row }) => {
      const value = row?.value;
      byTerritory[territory] = {
        row: row || null,
        color: Number.isFinite(value) ? colorForValue(value) : null,
      };
    });
    return byTerritory;
  }, [layerEntries, colorForValue]);

  const styleTerritoryFeature = useCallback(
    (feature) => {
      const territory = territoryForParent(feature.properties?.parent);
      const fill = territoryFill[territory]?.color;
      const hasData = !!fill;
      // Stroke matches the fill so internal province/district seams vanish and each
      // territory reads as one solid shape; neighbouring territories still separate
      // wherever their colours differ.
      return {
        fillColor: fill || '#94a3b8',
        color: fill || '#94a3b8',
        weight: 1,
        fillOpacity: hasData ? 0.72 : 0.28,
        dashArray: hasData ? null : '2 3',
      };
    },
    [territoryFill]
  );

  const onEachTerritoryFeature = useCallback(
    (feature, layer) => {
      const territory = territoryForParent(feature.properties?.parent);
      const entry = territoryFill[territory];
      const valueText = entry?.row ? formatValue(entry.row) : 'No data for this layer';
      layer.bindTooltip(
        `<strong>${territory}</strong><br/>${layerLabel(t, activeLayer)}<br/>${valueText}`,
        { direction: 'top', sticky: true }
      );
    },
    [territoryFill, activeLayer, t]
  );

  // Floating value labels pinned at each territory centre (the demo's "pills").
  const territoryLabels = useMemo(() => {
    return layerEntries
      .map(({ territory, row }) => {
        const center = TERRITORY_CENTERS[territory];
        if (!center) return null;
        const valueText = row ? formatValue(row) : 'No data';
        const icon = L.divIcon({
          className: '',
          html:
            `<div style="transform:translate(-50%,-50%);display:inline-block;white-space:nowrap;` +
            `background:#ffffff;border:1px solid #e3e9e5;border-radius:7px;padding:2px 8px;` +
            `font:600 11px/1.25 Inter,Arial,sans-serif;color:#1f2937;` +
            `box-shadow:0 1px 5px rgba(15,23,42,0.22);">${territory} · ${valueText}</div>`,
          iconSize: [0, 0],
        });
        return { territory, center, icon };
      })
      .filter(Boolean);
  }, [layerEntries]);

  // On-map legend scale for the active layer (green = better end, red = worse).
  const legendScale = useMemo(() => {
    const better = LAYER_CONFIG[activeLayer]?.better;
    return [
      { label: better === 'higher' ? 'Higher (better)' : 'Lower (better)', color: RAG_COLORS.green },
      { label: 'Middle', color: RAG_COLORS.amber },
      { label: better === 'higher' ? 'Lower (worse)' : 'Higher (worse)', color: RAG_COLORS.red },
    ];
  }, [activeLayer]);

  // District choropleth/list entries for the active layer, under the current parent.
  const districtLayerEntries = useMemo(() => {
    if (!isDistrict || !districtData?.rows) return [];
    return getDistrictLayerRows(districtData.rows, districtParent, activeLayer);
  }, [isDistrict, districtData, districtParent, activeLayer]);

  // Choropleth colouring for the district polygons, by the active layer.
  const choropleth = useMemo(
    () => (districtData?.rows ? buildDistrictChoropleth(districtData.rows, activeLayer) : null),
    [districtData, activeLayer]
  );

  // The join key of the currently-selected district — used to highlight it and to
  // focus the map. Matching by key (not name) also fixes Indonesian districts whose
  // BPS name differs from the GADM polygon name.
  const selectedKey = useMemo(() => {
    const row = (districtData?.rows || []).find(
      (r) => r.parent === districtParent && r.territory === district
    );
    return row?.key || null;
  }, [districtData, districtParent, district]);

  const selectedDistrictBoundaryUnavailable = useMemo(() => {
    if (!selectedKey) return false;
    const selectedRow = (districtData?.rows || []).find(
      (row) => row.parent === districtParent && row.key === selectedKey
    );
    if (selectedRow?.has_geometry === false || selectedRow?.geometry_status === 'no_geometry') return true;

    // A mismatched boundary file is also not a valid map capability. Once the
    // GeoJSON is loaded, reflect that safely instead of attempting a false fly-to.
    return Boolean(
      districtGeo?.features &&
        !districtGeo.features.some(
          (feature) => feature.properties?.parent === districtParent && feature.properties?.key === selectedKey
        )
    );
  }, [districtData, districtGeo, districtParent, selectedKey]);

  // Global place index for the locator search: the 4 top-level regions plus every
  // district across every province. Districts come from the deduped `parents` map,
  // so each name appears once regardless of how many indicator rows it has.
  const placeIndex = useMemo(() => {
    const regions = TERRITORIES.map((name) => ({ type: 'region', name, parent: null }));
    const districts = [];
    const parents = districtData?.parents || {};
    Object.keys(parents).forEach((parentName) => {
      (parents[parentName] || []).forEach((name) => {
        districts.push({ type: 'district', name, parent: parentName });
      });
    });
    return [...regions, ...districts];
  }, [districtData]);

  // Ranked matches for the current query: name match first (exact > prefix >
  // substring), then province-name match; regions before districts on ties.
  const searchMatches = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    const rank = (item) => {
      const name = item.name.toLowerCase();
      if (name === q) return 0;
      if (name.startsWith(q)) return 1;
      if (name.includes(q)) return 2;
      return 3; // matched on province name only
    };
    return placeIndex
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.parent && item.parent.toLowerCase().includes(q))
      )
      .map((item) => ({ item, r: rank(item) }))
      .sort((a, b) => {
        if (a.r !== b.r) return a.r - b.r;
        if (a.item.type !== b.item.type) return a.item.type === 'region' ? -1 : 1;
        return a.item.name.localeCompare(b.item.name);
      })
      .slice(0, 8)
      .map((entry) => entry.item);
  }, [placeIndex, searchText]);

  // Fly the map to the picked place and drive the panel / drill-down to match,
  // reusing the exact state contract the polygon-click and dropdown pickers use.
  const handleSelectPlace = useCallback(
    (item) => {
      if (!item) return;
      if (item.type === 'region') {
        const wasRegion = level === 'region';
        setLevel('region');
        setPanelTerritory(item.name);
        const center = TERRITORY_CENTERS[item.name];
        // Only fly while already in region mode: leaving district mode lets MapFocus
        // restore the whole-island framing, which would override an immediate flyTo.
        if (center && wasRegion) mapRef.current?.flyTo(center, 7, { duration: 0.8 });
      } else {
        const destination = (districtData?.rows || []).find(
          (row) => row.parent === item.parent && row.territory === item.name
        );
        const boundaryUnavailable =
          destination?.has_geometry === false || destination?.geometry_status === 'no_geometry';
        setLevel('district');
        setDistrictParent(item.parent);
        setDistrictSel(item.name);
        setZoomToDistrict(!boundaryUnavailable); // only fly when a boundary is available
      }
      setSearchText(item.name);
      setSearchOpen(false);
    },
    [districtData, level]
  );

  // Close the suggestions dropdown when clicking outside the search box.
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onDocMouseDown = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [searchOpen]);

  const onSearchKeyDown = useCallback(
    (e) => {
      if (!searchMatches.length) {
        if (e.key === 'Enter' && searchText.trim()) {
          e.preventDefault();
          openChatbot?.(t('dashboard.botSearchPrompt', { query: searchText.trim() }));
          setSearchOpen(false);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSearchOpen(true);
        setSearchActiveIdx((i) => (i + 1) % searchMatches.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSearchActiveIdx((i) => (i - 1 + searchMatches.length) % searchMatches.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectPlace(searchMatches[searchActiveIdx] || searchMatches[0]);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    },
    [searchMatches, searchActiveIdx, handleSelectPlace, openChatbot, searchText, t]
  );

  const styleDistrict = useCallback(
    (feature) => {
      const props = feature.properties;

      // The selected district gets a distinct SELECTION colour (blue) + bold outline,
      // so it stands out from the red/amber/green data colouring of every other district.
      if (props.parent === districtParent && props.key === selectedKey) {
        return { fillColor: '#2563eb', fillOpacity: 0.85, color: '#0b1220', weight: 3.5 };
      }

      const color = choropleth?.colorFor(props.parent, props.key);
      const hasData = !!color;
      return {
        fillColor: color || '#94a3b8',
        fillOpacity: hasData ? 0.72 : 0.3,
        color: '#ffffff',
        weight: 0.8,
        dashArray: hasData ? null : '2 3',
      };
    },
    [choropleth, districtParent, selectedKey]
  );

  const onEachDistrict = useCallback(
    (feature, layer) => {
      const props = feature.properties;
      const row = choropleth?.rowFor(props.parent, props.key);
      const valueText = row ? formatValue(row) : 'No data for this layer';
      layer.bindTooltip(`<strong>${props.name}</strong><br/>${props.parent}<br/>${valueText}`, {
        direction: 'top',
        sticky: true,
      });
      layer.on('click', () => {
        setDistrictParent(props.parent);
        const canonical =
          getDistrictNameByKey(districtData?.rows || [], props.parent, props.key) || props.name;
        setDistrictSel(canonical);
        setZoomToDistrict(true); // explicit pick -> fly to it
      });
      // Lift the selected polygon above its neighbours so its bold outline shows.
      if (props.parent === districtParent && props.key === selectedKey) {
        layer.bringToFront();
      }
    },
    [choropleth, districtData, districtParent, selectedKey]
  );

  const resilienceView = useMemo(() => {
    // Resilience Index is only computed at territory level (6 pillars). Districts
    // don't have full pillar coverage, so we surface an honest note instead.
    if (isDistrict) return { unavailable: true };

    if (!resilience?.territories) return null;

    const thresholds = resilience.ragThresholds || { green: 70, amber: 40 };

    if (!isOverall) {
      const territory = resilience.territories[panelTerritory];

      if (!territory || !Number.isFinite(territory.index)) return null;

      return {
        index: territory.index,
        rag: territory.rag,
        indexStrict: territory.indexStrict,
        ragStrict: territory.ragStrict,
        weakestPillar: territory.weakestPillar,
        pillarScores: territory.pillarScores,
        scoredPillars: territory.scoredPillars || Object.keys(territory.pillarScores || {}),
        unscoredPillars: territory.unscoredPillars || [],
        thresholds,
        isAggregate: false,
      };
    }

    return buildAggregateResilience(resilience.territories, thresholds);
  }, [isDistrict, isOverall, panelTerritory, resilience]);

  // BT-07 consumes the exact scope presentation already prepared above. It
  // must not duplicate index, RAG, or aggregate calculation in the headline.
  const headline = useMemo(
    () => (resilienceView?.unavailable ? null : buildHeadline(resilienceView)),
    [resilienceView]
  );

  // BT-19. A district has no series and all-Borneo has no aggregate series, so
  // only a single territory gets a badge; the aggregate scope names the
  // territories that moved instead of averaging four histories into a new one.
  const momentum = useMemo(
    () =>
      isDistrict || isOverall || !resilienceHistory?.territories
        ? null
        : computeMomentum(resilienceHistory.territories[panelTerritory]),
    [isDistrict, isOverall, panelTerritory, resilienceHistory]
  );

  // The client asked for score -> direction -> biggest movers as one sequence,
  // so the movers list is not an alternative to the badge: every scope that has
  // a score shows it, beneath whichever direction reading that scope supports.
  const movers = useMemo(
    () => (isDistrict || !resilienceHistory?.territories ? null : biggestMovers(resilienceHistory)),
    [isDistrict, resilienceHistory]
  );

  // Only the aggregate scope needs the direction counts; a single territory
  // states its own delta in the badge above.
  const movementCounts = useMemo(
    () => (isDistrict || !isOverall || !resilienceHistory?.territories ? null : movementSummary(resilienceHistory)),
    [isDistrict, isOverall, resilienceHistory]
  );

  // BT-22. The strip owns what/where/why/what-next for this scope, so the
  // headline and the simulator CTA are rendered through it rather than twice.
  // The aggregate scope resolves its own deep link from the weakest territory,
  // which `simulatorHref` above deliberately refuses to do for a Borneo-wide
  // average.
  const answerStrip = useMemo(() => {
    if (isDistrict || !headline) return null;
    return buildAnswerStrip({
      headline,
      isAggregate: Boolean(resilienceView?.isAggregate),
      territory: isOverall ? null : panelTerritory,
      territories: resilience?.territories || null,
      weakestPillar: resilienceView?.weakestPillar || null,
      pillarScores: resilienceView?.pillarScores || null,
      makeHref: makeSimulatorHref,
    });
  }, [headline, isDistrict, isOverall, panelTerritory, resilience, resilienceView]);

  const hexCoverage = useMemo(() => {
    if (isDistrict) {
      return scopeName ? getHexagonCoverage(scopeRows, scopeName) : null;
    }

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
  }, [data, isDistrict, isOverall, panelTerritory, scopeRows, scopeName]);

  // Real 0-100 pillar scores for the territory radar. Missing scores deliberately
  // remain null: HexRadar keeps all six axes and labels the gap rather than
  // inventing a zero. Districts have no resilience scores.
  const hexScores = useMemo(() => {
    if (isDistrict) return null;
    const ps = resilienceView?.pillarScores;
    if (!ps) return null;
    const out = {};
    HEXAGON_PILLARS.forEach((pillar) => {
      out[pillar] = Number.isFinite(ps[pillar]) ? ps[pillar] : null;
    });
    return out;
  }, [isDistrict, resilienceView]);

  const drilldownTerritory = !isDistrict && !isOverall ? panelTerritory : t('dashboard.overallBorneo');

  // BT-34. The all-Borneo pillar score is the mean of the four territory pillar
  // scores, and each of those territories already publishes the indicators
  // behind it — so the aggregate has four source lists, not none. Flattening
  // them answers the client's "drill into the underlying indicators" on the
  // scope the Dashboard actually opens on, and shows the arithmetic behind a
  // number a reader otherwise cannot account for.
  // BT-35. A district carries the indicators behind whichever pillars it has
  // data for -- two of six, and only in Kalimantan, because Malaysian district
  // pillar rows are not ingested yet (BT-36). They were unreachable because the
  // district radar was mounted without onPillarSelect.
  const districtDrilldownIndicators = useMemo(() => {
    if (!isDistrict || !drilldownPillar || !scopeName) return [];
    return (scopeRows || []).filter(
      (row) => row.canonical === 1 && row.hexagon_pillar === drilldownPillar
    );
  }, [drilldownPillar, isDistrict, scopeName, scopeRows]);

  const drilldownIndicators = useMemo(() => {
    if (isDistrict || !drilldownPillar) return [];
    if (!isOverall) return resilience?.territories?.[panelTerritory]?.detail?.[drilldownPillar] || [];

    return TERRITORIES.flatMap((territory) => {
      const entry = resilience?.territories?.[territory];
      // A territory with no score for this pillar contributes no rows and is
      // absent from the mean; it must not appear as a zero.
      if (!Number.isFinite(entry?.pillarScores?.[drilldownPillar])) return [];
      return (entry?.detail?.[drilldownPillar] || []).map((row) => ({ ...row, territory }));
    });
  }, [drilldownPillar, isDistrict, isOverall, panelTerritory, resilience]);

  // Pre-formatted "Sabah 61.0" parts for the method line under the list. Only
  // the aggregate scope has an average to explain.
  const drilldownContributors = useMemo(() => {
    if (isDistrict || !isOverall || !drilldownPillar) return null;
    const parts = TERRITORIES.map((territory) => {
      const score = resilience?.territories?.[territory]?.pillarScores?.[drilldownPillar];
      return Number.isFinite(score) ? `${territory} ${score}` : null;
    }).filter(Boolean);
    return parts.length ? parts : null;
  }, [drilldownPillar, isDistrict, isOverall, resilience]);

  const openPillarDrilldown = useCallback((pillar) => {
    setDrilldownPillar(pillar);
  }, []);

  // True when the hexagon has at least one scored pillar (districts often don't).
  // The district radar plots indicator COUNTS on geometry built for 0-100
  // scores. getHexagonCoverage is a counter and returning 0 for "no rows" is
  // correct there, but feeding those zeros to HexRadar makes every axis look
  // scored: `values.every(Number.isFinite)` becomes true, so a filled polygon
  // is drawn, and with no `max` the scale auto-fits the largest count -- one
  // indicator then renders at the same full radius as a score of 100.
  // A pillar with zero indicators is missing data, not a measured zero, so it
  // is passed as null and picks up the same "never imputed" treatment the
  // territory radar uses.
  const districtCoverageAxes = useMemo(() => {
    if (!isDistrict || !hexCoverage) return null;
    return Object.fromEntries(
      Object.entries(hexCoverage).map(([pillar, count]) => [pillar, count > 0 ? count : null])
    );
  }, [hexCoverage, isDistrict]);

  // Counts have no meaningful magnitude on a radar, so the axis scale is
  // pinned to the highest count present rather than auto-fitting per district,
  // which would otherwise make two districts with different coverage look the
  // same.
  const districtCoverageMax = useMemo(() => {
    const counts = Object.values(hexCoverage || {}).filter((count) => Number.isFinite(count));
    return counts.length ? Math.max(...counts, 1) : 1;
  }, [hexCoverage]);

  const hasHexCoverage = useMemo(
    () => !!hexCoverage && Object.values(hexCoverage).some((count) => count > 0),
    [hexCoverage]
  );

  const esgCard = useMemo(() => {
    const pillar = CATEGORY_TO_PILLAR[esgCategory];

    if (isDistrict) {
      if (!scopeName) return null;
      const rows = getRowsForPillar(scopeRows, scopeName, pillar);
      const summary = summarizeRows(rows);
      return {
        label: `${esgCategory} · ${scopeName}`,
        meta: `${summary.count} indicator${summary.count === 1 ? '' : 's'} · latest ${summary.latestYear ?? '—'}`,
        items: rows.slice(0, 4).map((row) => ({ k: row.indicator, v: formatValue(row) })),
      };
    }

    if (!data?.rows) return null;

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
  }, [data, esgCategory, isDistrict, isOverall, panelTerritory, scopeRows, scopeName]);

  return (
    <div style={styles.root}>
      <div style={styles.mapWrapper}>
        <div style={styles.searchContainer} ref={searchRef}>
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder={t('dashboard.searchPlaceholder')}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setSearchOpen(true);
                setSearchActiveIdx(0);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={onSearchKeyDown}
              style={styles.searchInput}
            />
            {searchText && (
              <button
                type="button"
                aria-label={t('dashboard.clearSearch')}
                onClick={() => {
                  setSearchText('');
                  setSearchOpen(false);
                }}
                style={styles.searchClear}
              >
                ×
              </button>
            )}
          </div>

          {searchOpen && searchText.trim() && (
            <ul style={styles.searchDropdown}>
              {searchMatches.length ? (
                searchMatches.map((item, idx) => (
                  <li
                    key={`${item.type}-${item.parent || ''}-${item.name}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectPlace(item);
                    }}
                    onMouseEnter={() => setSearchActiveIdx(idx)}
                    style={{
                      ...styles.searchOption,
                      ...(idx === searchActiveIdx ? styles.searchOptionActive : {}),
                    }}
                  >
                    <span style={styles.searchOptionMain}>
                      <span style={styles.searchOptionName}>{item.name}</span>
                      {item.type === 'district' && (
                        <span style={styles.searchOptionParent}>{item.parent}</span>
                      )}
                    </span>
                    <span
                      style={{
                        ...styles.searchOptionTag,
                        ...(item.type === 'region'
                          ? styles.searchOptionTagRegion
                          : styles.searchOptionTagDistrict),
                      }}
                    >
                      {item.type === 'region' ? t('dashboard.region') : t('dashboard.district')}
                    </span>
                  </li>
                ))
              ) : (
                <li style={styles.searchEmpty}>
                  <span>{t('dashboard.noPlacesMatch', { query: searchText.trim() })}</span>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      openChatbot?.(t('dashboard.botSearchPrompt', { query: searchText.trim() }));
                      setSearchOpen(false);
                    }}
                    style={styles.searchBotButton}
                  >
                    {t('dashboard.askBorneoBot')}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>

        <MapContainer
          ref={mapRef}
          center={BORNEO_CENTER}
          zoom={DEFAULT_ZOOM}
          style={styles.map}
          zoomControl={false}
          maxBoundsViscosity={1.0}
        >
          <ResizeMap triggerKey={isChatbotOpen} />
          <FitBorneoOnLoad onInitialView={handleInitialView} />
          <MapFocus
            geo={districtGeo}
            parent={districtParent}
            selectedKey={selectedKey}
            isDistrict={isDistrict}
            zoomToDistrict={zoomToDistrict}
            boundaryUnavailable={selectedDistrictBoundaryUnavailable}
            panelWidth={panelWidth}
          />

          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {isDistrict && districtGeo && (
            <GeoJSON
              key={`districts-${activeLayer}-${districtParent}-${district}`}
              data={districtGeo}
              style={styleDistrict}
              onEachFeature={onEachDistrict}
            />
          )}

          {/* Region mode: fill each of the 4 territories by the active layer's value.
              District polygons (Sabah/Sarawak/Kalimantan) plus Brunei's own outline. */}
          {!isDistrict && districtGeo && (
            <GeoJSON
              key={`region-fill-${activeLayer}`}
              data={districtGeo}
              style={styleTerritoryFeature}
              onEachFeature={onEachTerritoryFeature}
            />
          )}

          {!isDistrict && bruneiGeo && (
            <GeoJSON
              key={`region-brunei-${activeLayer}`}
              data={bruneiGeo}
              style={styleTerritoryFeature}
              onEachFeature={onEachTerritoryFeature}
            />
          )}

          {!isDistrict &&
            territoryLabels.map(({ territory, center, icon }) => (
              <Marker
                key={`label-${territory}`}
                position={center}
                icon={icon}
                interactive={false}
                keyboard={false}
              />
            ))}
        </MapContainer>

        <div style={{ ...styles.mapControls, right: panelWidth + 32 }}>
          <button type="button" onClick={handleZoomIn} style={styles.mapControlBtn} title={t('dashboard.zoomIn')} aria-label={t('dashboard.zoomIn')}>
            +
          </button>
          <button type="button" onClick={handleZoomOut} style={styles.mapControlBtn} title={t('dashboard.zoomOut')} aria-label={t('dashboard.zoomOut')}>
            −
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            style={{ ...styles.mapControlBtn, ...styles.mapControlBtnLast }}
            title={t('dashboard.recenterMap')}
            aria-label={t('dashboard.recenterMap')}
          >
            ⟲
          </button>
        </div>

        <div style={styles.mapLegend}>
          <div style={styles.mapLegendTitle}>{activeLayer ? layerLabel(t, activeLayer) : t('dashboard.layer')}</div>
          <div style={styles.mapLegendSub}>
            {isDistrict ? t('dashboard.acrossDistricts', { parent: districtParent }) : t('dashboard.colouredAcrossRegions')}
          </div>
          {legendScale.map((item) => (
            <div key={item.label} style={styles.mapLegendRow}>
              <span style={{ ...styles.mapLegendDot, background: item.color }} />
              <span style={styles.mapLegendLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...styles.panel, width: panelWidth, minWidth: panelWidth }}>
        <div onMouseDown={onDragStart} style={styles.dragHandle} title={t('dashboard.dragToResizePanel')}>
          <div style={styles.dragGrip} />
        </div>

        <div style={styles.panelDropdownRow}>
          <div style={styles.levelToggle}>
            <button
              type="button"
              onClick={() => setLevel('region')}
              style={{ ...styles.levelBtn, ...(!isDistrict ? styles.levelBtnActive : {}) }}
            >
              {t('dashboard.region')}
            </button>
            <button
              type="button"
              onClick={() => {
                setLevel('district');
                setZoomToDistrict(false); // open on the whole Borneo island
              }}
              style={{ ...styles.levelBtn, ...(isDistrict ? styles.levelBtnActive : {}) }}
            >
              {t('dashboard.district')}
            </button>
          </div>

          {isDistrict ? (
            <div style={styles.cascadeWrap}>
              <select
                value={districtParent}
                onChange={(e) => {
                  setDistrictParent(e.target.value);
                  setZoomToDistrict(false); // province switch -> back to island overview
                }}
                style={{ ...styles.panelDropdown, ...styles.cascadeSelect }}
              >
                {districtParents.map((parent) => (
                  <option key={parent} value={parent}>
                    {parent}
                  </option>
                ))}
              </select>
              <select
                value={district}
                onChange={(e) => {
                  setDistrictSel(e.target.value);
                  const option = districtOptionDetails.find((item) => item.name === e.target.value);
                  setZoomToDistrict(!option?.boundaryUnavailable); // never promise a missing boundary
                }}
                style={{ ...styles.panelDropdown, ...styles.cascadeSelect }}
              >
                {districtOptionDetails.map(({ name, boundaryUnavailable }) => (
                  <option key={name} value={name}>
                    {name}
                    {boundaryUnavailable ? ` — ${t('dashboard.boundaryUnavailableOption')}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
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
          )}
        </div>

        {isDistrict && selectedDistrictBoundaryUnavailable && (
          <div role="status" style={styles.districtBoundaryNotice}>
            {t('dashboard.districtBoundaryUnavailable', {
              district,
              parent: districtParent,
            })}
          </div>
        )}

        {/* District mode reads districts.json, which rebuilds on its own slower
            cadence — show that file's own date so the gap stays visible. */}
        {/* Two different trust claims, deliberately side by side: DataFreshness
            says how OLD this snapshot is, IntegrityChip says whether it has been
            ALTERED since it was published. Neither substitutes for the other. */}
        <div style={styles.freshnessRow}>
          <DataFreshness
            generatedAt={isDistrict ? districtGeneratedAt : generatedAt}
            loading={isDistrict ? districtLoading : loading}
            artifact={isDistrict ? districtData : data}
          />
          <IntegrityChip />
        </div>

        <div style={styles.card}>
          <div style={styles.sectionTitle}>{t('dashboard.overallResilienceStatus')}</div>

          {resilienceView?.unavailable ? (
            <div style={styles.stateText}>
              {t('dashboard.resilienceDistrictNotice', { district: districtParent })}
            </div>
          ) : resilienceView ? (
            <>
              <RagGauge score={resilienceView.index} thresholds={resilienceView.thresholds} />

              <div style={styles.gaugeLegend}>
                {[
                  {
                    label: t('dashboard.poor', { value: resilienceView.thresholds.amber }),
                    color: RAG_COLORS.red,
                  },
                  {
                    label: t('dashboard.moderate', {
                      low: resilienceView.thresholds.amber,
                      high: resilienceView.thresholds.green,
                    }),
                    color: RAG_COLORS.amber,
                  },
                  {
                    label: t('dashboard.good', { value: resilienceView.thresholds.green }),
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
                <span style={styles.scoreMeta}>
                  <span style={styles.scoreCaption}>{t('dashboard.resilienceIndexCaption')}</span>
                  {resilienceView.rag && (
                    <span
                      style={{ ...styles.ragStatus, color: RAG_COLORS[resilienceView.rag] }}
                      aria-label={t('dashboard.indexStatus', { band: t(`dashboard.ragBand_${resilienceView.rag}`) })}
                    >
                      <span aria-hidden="true">●</span> {t(`dashboard.ragBand_${resilienceView.rag}`)}
                    </span>
                  )}
                </span>
              </div>

              {momentum ? <MomentumBadge momentum={momentum} style={styles.momentumRow} /> : null}
              {movementCounts ? <MomentumSummary summary={movementCounts} style={styles.momentumRow} /> : null}
              {movers ? <MomentumMovers movers={movers} style={styles.momentumRow} /> : null}

              {answerStrip && <AnswerStrip strip={answerStrip} />}

              {Number.isFinite(resilienceView.indexStrict) && (
                <div style={styles.trendRow}>
                  <span style={styles.trendLabel}>
                    {t('dashboard.strictTrueResilience')}{' '}
                    <b style={{ color: RAG_COLORS[resilienceView.ragStrict] || 'inherit' }}>
                      {resilienceView.indexStrict}
                    </b>{' '}
                    {resilienceView.ragStrict && (
                      <span style={{ ...styles.ragStatusInline, color: RAG_COLORS[resilienceView.ragStrict] }}>
                        <span aria-hidden="true">●</span> {t(`dashboard.ragBand_${resilienceView.ragStrict}`)}
                      </span>
                    )}{' '}
                    · {t('dashboard.fragilityGap')} {resilienceView.index >= resilienceView.indexStrict ? '−' : '+'}
                    {Math.abs(Math.round((resilienceView.index - resilienceView.indexStrict) * 10) / 10)}
                  </span>
                  {/* Client §1.2: the second score must be explained where it is
                      shown. Click-to-open rather than a hover tooltip, so the
                      explanation is reachable on touch and by keyboard. */}
                  <ScoreExplainer labelKey="scoreExplainer.strictOpenLabel" />
                </div>
              )}

              <div style={styles.trendRow}>
                {resilienceView.isAggregate ? (
                  <span style={styles.trendLabel}>
                    {t('dashboard.aggregateCoverageByPillar', {
                      coverage: RESILIENCE_PILLARS.map(
                        (pillar) => `${pillar} ${resilienceView.pillarCoverage[pillar]?.contributorCount || 0}/${resilienceView.pillarCoverage[pillar]?.denominator || 0}`
                      ).join(' · '),
                    })}{' '}
                    {t(`dashboard.${resilienceView.aggregateCoverageStatus}`, {
                      count: resilienceView.scoredTerritoryCount,
                      partialPillars: resilienceView.partialContributorPillars.join(', '),
                      unscoredPillars: resilienceView.unscoredPillars.join(', '),
                    })}
                  </span>
                ) : resilienceView.unscoredPillars.length ? (
                  <span style={styles.trendLabel}>
                    {t('dashboard.territoryCoveragePartial', {
                      scored: resilienceView.scoredPillars.length,
                      pillars: resilienceView.unscoredPillars.join(', '),
                    })}
                  </span>
                ) : (
                  <span style={styles.trendLabel}>
                    {t('dashboard.territoryCoverageFull', { scored: resilienceView.scoredPillars.length })}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div style={styles.stateText}>{t('dashboard.loadingResilienceScores')}</div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.sectionTitle}>{isDistrict ? t('dashboard.pillarCoverage') : t('dashboard.resilienceByPillar')}</div>
          <div style={styles.sectionSubtitle}>
            {isDistrict
              ? t('dashboard.hexagonSubDistrict')
              : t('dashboard.hexagonSubRegion')}
          </div>

          {isDistrict ? (
            hasHexCoverage ? (
              <HexRadar
                pillars={districtCoverageAxes}
                max={districtCoverageMax}
                onPillarSelect={openPillarDrilldown}
                pillarActionLabel={t('pillarDrilldown.openAxis', { pillar: '{{pillar}}' })}
                missingLabel={t('dashboard.noComparableData')}
                incompleteLabel={t('dashboard.districtCoverageIncomplete')}
                ariaLabel={t('dashboard.districtCoverageAria', {
                  scope: scopeName || t('dashboard.thisDistrict'),
                })}
              />
            ) : (
              <div style={styles.stateText}>
                {t('dashboard.hexagonNotMappedDistrict', { scope: scopeName || t('dashboard.thisDistrict') })}
              </div>
            )
          ) : hexScores ? (
            <HexRadar
              pillars={hexScores}
              max={100}
              weakest={resilienceView?.weakestPillar}
              missingLabel={t('dashboard.noComparableData')}
              incompleteLabel={t('regional.scoredPillarsTitle', {
                count: resilienceView?.scoredPillars?.length || Object.values(hexScores).filter(Number.isFinite).length,
              })}
              ariaLabel={t('regional.scoredPillarsTitle', {
                count: resilienceView?.scoredPillars?.length || Object.values(hexScores).filter(Number.isFinite).length,
              })}
              onPillarSelect={openPillarDrilldown}
              pillarActionLabel={t('pillarDrilldown.openAxis', { pillar: '{{pillar}}' })}
            />
          ) : (
            <div style={styles.stateText}>{t('dashboard.loadingResilienceScores')}</div>
          )}

          {!isDistrict && resilienceView?.pillarScores && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
              <WeakestLinkBars
                territory={resilienceView}
                title={t('dashboard.weakestLinkFirst')}
                principle={t('dashboard.weakestLinkPrinciple')}
                explanation={t(
                  resilienceView.isAggregate
                    ? 'dashboard.aggregateResilienceByPillarBody'
                    : 'about.resilienceByPillarBody'
                )}
                missingLabel={t('dashboard.noComparableData')}
              />
            </div>
          )}

          {!isDistrict && !isOverall && resilience?.territories?.[panelTerritory] && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
              <PillarCoverage territory={resilience.territories[panelTerritory]} />
            </div>
          )}
        </div>

        {!isDistrict && resilience?.territories && (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>{t('dashboard.moneyVsResilience')}</div>
            <div style={styles.sectionSubtitle}>{t('dashboard.moneyVsResilienceSub')}</div>
            <MoneyVsResilience gdpPerCapita={GDP_PER_CAPITA_USD} territories={resilience.territories} />
          </div>
        )}

        <div style={styles.card}>
          <div style={styles.esgHeader}>
            <span style={styles.sectionTitle}>{t('dashboard.esgIndicators')}</span>

            <select value={esgCategory} onChange={(e) => setEsgCategory(e.target.value)} style={styles.esgDropdown}>
              {ESG_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {esgCard ? (
            <div style={styles.esgCardBody}>
              <div style={styles.esgCardTitle}>{esgCard.label}</div>

              <div style={styles.esgScoreRow}>
                <span style={styles.esgScoreLabel}>{t('dashboard.coverage')}</span>
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
                <div style={styles.stateText}>{t('dashboard.noCanonicalIndicators')}</div>
              )}
            </div>
          ) : (
            <div style={styles.esgCardBody}>
              <div style={styles.stateText}>{t('dashboard.loadingIndicatorData')}</div>
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.mapLayerSectionTitle}>
            {t('dashboard.mapLayer', { layer: activeLayer ? layerLabel(t, activeLayer) : t('dashboard.none') })}
          </div>

          {/* Client §3.3: the point of switching layers is to answer "where is
              the problem?". Each layer's caption is written as exactly that
              question, so the active one is stated here alongside which
              direction is the bad one. */}
          {activeLayer && LAYER_CONFIG[activeLayer] ? (
            <div style={styles.mapLayerCaption}>
              {t(LAYER_CONFIG[activeLayer].captionKey)}{' '}
              <span style={styles.mapLayerDirection}>
                ({t(LAYER_CONFIG[activeLayer].directionKey)})
              </span>
            </div>
          ) : null}

          {layerCompare?.reason ? (
            <div
              role="note"
              style={
                layerCompare.rankable
                  ? styles.mapLayerDefinitionNote
                  : styles.mapLayerBlockedNote
              }
            >
              {layerCompare.reason === 'unitMismatch'
                ? t('dashboard.layerNotComparableUnits', { units: layerCompare.units.join(', ') })
                : layerCompare.reason === 'absoluteMagnitude'
                  ? t('dashboard.layerAbsoluteMagnitude')
                  : t('dashboard.layerNationalDefinitions')}
            </div>
          ) : null}

          {/* Twelve flat radios stopped being scannable once the pillar score
              layers landed. The grouping is the one already defined (and
              guarded by a test) in useIndicators.js. */}
          {LAYER_GROUPS.map((group) => (
            <div key={group.key} role="group" aria-label={t(group.labelKey)} style={styles.layerGroup}>
              <div style={styles.layerGroupLabel}>{t(group.labelKey)}</div>
              <div style={styles.layerRadioGroup}>
                {group.layers.map((key) => (
                  <label key={key} style={styles.radioLabel} title={t(LAYER_CONFIG[key].captionKey)}>
                    <input
                      type="radio"
                      name="active-layer"
                      checked={activeLayer === key}
                      onChange={() => setActiveLayer(key)}
                      style={styles.radioInput}
                    />
                    {layerLabel(t, key)}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {loading && <div style={styles.stateText}>{t('dashboard.loadingMapData')}</div>}
          {error && <div style={{ ...styles.stateText, color: 'var(--color-red)' }}>{error}</div>}

          {isDistrict ? (
            districtLayerEntries.length ? (
              districtLayerEntries.map(({ territory, row }) => (
                <div key={territory} style={styles.summaryRow}>
                  <div>
                    <div style={styles.summaryTerritory}>{territory}</div>
                    <div style={styles.summaryMeta}>
                      {row ? (
                        row.source ? (
                          <ProvenanceChip confidence={row.confidence} source={row.source} year={row.year} />
                        ) : (
                          `${row.year} · ${titleCaseConfidence(row.confidence)}`
                        )
                      ) : (
                        t('dashboard.noData')
                      )}
                    </div>
                  </div>

                  <div style={styles.summaryValue}>{row ? formatValue(row) : '—'}</div>
                </div>
              ))
            ) : (
              <div style={styles.stateText}>
                {t('dashboard.noDistrictDataForLayer', {
                  layer: layerLabel(t, activeLayer),
                  district,
                  parent: districtParent,
                })}
              </div>
            )
          ) : (
            !loading &&
            !error &&
            layerEntries.map(({ territory, row }) => (
              <div key={territory} style={styles.summaryRow}>
                <div>
                  <div style={styles.summaryTerritory}>{territory}</div>
                  <div style={styles.summaryMeta}>
                    {row ? (
                      row.source ? (
                        <ProvenanceChip confidence={row.confidence} source={row.source} year={row.year} />
                      ) : (
                        `${row.year} · ${titleCaseConfidence(row.confidence)}`
                      )
                    ) : (
                      t('dashboard.noData')
                    )}
                  </div>
                </div>

                <div style={styles.summaryValue}>{row ? formatValue(row) : '—'}</div>
              </div>
            ))
          )}
        </div>
      </div>
      <PillarDrilldownModal
        open={Boolean(drilldownPillar)}
        onClose={() => setDrilldownPillar(null)}
        territory={isDistrict ? scopeName || drilldownTerritory : drilldownTerritory}
        pillar={drilldownPillar}
        score={hexScores?.[drilldownPillar]}
        indicators={isDistrict ? districtDrilldownIndicators : drilldownIndicators}
        contributors={drilldownContributors}
        unscoredWithIndicators={isDistrict}
      />
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
    backgroundColor: 'var(--color-page-bg)',
    fontFamily: 'Inter, Arial, sans-serif',
    position: 'relative',
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

  mapControls: {
    position: 'absolute',
    bottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    borderRadius: '10px',
    overflow: 'hidden',
    zIndex: 850,
  },

  mapControlBtn: {
    width: '38px',
    height: '38px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-card)',
    border: 'none',
    borderBottom: '1px solid var(--color-border)',
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--color-ink)',
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
  },

  mapControlBtnLast: {
    borderBottom: 'none',
    fontSize: '16px',
  },

  mapLegend: {
    position: 'absolute',
    left: '20px',
    bottom: '24px',
    backgroundColor: 'var(--color-legend-bg)',
    border: '1px solid var(--color-glass-border)',
    borderRadius: '10px',
    padding: '9px 11px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 850,
  },

  mapLegendTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--color-ink)',
  },

  mapLegendSub: {
    fontSize: '10.5px',
    color: 'var(--color-muted)',
    marginBottom: '5px',
  },

  mapLegendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    margin: '2px 0',
  },

  mapLegendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },

  mapLegendLabel: {
    fontSize: '11px',
    color: 'var(--color-ink)',
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
    backgroundColor: 'var(--color-card)',
    borderRadius: '24px',
    padding: '8px 16px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    border: '1px solid var(--color-border)',
  },

  searchIcon: {
    marginRight: '10px',
    fontSize: '16px',
    color: 'var(--color-muted)',
  },

  searchInput: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: '14px',
    width: '100%',
    color: 'var(--color-ink)',
  },

  searchClear: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--color-faint)',
    fontSize: '18px',
    lineHeight: 1,
    padding: '0 2px',
    marginLeft: '6px',
  },

  searchDropdown: {
    listStyle: 'none',
    margin: '8px 0 0',
    padding: '6px',
    backgroundColor: 'var(--color-card)',
    borderRadius: '14px',
    boxShadow: '0 6px 22px rgba(0,0,0,0.18)',
    border: '1px solid var(--color-border)',
    maxHeight: '320px',
    overflowY: 'auto',
  },

  searchOption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
  },

  searchOptionActive: {
    backgroundColor: 'var(--color-grey-soft)',
  },

  searchOptionMain: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },

  searchOptionName: {
    fontSize: '14px',
    color: 'var(--color-ink)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  searchOptionParent: {
    fontSize: '12px',
    color: 'var(--color-muted)',
  },

  searchOptionTag: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '999px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  searchOptionTagRegion: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
  },

  searchOptionTagDistrict: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
  },

  searchEmpty: {
    padding: '12px',
    fontSize: '13px',
    color: 'var(--color-muted)',
    textAlign: 'center',
    display: 'grid',
    gap: '8px',
  },

  searchBotButton: {
    justifySelf: 'center',
    border: '1px solid #0b6b38',
    borderRadius: '7px',
    background: '#f1f8f2',
    color: '#075f2a',
    padding: '6px 10px',
    fontWeight: 700,
    cursor: 'pointer',
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
    backgroundColor: 'var(--color-glass-bg)',
    backdropFilter: 'blur(4px) saturate(150%)',
    WebkitBackdropFilter: 'blur(4px) saturate(150%)',
    border: '1px solid var(--color-glass-border)',
    overflowY: 'auto',
    overflowX: 'hidden',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px 16px 16px 26px',
    position: 'absolute',
    top: '16px',
    right: '16px',
    bottom: '16px',
    borderRadius: '24px',
    zIndex: 900,
  },

  card: {
    backgroundColor: 'var(--color-card)',
    borderRadius: '18px',
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.14)',
    padding: '16px 18px',
    flexShrink: 0,
  },

  dragHandle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '10px',
    height: '100%',
    cursor: 'col-resize',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },

  dragGrip: {
    width: '3px',
    height: '32px',
    borderRadius: '2px',
    background:
      'repeating-linear-gradient(to bottom, #cbd5e1 0px, #cbd5e1 3px, transparent 3px, transparent 6px)',
  },

  panelDropdownRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    flexShrink: 0,
  },

  freshnessRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '-6px',
    flexShrink: 0,
  },

  districtBoundaryNotice: {
    padding: '7px 10px',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    background: 'var(--color-grey-soft)',
    color: 'var(--color-muted)',
    fontSize: '11px',
    lineHeight: 1.4,
    flexShrink: 0,
  },

  levelToggle: {
    display: 'inline-flex',
    backgroundColor: 'var(--color-grey-soft)',
    borderRadius: '10px',
    padding: '3px',
    gap: '2px',
  },

  levelBtn: {
    border: 'none',
    background: 'transparent',
    padding: '6px 14px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--color-muted)',
    cursor: 'pointer',
    lineHeight: 1,
  },

  levelBtnActive: {
    backgroundColor: 'var(--color-card)',
    color: 'var(--color-ink)',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.16)',
  },

  cascadeWrap: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },

  cascadeSelect: {
    minWidth: '112px',
    padding: '7px 8px',
  },

  panelDropdown: {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--color-ink)',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '150px',
  },

  sectionTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--color-ink)',
    marginBottom: '2px',
  },

  sectionSubtitle: {
    fontSize: '11px',
    color: 'var(--color-muted)',
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
    color: 'var(--color-ink)',
  },

  scoreRow: {
    textAlign: 'center',
    margin: '4px 0 2px',
  },

  scoreBig: {
    fontSize: '32px',
    fontWeight: '800',
    color: 'var(--color-ink)',
  },

  scoreCaption: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--color-muted)',
    marginTop: '-2px',
  },

  scoreMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
  },

  momentumRow: {
    justifyContent: 'center',
    marginTop: '8px',
  },

  resilienceHeadline: {
    margin: '8px 0 0',
    fontSize: '13px',
    lineHeight: 1.45,
    fontWeight: '600',
    color: 'var(--color-ink)',
    textAlign: 'center',
  },

  ragStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    fontWeight: 700,
  },

  ragStatusInline: {
    fontSize: 12,
    fontWeight: 700,
  },

  trendRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
    padding: '8px 10px',
    backgroundColor: 'var(--color-grey-soft)',
    borderRadius: '8px',
  },

  trendLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--color-ink)',
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
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-card)',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--color-ink)',
    cursor: 'pointer',
    outline: 'none',
  },

  esgCardBody: {
    paddingTop: '2px',
  },

  esgCardTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--color-ink)',
    marginBottom: '8px',
  },

  esgScoreRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid var(--color-border)',
  },

  esgScoreLabel: {
    fontSize: '12px',
    color: 'var(--color-muted)',
  },

  esgScoreValue: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--color-ink)',
  },

  esgItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    padding: '3px 0',
  },

  esgItemKey: {
    color: 'var(--color-muted)',
  },

  esgItemVal: {
    fontWeight: '600',
    color: 'var(--color-ink)',
  },

  mapLayerSectionTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--color-ink)',
    marginBottom: '8px',
  },

  mapLayerCaption: {
    fontSize: '11.5px',
    lineHeight: 1.45,
    color: 'var(--color-muted)',
    margin: '-2px 0 10px',
  },

  mapLayerDirection: {
    whiteSpace: 'nowrap',
  },

  mapLayerDefinitionNote: {
    fontSize: '11px',
    lineHeight: 1.45,
    color: 'var(--color-muted)',
    margin: '-4px 0 10px',
  },

  mapLayerBlockedNote: {
    fontSize: '11px',
    lineHeight: 1.45,
    margin: '-4px 0 10px',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-grey-soft)',
    color: 'var(--color-ink)',
  },

  layerGroup: {
    marginBottom: '10px',
  },

  layerGroupLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-muted)',
    marginBottom: '4px',
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
    color: 'var(--color-ink)',
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
    color: 'var(--color-muted)',
    padding: '4px 0',
  },

  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
    borderTop: '1px solid var(--color-border)',
    paddingTop: '8px',
    marginTop: '4px',
  },

  summaryTerritory: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--color-ink)',
  },

  summaryMeta: {
    fontSize: '11px',
    color: 'var(--color-muted)',
    marginTop: '1px',
  },

  summaryValue: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--color-ink)',
    textAlign: 'right',
  },
};

export default OverviewDashboard;
