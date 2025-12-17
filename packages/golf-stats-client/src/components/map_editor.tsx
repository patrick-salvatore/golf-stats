import {
  createEffect,
  onMount,
  onCleanup,
  createSignal,
  JSX,
  Show,
} from 'solid-js';
import { createShortcut } from '@solid-primitives/keyboard';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import 'maplibre-gl/dist/maplibre-gl.css';

type DrawMode = 'polygon' | 'point' | 'circle' | 'slope';
type Mode = 'view' | 'pick_location' | 'draw' | 'edit';

export interface MarkerSpec {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

export interface MapEditorProps {
  initialGeoJSON?: GeoJSON.FeatureCollection | null;
  center?: [number, number];
  zoom?: number;
  mode?: Mode;
  drawMode?: DrawMode;
  onLocationPick?: (lat: number, lng: number) => void;
  onDrawCreate?: (feature: GeoJSON.Feature) => void;
  onDrawUpdate?: (feature: GeoJSON.Feature) => void;
  onDrawDelete?: (featureId: string) => void;
  onEnterEdit?: () => void;
  markers?: MarkerSpec[];
  style?: any;
}

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Tiles © Esri',
    },
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      paint: {},
    },
  ],
};

function makeFeatureId() {
  return `green-${Math.random().toString(36).slice(2, 9)}`;
}

/** squared point-segment distance */
function pointToSegmentDistanceSq(
  p: [number, number],
  v: [number, number],
  w: [number, number],
) {
  const l2 = (w[0] - v[0]) * (w[0] - v[0]) + (w[1] - v[1]) * (w[1] - v[1]);
  if (l2 === 0) return (p[0] - v[0]) ** 2 + (p[1] - v[1]) ** 2;
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj: [number, number] = [
    v[0] + t * (w[0] - v[0]),
    v[1] + t * (w[1] - v[1]),
  ];
  return (p[0] - proj[0]) ** 2 + (p[1] - proj[1]) ** 2;
}

const GREENS_SRC = 'greens-src';
const DRAFT_SRC = 'draft-src';
const GREENS_FILL = 'greens-fill';
const GREENS_LINE = 'greens-line';
const GREENS_HIT = 'greens-hit';
const GREENS_POINT = 'greens-point';

export default function MapEditor(props: MapEditorProps): JSX.Element {
  let container: HTMLDivElement | undefined;
  const [map, setMap] = createSignal<maplibregl.Map | null>(null);

  const [internalMode, setInternalMode] = createSignal<
    'none' | 'drawing' | 'editing' | 'pick_location'
  >('none');

  const [effectiveMode, setEffectiveMode] = createSignal(props.mode);
  const [effectiveDrawMode, setEffectiveDrawMode] = createSignal(
    props.drawMode,
  );

  const [draftPoly, setDraftPoly] = createSignal<GeoJSON.Polygon | null>(null);
  const [circleCenter, setCircleCenter] = createSignal<[number, number] | null>(
    null,
  );

  const [activeFeatureId, setActiveFeatureId] = createSignal<string | null>(
    null,
  );

  const [history, setHistory] = createSignal<GeoJSON.FeatureCollection[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(-1);
  const [selectedVertexIndex, setSelectedVertexIndex] = createSignal<number>();

  let propMarkers: maplibregl.Marker[] = [];
  let vertexMarkers: maplibregl.Marker[] = [];

  function ensureGreensLayers(m: maplibregl.Map) {
    if (!m.isStyleLoaded()) {
      m.once('styledata', () => ensureGreensLayers(m));
      return;
    }

    if (!m.getSource(GREENS_SRC)) {
      m.addSource(GREENS_SRC, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: props.initialGeoJSON?.features ?? [],
        },
      } as any);
    } else {
      const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource;
      if (props.initialGeoJSON) src.setData(props.initialGeoJSON as any);
    }

    if (!m.getLayer(GREENS_FILL)) {
      m.addLayer({
        id: GREENS_FILL,
        type: 'fill',
        source: GREENS_SRC,
        paint: { 'fill-color': '#10b981', 'fill-opacity': 0.2 },
      } as any);
    }

    if (!m.getLayer(GREENS_LINE)) {
      m.addLayer({
        id: GREENS_LINE,
        type: 'line',
        source: GREENS_SRC,
        paint: { 'line-color': '#10b981', 'line-width': 2 },
      } as any);
    }

    if (!m.getLayer(GREENS_HIT)) {
      m.addLayer({
        id: GREENS_HIT,
        type: 'line',
        source: GREENS_SRC,
        paint: { 'line-opacity': 0, 'line-width': 18 },
      } as any);
    }

    if (!m.getLayer('greens-heatmap')) {
      m.addLayer({
        id: 'greens-heatmap',
        type: 'heatmap',
        source: GREENS_SRC,
        filter: ['==', 'type', 'slope'],
        maxzoom: 24,
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            1,
            18,
            3,
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33,102,172,0)',
            0.2,
            'rgb(103,169,207)',
            0.4,
            'rgb(209,229,240)',
            0.6,
            'rgb(253,219,199)',
            0.8,
            'rgb(239,138,98)',
            1,
            'rgb(178,24,43)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 18, 20],
          'heatmap-opacity': 0.8,
        },
      } as any);
    }

    if (!m.getLayer(GREENS_POINT)) {
      m.addLayer({
        id: GREENS_POINT,
        type: 'circle',
        source: GREENS_SRC,
        filter: ['==', 'type', 'slope'],
        paint: {
          'circle-radius': 4,
          'circle-color': '#fbb03b',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.8,
        },
      } as any);
    }
  }

  function updateGreensSource(features: GeoJSON.FeatureCollection) {
    const m = map();
    if (!m) return;
    if (!m.isStyleLoaded()) {
      m.once('styledata', () => updateGreensSource(features));
      return;
    }
    const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(features as any);
    } else {
      m.addSource(GREENS_SRC, { type: 'geojson', data: features } as any);
      ensureGreensLayers(m);
    }
  }

  function refreshPropMarkers() {
    const m = map();
    if (!m) return;
    propMarkers.forEach((pm) => pm.remove());
    propMarkers = [];
    if (!props.markers) return;
    for (const mk of props.markers) {
      if (mk.lat == null || mk.lng == null) continue;
      const el = document.createElement('div');
      el.className = 'prop-marker';
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '6px';
      el.style.background = mk.color || '#10b981';
      el.style.boxShadow = '0 0 6px rgba(0,0,0,0.4)';
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([mk.lng, mk.lat])
        .addTo(m);
      propMarkers.push(marker);
    }
  }

  function clearVertexMarkers() {
    vertexMarkers.forEach((vm) => vm.remove());
    vertexMarkers = [];
  }

  function setupVertexMarkersForPolygon(
    poly: GeoJSON.Polygon,
    featureId: string,
  ) {
    clearVertexMarkers();
    const m = map();
    if (!m) return;
    const coords = poly.coordinates?.[0] ?? [];
    coords.forEach((c: any[], idx: number) => {
      if (idx === coords.length - 1) return;
      const el = document.createElement('div');
      el.className = 'vertex-marker';
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '6px';

      const isSelected = selectedVertexIndex() === idx;
      el.style.background = isSelected ? '#ef4444' : '#fbb03b';
      el.style.border = isSelected ? '2px solid white' : '2px solid #0b1220';
      el.style.zIndex = isSelected ? '10' : '1';
      el.style.cursor = 'grab';

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([c[0], c[1]])
        .addTo(m);

      marker.on('dragstart', () => {
        setSelectedVertexIndex(idx);
      });

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        updateVertex(featureId, idx, [lngLat.lng, lngLat.lat]);
      });

      el.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        setSelectedVertexIndex(idx);
        vertexMarkers.forEach((vm, i) => {
          const e = vm.getElement();
          if (i === idx) {
            e.style.background = '#ef4444';
            e.style.border = '2px solid white';
            e.style.zIndex = '10';
          } else {
            e.style.background = '#fbb03b';
            e.style.border = '2px solid #0b1220';
            e.style.zIndex = '1';
          }
        });
      });

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setSelectedVertexIndex(idx);
        vertexMarkers.forEach((vm, i) => {
          const e = vm.getElement();
          if (i === idx) {
            e.style.background = '#ef4444';
            e.style.border = '2px solid white';
            e.style.zIndex = '10';
          } else {
            e.style.background = '#fbb03b';
            e.style.border = '2px solid #0b1220';
            e.style.zIndex = '1';
          }
        });
      });

      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        deleteVertex(featureId, idx);
      });

      vertexMarkers.push(marker);
    });
  }

  function setupVertexMarkersForPoint(point: GeoJSON.Point, featureId: string) {
    clearVertexMarkers();
    const m = map();
    if (!m) return;
    const c = point.coordinates;
    const el = document.createElement('div');
    el.className = 'vertex-marker';
    el.style.width = '12px';
    el.style.height = '12px';
    el.style.borderRadius = '6px';

    const idx = 0;
    const isSelected = selectedVertexIndex() === idx;
    el.style.background = isSelected ? '#ef4444' : '#fbb03b';
    el.style.border = isSelected ? '2px solid white' : '2px solid #0b1220';
    el.style.zIndex = isSelected ? '10' : '1';
    el.style.cursor = 'grab';

    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([c[0], c[1]])
      .addTo(m);

    marker.on('dragstart', () => {
      setSelectedVertexIndex(idx);
    });

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      updateVertex(featureId, idx, [lngLat.lng, lngLat.lat]);
    });

    el.addEventListener('mousedown', (ev) => {
      ev.stopPropagation();
      setSelectedVertexIndex(idx);
      vertexMarkers.forEach((vm, i) => {
        const e = vm.getElement();
        if (i === idx) {
          e.style.background = '#ef4444';
          e.style.border = '2px solid white';
          e.style.zIndex = '10';
        } else {
          e.style.background = '#fbb03b';
          e.style.border = '2px solid #0b1220';
          e.style.zIndex = '1';
        }
      });
    });

    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      setSelectedVertexIndex(idx);
      vertexMarkers.forEach((vm, i) => {
        const e = vm.getElement();
        if (i === idx) {
          e.style.background = '#ef4444';
          e.style.border = '2px solid white';
          e.style.zIndex = '10';
        } else {
          e.style.background = '#fbb03b';
          e.style.border = '2px solid #0b1220';
          e.style.zIndex = '1';
        }
      });
    });

    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      deleteVertex(featureId, idx);
    });

    vertexMarkers.push(marker);
  }

  function updateVertex(
    featureId: string,
    index: number,
    point: [number, number],
  ) {
    const m = map();
    if (!m) return;
    const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const fc: GeoJSON.FeatureCollection = props.initialGeoJSON
      ? JSON.parse(JSON.stringify(props.initialGeoJSON))
      : { type: 'FeatureCollection', features: [] };

    if (!fc?.features) return;
    const feat = fc.features.find(
      (f) => (f.properties as any)?.id === featureId,
    );
    if (!feat || !feat.geometry) return;

    let updatedGeo: GeoJSON.Geometry | null = null;

    if (feat.geometry.type === 'Polygon') {
      const coords = (feat.geometry as GeoJSON.Polygon).coordinates[0].slice();
      coords[index] = point;
      coords[coords.length - 1] = coords[0];

      updatedGeo = {
        type: 'Polygon',
        coordinates: [coords],
      };
    } else if (feat.geometry.type === 'Point') {
      updatedGeo = {
        type: 'Point',
        coordinates: point,
      };
    }

    if (!updatedGeo) return;

    feat.geometry = updatedGeo as any;
    src.setData(fc as any);

    if (updatedGeo.type === 'Polygon') {
      setupVertexMarkersForPolygon(updatedGeo as GeoJSON.Polygon, featureId);
    } else if (updatedGeo.type === 'Point') {
      setupVertexMarkersForPoint(updatedGeo as GeoJSON.Point, featureId);
    }

    if (props.onDrawUpdate) {
      props.onDrawUpdate({
        type: 'Feature',
        properties: { ...(feat.properties as any) },
        geometry: updatedGeo,
      });
    }
  }

  function deleteVertex(featureId: string, index: number) {
    const m = map();
    if (!m) return;
    const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const fc: GeoJSON.FeatureCollection = props.initialGeoJSON
      ? JSON.parse(JSON.stringify(props.initialGeoJSON))
      : { type: 'FeatureCollection', features: [] };

    if (!fc?.features) return;
    const feat = fc.features.find(
      (f) => (f.properties as any)?.id === featureId,
    );
    if (!feat || !feat.geometry) return;

    if (feat.geometry.type === 'Point') {
      if (props.onDrawDelete) {
        props.onDrawDelete(featureId);
        exitEdit();
      }
      return;
    }

    if (feat.geometry.type !== 'Polygon') return;

    let coords = (feat.geometry as GeoJSON.Polygon).coordinates[0].slice();
    if (coords.length <= 4) return;
    coords.splice(index, 1);
    coords[coords.length - 1] = coords[0];

    const updatedPoly: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [coords],
    };
    feat.geometry = updatedPoly as any;
    src.setData(fc as any);
    setupVertexMarkersForPolygon(updatedPoly, featureId);
    if (props.onDrawUpdate) {
      props.onDrawUpdate({
        type: 'Feature',
        properties: { ...(feat.properties as any) },
        geometry: updatedPoly,
      });
    }
  }

  function insertVertexAtEdge(featureId: string, lngLat: maplibregl.LngLat) {
    const m = map();
    if (!m) return;
    const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const fc: GeoJSON.FeatureCollection = props.initialGeoJSON
      ? JSON.parse(JSON.stringify(props.initialGeoJSON))
      : { type: 'FeatureCollection', features: [] };

    if (!fc?.features) return;
    const feat = fc.features.find(
      (f) => (f.properties as any)?.id === featureId,
    );
    if (!feat || !feat.geometry || feat.geometry.type !== 'Polygon') return;

    const coords = (feat.geometry as GeoJSON.Polygon).coordinates[0].slice();
    const p: [number, number] = [lngLat.lng, lngLat.lat];
    let bestIdx = 0;
    let best = Infinity;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i] as [number, number];
      const b = coords[i + 1] as [number, number];
      const d = pointToSegmentDistanceSq(p, a, b);
      if (d < best) {
        best = d;
        bestIdx = i + 1;
      }
    }
    coords.splice(bestIdx, 0, [lngLat.lng, lngLat.lat]);
    coords[coords.length - 1] = coords[0];

    const updatedPoly: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [coords],
    };
    feat.geometry = updatedPoly as any;
    src.setData(fc as any);
    setupVertexMarkersForPolygon(updatedPoly, featureId);
    if (props.onDrawUpdate) {
      props.onDrawUpdate({
        type: 'Feature',
        properties: { ...(feat.properties as any) },
        geometry: updatedPoly,
      });
    }
  }

  function startDraft() {
    setInternalMode('drawing');
    if (effectiveDrawMode() === 'circle') {
      setCircleCenter(null);
    }
    setDraftPoly({ type: 'Polygon', coordinates: [[]] });
    setActiveFeatureId(null);
    clearVertexMarkers();
  }

  function addDraftVertex(lngLat: maplibregl.LngLat) {
    if (effectiveDrawMode() === 'circle') {
      if (!circleCenter()) {
        setCircleCenter([lngLat.lng, lngLat.lat]);
      } else {
        finishDraft();
      }
      return;
    }

    if (effectiveDrawMode() === 'slope') {
      const feat: GeoJSON.Feature = {
        type: 'Feature',
        properties: { id: makeFeatureId(), type: 'slope', intensity: 1.0 },
        geometry: { type: 'Point', coordinates: [lngLat.lng, lngLat.lat] },
      };
      if (props.onDrawCreate) props.onDrawCreate(feat);
      return;
    }

    const dp = draftPoly();
    if (!dp) {
      setDraftPoly({
        type: 'Polygon',
        coordinates: [[[lngLat.lng, lngLat.lat]]],
      });
      return;
    }
    const ring = dp.coordinates[0].slice();
    ring.push([lngLat.lng, lngLat.lat]);
    setDraftPoly({ type: 'Polygon', coordinates: [ring] });
  }

  function updateDraftPreview(lngLat: maplibregl.LngLat) {
    if (effectiveDrawMode() === 'circle') {
      const center = circleCenter();
      if (center) {
        const from = turf.point(center);
        const to = turf.point([lngLat.lng, lngLat.lat]);
        const radius = turf.distance(from, to, { units: 'kilometers' });
        const options = { steps: 64, units: 'kilometers' as const };
        const circle = turf.circle(center, radius, options);
        setDraftPoly(circle.geometry as GeoJSON.Polygon);
      }
      return;
    }

    if (effectiveDrawMode() === 'slope') return;

    const dp = draftPoly();
    if (!dp) return;
    const ring = dp.coordinates[0].slice();
    if (ring.length === 0) return;
    const base = ring.slice(0, ring.length - 1);
    const updated = [...base, [lngLat.lng, lngLat.lat]];
    setDraftPoly({ type: 'Polygon', coordinates: [updated] });
  }

  function finishDraft() {
    if (effectiveDrawMode() === 'circle') {
      const dp = draftPoly();
      if (!dp) {
        setInternalMode('none');
        return;
      }
      const feat: GeoJSON.Feature = {
        type: 'Feature',
        properties: { id: makeFeatureId(), type: 'green', isCircle: true },
        geometry: dp,
      };

      if (props.onDrawCreate) props.onDrawCreate(feat);

      setDraftPoly(null);
      setCircleCenter(null);
      setInternalMode('none');
      return;
    }

    const dp = draftPoly();
    if (!dp) return;
    const ring = dp.coordinates[0].slice();
    if (ring.length < 3) {
      setDraftPoly(null);
      setInternalMode('none');
      return;
    }
    const closed = [...ring, ring[0]];
    const poly: GeoJSON.Polygon = { type: 'Polygon', coordinates: [closed] };
    const feat: GeoJSON.Feature = {
      type: 'Feature',
      properties: { id: makeFeatureId() },
      geometry: poly,
    };

    if (props.onDrawCreate) props.onDrawCreate(feat);

    setDraftPoly(null);
    setInternalMode('none');
  }

  function handleMapClick(e: maplibregl.MapMouseEvent) {
    if (effectiveMode() === 'pick_location' && props.onLocationPick) {
      props.onLocationPick(e.lngLat.lat, e.lngLat.lng);
      return;
    }

    if (internalMode() === 'drawing') {
      addDraftVertex(e.lngLat);
      return;
    }

    const m = map();
    if (!m) return;
    const features = m.queryRenderedFeatures(e.point, {
      layers: [GREENS_FILL],
    });
    if (features?.length) {
      const f = features[0];
      const id = (f.properties as any)?.id as string | undefined;
      if (id) {
        enterEditFeature(id);
        return;
      }
    }

    if (internalMode() === 'editing') {
      const edgeFeatures = m.queryRenderedFeatures(e.point, {
        layers: [GREENS_HIT],
      });
      if (edgeFeatures?.length) {
        const f = edgeFeatures[0];
        const id = (f.properties as any)?.id as string | undefined;
        if (id) insertVertexAtEdge(id, e.lngLat);
      } else {
        setSelectedVertexIndex(undefined);
      }
    }
  }

  function performUndo() {
    if (historyIndex() > 0) {
      const idx = historyIndex() - 1;
      setHistoryIndex(idx);
      const fc = history()[idx];
      if (activeFeatureId()) {
        const feat = fc.features.find(
          (f) => (f.properties as any)?.id === activeFeatureId(),
        );
        if (feat && props.onDrawUpdate) {
          props.onDrawUpdate(feat);
        }
      }
    }
  }

  function performRedo() {
    if (historyIndex() < history().length - 1) {
      const idx = historyIndex() + 1;
      setHistoryIndex(idx);
      const fc = history()[idx];
      if (activeFeatureId()) {
        const feat = fc.features.find(
          (f) => (f.properties as any)?.id === activeFeatureId(),
        );
        if (feat && props.onDrawUpdate) {
          props.onDrawUpdate(feat);
        }
      }
    }
  }

  function enterEditFeature(featureId: string) {
    const m = map();
    if (!m) return;
    const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const fc: GeoJSON.FeatureCollection = props.initialGeoJSON
      ? props.initialGeoJSON
      : { type: 'FeatureCollection', features: [] };
    const feat = fc.features.find(
      (f) => (f.properties as any)?.id === featureId,
    );
    console.log(feat, fc);
    if (!feat || !feat.geometry) {
      return;
    }

    if (feat.geometry.type === 'Polygon') {
      setActiveFeatureId(featureId);
      setInternalMode('editing');
      setupVertexMarkersForPolygon(feat.geometry as GeoJSON.Polygon, featureId);
      if (props.onEnterEdit) {
        props.onEnterEdit();
      }
    } else if (feat.geometry.type === 'Point') {
      setActiveFeatureId(featureId);
      setInternalMode('editing');
      setupVertexMarkersForPoint(feat.geometry as GeoJSON.Point, featureId);
      if (props.onEnterEdit) {
        props.onEnterEdit();
      }
    }
  }

  function exitEdit() {
    setActiveFeatureId(null);
    setInternalMode('none');
    clearVertexMarkers();
  }

  function syncDraftToMap() {
    const m = map();
    if (!m) return;
    ensureGreensLayers(m);

    if (!m.getSource(DRAFT_SRC)) {
      m.addSource(DRAFT_SRC, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      } as any);
      m.addLayer({
        id: 'draft-line',
        type: 'line',
        source: DRAFT_SRC,
        paint: {
          'line-color': '#fbb03b',
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      } as any);
    }

    const draftSrc = m.getSource(DRAFT_SRC) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (draftPoly()) {
      const coords = draftPoly()!.coordinates[0];
      const features: GeoJSON.Feature[] = [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords } as any,
        },
      ];
      draftSrc?.setData({ type: 'FeatureCollection', features } as any);
    } else {
      draftSrc?.setData({ type: 'FeatureCollection', features: [] } as any);
    }

    if (internalMode() !== 'editing') {
      clearVertexMarkers();
    }
  }

  function handleDelete() {
    if (internalMode() === 'editing' && activeFeatureId()) {
      if (selectedVertexIndex() !== null) {
        deleteVertex(activeFeatureId()!, selectedVertexIndex()!);
        setSelectedVertexIndex(undefined);
        return;
      }
      if (props.onDrawDelete) {
        props.onDrawDelete(activeFeatureId()!);
        exitEdit();
      }
    }
  }

  createShortcut(['Control', 'z'], performUndo);
  createShortcut(['Meta', 'z'], performUndo);
  createShortcut(['Meta', 'Shift', 'z'], performRedo);
  createShortcut(['Control', 'Shift', 'z'], performRedo);

  createShortcut(['Delete'], handleDelete, { preventDefault: false });
  createShortcut(['Backspace'], handleDelete, {
    preventDefault: false,
  });

  createShortcut(['Escape'], () => {
    if (internalMode() === 'drawing') {
      setDraftPoly(null);
      setCircleCenter(null);
      setInternalMode('none');
    } else if (internalMode() === 'editing') {
      exitEdit();
    }
  });
  createShortcut(['Enter'], () => {
    if (internalMode() === 'drawing') {
      finishDraft();
    }
  });

  onMount(() => {
    if (!container) return;
    const m = new maplibregl.Map({
      container,
      style: props.style ?? (SATELLITE_STYLE as any),
      center: props.center ?? [-97.7431, 30.2672],
      zoom: props.zoom ?? 15,
    });

    m.addControl(new maplibregl.NavigationControl(), 'top-right');

    let isMouseDown = false;
    let dragStart: maplibregl.LngLat | null = null;

    m.on('load', () => {
      ensureGreensLayers(m);
      if (props.initialGeoJSON) updateGreensSource(props.initialGeoJSON);
      refreshPropMarkers();
    });

    m.on('click', handleMapClick);

    m.on('mousedown', (e) => {
      if (internalMode() === 'drawing' && effectiveDrawMode() === 'circle') {
        isMouseDown = true;
        dragStart = e.lngLat;
      }
    });

    m.on('mouseup', () => {
      if (internalMode() === 'drawing' && effectiveDrawMode() === 'circle') {
        if (isMouseDown && circleCenter()) {
          finishDraft();
        }
        isMouseDown = false;
        dragStart = null;
      }
    });

    m.on('mousemove', (e) => {
      if (internalMode() === 'drawing') {
        if (
          effectiveDrawMode() === 'circle' &&
          isMouseDown &&
          dragStart &&
          !circleCenter()
        ) {
          setCircleCenter([dragStart.lng, dragStart.lat]);
        }
        updateDraftPreview(e.lngLat);
      }
    });

    m.on(
      'mouseenter',
      GREENS_POINT,
      () => (m.getCanvas().style.cursor = 'pointer'),
    );

    m.on('mouseleave', GREENS_POINT, () => (m.getCanvas().style.cursor = ''));

    m.on('dblclick', (e) => {
      if (internalMode() === 'drawing') {
        addDraftVertex(e.lngLat);
        finishDraft();
      }
    });

    m.on('click', GREENS_HIT, (e) => {
      if (internalMode() === 'editing' && e && e.features && e.features[0]) {
        const id = (e.features[0].properties as any)?.id;
        if (id) insertVertexAtEdge(id, e.lngLat);
      }
    });

    m.on('click', GREENS_FILL, (e) => {
      if (e && e.features && e.features[0]) {
        const id = (e.features[0].properties as any)?.id;
        if (id) enterEditFeature(id);
      }
    });

    m.on('click', GREENS_POINT, (e) => {
      if (e && e.features && e.features[0]) {
        const id = (e.features[0].properties as any)?.id;
        if (id) enterEditFeature(id);
      }
    });

    setMap(m);
  });

  onCleanup(() => {
    clearVertexMarkers();
    propMarkers.forEach((pm) => pm.remove());
    try {
      if (map()) map()?.remove();
    } catch {}
  });

  createEffect(() => {
    const m = map();
    if (!m) return;
    if (internalMode() === 'drawing') {
      m.dragPan.disable();
    } else {
      m.dragPan.enable();
    }
  });

  createEffect((prevCenter: [number, number] | undefined) => {
    const m = map();
    if (!m) return props.center;
    if (props.center) {
      const [lng, lat] = props.center;
      const [pLng, pLat] = prevCenter || [null, null];
      if (lng !== pLng || lat !== pLat) {
        try {
          m.flyTo({ center: props.center, zoom: props.zoom ?? 15 });
        } catch (_) {}
      }
    }
    return props.center;
  });

  createEffect(() => {
    const m = map();
    if (!m) return;
    if (!m.isStyleLoaded()) {
      m.once('styledata', () => syncDraftToMap());
      return;
    }
    syncDraftToMap();
  });

  createEffect(() => {
    const m = map();
    if (!m) return;
    if (!props.initialGeoJSON) return;

    const fc = JSON.parse(JSON.stringify(props.initialGeoJSON));
    setHistory((h) => {
      const current = h[historyIndex()];
      if (current && JSON.stringify(current) === JSON.stringify(fc)) return h;
      const upToNow = h.slice(0, historyIndex() + 1);
      return [...upToNow, fc];
    });
    setHistoryIndex(history().length - 1);

    if (!m.isStyleLoaded()) {
      m.once('styledata', () => updateGreensSource(props.initialGeoJSON!));
      return;
    }
    updateGreensSource(props.initialGeoJSON);

    if (internalMode() === 'editing' && activeFeatureId()) {
      const feat = fc.features.find(
        (f: any) => f.properties?.id === activeFeatureId(),
      );
      if (feat && feat.geometry.type === 'Polygon') {
        setupVertexMarkersForPolygon(
          feat.geometry as GeoJSON.Polygon,
          activeFeatureId()!,
        );
      }
    }
  });

  createEffect(() => {
    setEffectiveMode(props.mode);
    setEffectiveDrawMode(props.drawMode);
    const pMode = props.mode;
    if (!pMode) return;
    if (pMode === 'draw') {
      startDraft();
    } else if (pMode === 'edit') {
      setInternalMode('none');
    } else {
      setInternalMode('none');
      setDraftPoly(null);
    }
  });

  createEffect(() => {
    const idx = selectedVertexIndex();
    vertexMarkers.forEach((vm, i) => {
      const e = vm.getElement();
      if (i === idx) {
        e.style.background = '#ef4444';
        e.style.border = '2px solid white';
        e.style.zIndex = '10';
      } else {
        e.style.background = '#fbb03b';
        e.style.border = '2px solid #0b1220';
        e.style.zIndex = '1';
      }
    });
  });

  return (
    <div class="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900">
      <div ref={container} class="w-full h-full" />
      <Show when={internalMode() !== 'none'}>
        <div class="absolute top-4 left-4 bg-slate-900/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg border border-slate-700 z-10 flex items-center gap-2">
          <div
            class={`w-2 h-2 rounded-full ${internalMode() === 'editing' ? 'bg-amber-500' : 'bg-blue-500'} animate-pulse`}
          />
          <span class="uppercase tracking-wider">{internalMode()}</span>
        </div>
      </Show>
      <Show when={props.mode === 'pick_location'}>
        <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-emerald-500/50 z-10">
          Click to set location
        </div>
      </Show>
    </div>
  );
}
