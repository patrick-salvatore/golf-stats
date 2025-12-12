// import { createEffect, onMount, onCleanup, createSignal } from 'solid-js';
// import maplibregl from 'maplibre-gl';
// import MapboxDraw from '@mapbox/mapbox-gl-draw';
// import 'maplibre-gl/dist/maplibre-gl.css';
// import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

// // Using ESRI World Imagery for satellite view
// const SATELLITE_STYLE = {
//   version: 8,
//   sources: {
//     'esri-satellite': {
//       type: 'raster',
//       tiles: [
//         'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
//       ],
//       tileSize: 256,
//       attribution: 'Tiles &copy; Esri',
//     },
//   },
//   layers: [
//     {
//       id: 'esri-satellite-layer',
//       type: 'raster',
//       source: 'esri-satellite',
//       paint: {},
//     },
//   ],
// };

// interface MapEditorProps {
//   initialGeoJSON?: any;
//   center?: [number, number];
//   zoom?: number;
//   mode?: 'view' | 'pick_location' | 'draw' | 'edit';
//   drawMode?: 'polygon' | 'point';
//   onLocationPick?: (lat: number, lng: number) => void;
//   onDrawCreate?: (feature: any) => void;
//   onDrawUpdate?: (feature: any) => void;
//   markers?: { lat: number; lng: number; label?: string; color?: string }[];
// }

// export default function MapEditor(props: MapEditorProps) {
//   let mapContainer: HTMLDivElement | undefined;
//   const [map, setMap] = createSignal<maplibregl.Map | null>(null);
//   let draw: MapboxDraw | null = null;
//   let markerInstances: maplibregl.Marker[] = [];

//   // Update map center/zoom when props change
//   createEffect(() => {
//     const m = map();
//     if (!m) return;
//     if (props.center) {
//       m.flyTo({ center: props.center, zoom: props.zoom || 18 });
//     }
//   });

//   // Update markers
//   createEffect(() => {
//     const m = map();
//     if (!m) return;

//     // Clear existing
//     markerInstances.forEach((marker) => marker.remove());
//     markerInstances = [];

//     if (props.markers) {
//       props.markers.forEach((markerData) => {
//         if (markerData.lat && markerData.lng) {
//           const marker = new maplibregl.Marker({
//             color: markerData.color || '#10b981',
//           })
//             .setLngLat([markerData.lng, markerData.lat])
//             .addTo(m);
//           markerInstances.push(marker);
//         }
//       });
//     }
//   });

//   // Handle Mode Changes
//   createEffect(() => {
//     const m = map();
//     if (!m || !draw) return;

//     if (props.mode === 'draw') {
//       if (props.drawMode === 'polygon') {
//         draw.changeMode('draw_polygon');
//       } else if (props.drawMode === 'point') {
//         draw.changeMode('draw_point');
//       }
//     } else if (props.mode === 'edit') {
//       draw.changeMode('simple_select');
//     } else {
//       // Stop drawing
//       draw.changeMode('simple_select');
//     }
//   });

//   onMount(() => {
//     if (!mapContainer) return;

//     const m = new maplibregl.Map({
//       container: mapContainer,
//       style: SATELLITE_STYLE as any,
//       center: props.center || [-97.7431, 30.2672],
//       zoom: props.zoom || 16,
//       pitch: 0,
//       maxPitch: 0,
//     });

//     draw = new MapboxDraw({
//       displayControlsDefault: false,
//       controls: {
//         polygon: false,
//         trash: true,
//       },
//       styles: [
//         // Polygon Fill
//         {
//           id: 'gl-draw-polygon-fill-inactive',
//           type: 'fill',
//           filter: [
//             'all',
//             ['==', 'active', 'false'],
//             ['==', '$type', 'Polygon'],
//             ['!=', 'mode', 'static'],
//           ],
//           paint: {
//             'fill-color': '#10b981',
//             'fill-outline-color': '#10b981',
//             'fill-opacity': 0.2,
//           },
//         },
//         {
//           id: 'gl-draw-polygon-fill-active',
//           type: 'fill',
//           filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
//           paint: {
//             'fill-color': '#fbb03b',
//             'fill-outline-color': '#fbb03b',
//             'fill-opacity': 0.2,
//           },
//         },
//         // Polygon Stroke
//         {
//           id: 'gl-draw-polygon-stroke-inactive',
//           type: 'line',
//           filter: [
//             'all',
//             ['==', 'active', 'false'],
//             ['==', '$type', 'Polygon'],
//             ['!=', 'mode', 'static'],
//           ],
//           layout: {
//             'line-cap': 'round',
//             'line-join': 'round',
//           },
//           paint: {
//             'line-color': '#10b981',
//             'line-width': 2,
//           },
//         },
//         {
//           id: 'gl-draw-polygon-stroke-active',
//           type: 'line',
//           filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
//           layout: {
//             'line-cap': 'round',
//             'line-join': 'round',
//           },
//           paint: {
//             'line-color': '#fbb03b',
//             'line-dasharray': [2, 2],
//             'line-width': 2,
//           },
//         },
//         // Points
//         {
//           id: 'gl-draw-point-inactive',
//           type: 'circle',
//           filter: [
//             'all',
//             ['==', 'active', 'false'],
//             ['==', '$type', 'Point'],
//             ['!=', 'mode', 'static'],
//           ],
//           paint: {
//             'circle-radius': 5,
//             'circle-color': '#10b981',
//           },
//         },
//         {
//           id: 'gl-draw-point-active',
//           type: 'circle',
//           filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point']],
//           paint: {
//             'circle-radius': 7,
//             'circle-color': '#fbb03b',
//           },
//         },
//       ],
//     });

//     m.addControl(draw as any);
//     m.addControl(new maplibregl.NavigationControl(), 'top-right');

//     m.on('load', () => {
//       if (props.initialGeoJSON && draw) {
//         draw.add(props.initialGeoJSON);
//       }
//       setMap(m); // Trigger effects
//     });

//     m.on('click', (e) => {
//       if (props.mode === 'pick_location' && props.onLocationPick) {
//         props.onLocationPick(e.lngLat.lat, e.lngLat.lng);
//       }
//     });

//     m.on('draw.create', (e) => {
//       if (props.onDrawCreate && e.features[0]) {
//         props.onDrawCreate(e.features[0]);
//         // If we only want single feature creation, we could reset mode here
//       }
//     });

//     m.on('draw.update', (e) => {
//       if (props.onDrawUpdate && e.features[0]) {
//         props.onDrawUpdate(e.features[0]);
//       }
//     });
//   });

//   onCleanup(() => {
//     const m = map();
//     if (m) m.remove();
//   });

//   return (
//     <div class="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900">
//       <div ref={mapContainer} class="w-full h-full" />

//       {props.mode === 'pick_location' && (
//         <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-emerald-500/50 z-10">
//           Click to set location
//         </div>
//       )}

//       {props.mode === 'edit' && (
//         <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-blue-500/50 z-10">
//           Select a green to edit
//         </div>
//       )}
//     </div>
//   );
// }

import {
  createEffect,
  onMount,
  onCleanup,
  createSignal,
  JSX,
  Show,
} from "solid-js";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type DrawMode = "polygon" | "point";
type Mode = "view" | "pick_location" | "draw" | "edit";

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
  onDrawCreate?: (feature: GeoJSON.Feature) => void; // created polygon feature
  onDrawUpdate?: (feature: GeoJSON.Feature) => void; // edited polygon feature
  markers?: MarkerSpec[];
  style?: any;
}

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
    },
  },
  layers: [
    {
      id: "esri-satellite-layer",
      type: "raster",
      source: "esri-satellite",
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
  w: [number, number]
) {
  const l2 =
    (w[0] - v[0]) * (w[0] - v[0]) + (w[1] - v[1]) * (w[1] - v[1]);
  if (l2 === 0) return (p[0] - v[0]) ** 2 + (p[1] - v[1]) ** 2;
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj: [number, number] = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
  return (p[0] - proj[0]) ** 2 + (p[1] - proj[1]) ** 2;
}

export default function MapEditor(props: MapEditorProps): JSX.Element {
  let container: HTMLDivElement | undefined;
  const [map, setMap] = createSignal<maplibregl.Map | null>(null);

  // internal editor state: "none" | "drawing" | "editing"
  const [internalMode, setInternalMode] = createSignal<
    "none" | "drawing" | "editing"
  >("none");

  // draft polygon while drawing (LineString-like preview stored as Polygon coords[0])
  const [draftPoly, setDraftPoly] = createSignal<GeoJSON.Polygon | null>(null);

  // active editing polygon id / geometry
  const [activeFeatureId, setActiveFeatureId] = createSignal<string | null>(null);
  const [activeFeature, setActiveFeature] = createSignal<GeoJSON.Polygon | null>(
    null
  );

  // markers arrays
  let propMarkers: maplibregl.Marker[] = [];
  let vertexMarkers: maplibregl.Marker[] = [];

  const GREENS_SRC = "greens-src";
  const DRAFT_SRC = "draft-src";
  const GREENS_FILL = "greens-fill";
  const GREENS_LINE = "greens-line";
  const GREENS_HIT = "greens-hit";

  // ---------- Utility: ensure style loaded and greens layers exist ----------
  function ensureGreensLayers(m: maplibregl.Map) {
    // If style isn't loaded, wait for it (safe across hot reloads & style swaps)
    if (!m.isStyleLoaded()) {
      m.once("styledata", () => ensureGreensLayers(m));
      return;
    }

    // add source if missing
    if (!m.getSource(GREENS_SRC)) {
      m.addSource(GREENS_SRC, {
        type: "geojson",
        data: { type: "FeatureCollection", features: props.initialGeoJSON?.features ?? [] },
      } as any);
    } else {
      // ensure it exists and has initial data if provided
      const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource;
      if (props.initialGeoJSON) src.setData(props.initialGeoJSON as any);
    }

    // fill layer
    if (!m.getLayer(GREENS_FILL)) {
      m.addLayer({
        id: GREENS_FILL,
        type: "fill",
        source: GREENS_SRC,
        paint: { "fill-color": "#10b981", "fill-opacity": 0.2 },
      } as any);
    }

    // outline
    if (!m.getLayer(GREENS_LINE)) {
      m.addLayer({
        id: GREENS_LINE,
        type: "line",
        source: GREENS_SRC,
        paint: { "line-color": "#10b981", "line-width": 2 },
      } as any);
    }

    // invisible wide line to make edge clicks easier
    if (!m.getLayer(GREENS_HIT)) {
      m.addLayer({
        id: GREENS_HIT,
        type: "line",
        source: GREENS_SRC,
        paint: { "line-opacity": 0, "line-width": 18 },
      } as any);
    }
  }

  // ---------- Helpers: update sources / markers ----------
  function updateGreensSource(features: GeoJSON.FeatureCollection) {
    const m = map();
    if (!m) return;
    if (!m.isStyleLoaded()) {
      m.once("styledata", () => updateGreensSource(features));
      return;
    }
    const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(features as any);
    } else {
      m.addSource(GREENS_SRC, { type: "geojson", data: features } as any);
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
      const el = document.createElement("div");
      el.className = "prop-marker";
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "6px";
      el.style.background = mk.color || "#10b981";
      el.style.boxShadow = "0 0 6px rgba(0,0,0,0.4)";
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

  function setupVertexMarkersForPolygon(poly: GeoJSON.Polygon, featureId: string) {
    clearVertexMarkers();
    const m = map();
    if (!m) return;
    const coords = poly.coordinates?.[0] ?? [];
    // create a draggable marker for each unique vertex (skip the last duplicate)
    coords.forEach((c: any[], idx: number) => {
      if (idx === coords.length - 1) return; // skip closing duplicate
      const el = document.createElement("div");
      el.className = "vertex-marker";
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "6px";
      el.style.background = "#fbb03b";
      el.style.border = "2px solid #0b1220";
      el.style.cursor = "grab";

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([c[0], c[1]])
        .addTo(m);

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        updateVertex(featureId, idx, [lngLat.lng, lngLat.lat]);
      });

      // right-click on marker to delete vertex
      el.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        deleteVertex(featureId, idx);
      });

      vertexMarkers.push(marker);
    });
  }

  // ---------- Vertex/feature mutation functions ----------
  function updateVertex(featureId: string, index: number, point: [number, number]) {
    const m = map();
    if (!m) return;
    const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const fc = (src as any)._data as GeoJSON.FeatureCollection;
    if (!fc?.features) return;
    const fi = fc.features.findIndex((f) => (f.properties as any)?.id === featureId);
    if (fi === -1) return;
    const feat = fc.features[fi];
    if (!feat.geometry || feat.geometry.type !== "Polygon") return;

    const coords = (feat.geometry as GeoJSON.Polygon).coordinates[0].slice();
    coords[index] = point;
    // keep closed
    coords[coords.length - 1] = coords[0];

    const updatedPoly: GeoJSON.Polygon = { type: "Polygon", coordinates: [coords] };
    feat.geometry = updatedPoly as any;
    src.setData(fc as any);
    setupVertexMarkersForPolygon(updatedPoly, featureId);

    // callback
    if (props.onDrawUpdate) {
      props.onDrawUpdate({
        type: "Feature",
        properties: { ...(feat.properties as any) },
        geometry: updatedPoly,
      });
    }
  }

  function deleteVertex(featureId: string, index: number) {
    const m = map();
    if (!m) return;
    const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const fc = (src as any)._data as GeoJSON.FeatureCollection;
    if (!fc?.features) return;
    const fi = fc.features.findIndex((f) => (f.properties as any)?.id === featureId);
    if (fi === -1) return;
    const feat = fc.features[fi];
    if (!feat.geometry || feat.geometry.type !== "Polygon") return;
    let coords = (feat.geometry as GeoJSON.Polygon).coordinates[0].slice();
    if (coords.length <= 4) return; // must keep 3 unique + closing
    coords.splice(index, 1);
    coords[coords.length - 1] = coords[0];
    const updatedPoly: GeoJSON.Polygon = { type: "Polygon", coordinates: [coords] };
    feat.geometry = updatedPoly as any;
    src.setData(fc as any);
    setupVertexMarkersForPolygon(updatedPoly, featureId);
    if (props.onDrawUpdate) {
      props.onDrawUpdate({
        type: "Feature",
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
    const fc = (src as any)._data as GeoJSON.FeatureCollection;
    if (!fc?.features) return;
    const fi = fc.features.findIndex((f) => (f.properties as any)?.id === featureId);
    if (fi === -1) return;
    const feat = fc.features[fi];
    if (!feat.geometry || feat.geometry.type !== "Polygon") return;
    const coords = (feat.geometry as GeoJSON.Polygon).coordinates[0].slice();
    const p: [number, number] = [lngLat.lng, lngLat.lat];
    let bestIdx = 0;
    let best = Infinity;
    for (let i = 0; i < coords.length - 1; i++) {
      const a: [number, number] = [coords[i][0], coords[i][1]];
      const b: [number, number] = [coords[i + 1][0], coords[i + 1][1]];
      const d = pointToSegmentDistanceSq(p, a, b);
      if (d < best) {
        best = d;
        bestIdx = i + 1;
      }
    }
    coords.splice(bestIdx, 0, [lngLat.lng, lngLat.lat]);
    coords[coords.length - 1] = coords[0];
    const updatedPoly: GeoJSON.Polygon = { type: "Polygon", coordinates: [coords] };
    feat.geometry = updatedPoly as any;
    src.setData(fc as any);
    setupVertexMarkersForPolygon(updatedPoly, featureId);
    if (props.onDrawUpdate) {
      props.onDrawUpdate({
        type: "Feature",
        properties: { ...(feat.properties as any) },
        geometry: updatedPoly,
      });
    }
  }

  // ---------- Draft drawing functions ----------
  function startDraft() {
    setInternalMode("drawing");
    setDraftPoly({ type: "Polygon", coordinates: [[]] });
    // clear selection if any
    setActiveFeatureId(null);
    setActiveFeature(null);
    clearVertexMarkers();
  }

  function addDraftVertex(lngLat: maplibregl.LngLat) {
    const dp = draftPoly();
    if (!dp) {
      setDraftPoly({ type: "Polygon", coordinates: [[[lngLat.lng, lngLat.lat]]] });
      return;
    }
    const ring = dp.coordinates[0].slice();
    ring.push([lngLat.lng, lngLat.lat]);
    setDraftPoly({ type: "Polygon", coordinates: [ring] });
  }

  // update preview point while moving mouse
  function updateDraftPreview(lngLat: maplibregl.LngLat) {
    const dp = draftPoly();
    if (!dp) return;
    const ring = dp.coordinates[0].slice();
    if (ring.length === 0) return;
    // replace last (preview) point or append a preview if none
    const base = ring.slice(0, ring.length - 1);
    const updated = [...base, [lngLat.lng, lngLat.lat]];
    setDraftPoly({ type: "Polygon", coordinates: [updated] });
  }

  function finishDraft() {
    const dp = draftPoly();
    if (!dp) return;
    const ring = dp.coordinates[0].slice();
    if (ring.length < 3) {
      setDraftPoly(null);
      setInternalMode("none");
      return;
    }
    // close
    const closed = [...ring, ring[0]];
    const poly: GeoJSON.Polygon = { type: "Polygon", coordinates: [closed] };
    const feat: GeoJSON.Feature = {
      type: "Feature",
      properties: { id: makeFeatureId() },
      geometry: poly,
    };

    const m = map();
    if (!m) return;
    const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource | undefined;
    let fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    if (src && (src as any)._data) {
      fc = (src as any)._data as GeoJSON.FeatureCollection;
    }
    fc.features = [...(fc.features || []), feat];
    if (src) src.setData(fc as any);
    else {
      m.addSource(GREENS_SRC, { type: "geojson", data: fc } as any);
      ensureGreensLayers(m);
    }

    if (props.onDrawCreate) props.onDrawCreate(feat);

    setDraftPoly(null);
    setInternalMode("none");
  }

  // ---------- Map interactions ----------
  function handleMapClick(e: maplibregl.MapMouseEvent) {
    // location picking overrides everything
    if (props.mode === "pick_location" && props.onLocationPick) {
      props.onLocationPick(e.lngLat.lat, e.lngLat.lng);
      return;
    }

    // drawing mode: add vertex
    if (internalMode() === "drawing") {
      addDraftVertex(e.lngLat);
      return;
    }

    // check greens fill click -> enter edit
    const m = map();
    if (!m) return;
    const features = m.queryRenderedFeatures(e.point, { layers: [GREENS_FILL] });
    if (features?.length) {
      const f = features[0];
      const id = (f.properties as any)?.id as string | undefined;
      if (id) {
        enterEditFeature(id);
        return;
      }
    }

    // if editing and clicked an edge target, insert vertex
    if (internalMode() === "editing") {
      const edgeFeatures = m.queryRenderedFeatures(e.point, { layers: [GREENS_HIT] });
      if (edgeFeatures?.length) {
        const f = edgeFeatures[0];
        const id = (f.properties as any)?.id as string | undefined;
        if (id) insertVertexAtEdge(id, e.lngLat);
      }
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (internalMode() === "drawing") {
        setDraftPoly(null);
        setInternalMode("none");
      } else if (internalMode() === "editing") {
        exitEdit();
      }
    }
    if (e.key === "Enter") {
      if (internalMode() === "drawing") {
        finishDraft();
      }
    }
  }

  // ---------- Edit selection ----------
  function enterEditFeature(featureId: string) {
    const m = map();
    if (!m) return;
    const src = m.getSource(GREENS_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const fc = (src as any)._data as GeoJSON.FeatureCollection;
    const feat = fc.features.find((f) => (f.properties as any)?.id === featureId);
    if (!feat || !feat.geometry || feat.geometry.type !== "Polygon") return;
    setActiveFeatureId(featureId);
    setActiveFeature(feat.geometry as GeoJSON.Polygon);
    setInternalMode("editing");
    setupVertexMarkersForPolygon(feat.geometry as GeoJSON.Polygon, featureId);
  }

  function exitEdit() {
    setActiveFeatureId(null);
    setActiveFeature(null);
    setInternalMode("none");
    clearVertexMarkers();
  }

  // ---------- Sync draft/active visuals to map ----------
  function syncDraftToMap() {
    const m = map();
    if (!m) return;
    // ensure style/layers ready
    ensureGreensLayers(m);

    // ensure draft source + layer
    if (!m.getSource(DRAFT_SRC)) {
      m.addSource(DRAFT_SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } } as any);
      m.addLayer({
        id: "draft-line",
        type: "line",
        source: DRAFT_SRC,
        paint: { "line-color": "#fbb03b", "line-width": 2, "line-dasharray": [3, 2] },
      } as any);
    }

    const draftSrc = m.getSource(DRAFT_SRC) as maplibregl.GeoJSONSource | undefined;
    if (draftPoly()) {
      const coords = draftPoly()!.coordinates[0];
      // show as LineString (open)
      const features: GeoJSON.Feature[] = [{
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords } as any,
      }];
      draftSrc?.setData({ type: "FeatureCollection", features } as any);
    } else {
      draftSrc?.setData({ type: "FeatureCollection", features: [] } as any);
    }

    // if editing, show vertex markers (already handled in enterEditFeature/updateVertex)
    if (internalMode() !== "editing") {
      clearVertexMarkers();
    }
  }

  // ---------- lifecycle ----------
  onMount(() => {
    if (!container) return;
    const m = new maplibregl.Map({
      container,
      style: props.style ?? (SATELLITE_STYLE as any),
      center: props.center ?? [-97.7431, 30.2672],
      zoom: props.zoom ?? 15,
    });

    m.addControl(new maplibregl.NavigationControl(), "top-right");

    // when the style finishes loading, ensure layers and initial data are present
    m.on("load", () => {
      // ensure sources/layers
      ensureGreensLayers(m);
      // set initial data if provided
      if (props.initialGeoJSON) updateGreensSource(props.initialGeoJSON);
      // refresh prop markers
      refreshPropMarkers();
    });

    // global handlers
    m.on("click", handleMapClick);

    m.on("mousemove", (e) => {
      if (internalMode() === "drawing") {
        updateDraftPreview(e.lngLat);
      }
    });

    // double-click to finish current draw
    m.on("dblclick", (e) => {
      if (internalMode() === "drawing") {
        addDraftVertex(e.lngLat);
        finishDraft();
      }
    });

    // clicks on the invisible wide line layer are handled in handleMapClick too via queryRenderedFeatures
    // but to be safe attach specific listeners for performance / reliability
    m.on("click", GREENS_HIT, (e) => {
      if (internalMode() === "editing" && e && e.features && e.features[0]) {
        const id = (e.features[0].properties as any)?.id;
        if (id) insertVertexAtEdge(id, e.lngLat);
      }
    });

    // clicking a fill can also select for editing
    m.on("click", GREENS_FILL, (e) => {
      if (e && e.features && e.features[0]) {
        const id = (e.features[0].properties as any)?.id;
        if (id) enterEditFeature(id);
      }
    });

    // expose map signal
    setMap(m);

    // keyboard handlers
    window.addEventListener("keydown", onKeyDown);

    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown);
      clearVertexMarkers();
      propMarkers.forEach((pm) => pm.remove());
      try {
        if (m) m.remove();
      } catch (_) {}
    });
  });

  // props.center -> flyTo
  createEffect(() => {
    const m = map();
    if (!m) return;
    if (props.center) {
      try {
        m.flyTo({ center: props.center, zoom: props.zoom ?? 15 });
      } catch (_) {}
    }
  });

  // props.markers -> refresh
  createEffect(() => {
    refreshPropMarkers();
  });

  // draft/active -> visuals
  createEffect(() => {
    const m = map();
    if (!m) return;
    // ensure layers ready
    if (!m.isStyleLoaded()) {
      m.once("styledata", () => syncDraftToMap());
      return;
    }
    syncDraftToMap();
  });

  // initialGeoJSON updates
  createEffect(() => {
    const m = map();
    if (!m) return;
    if (!props.initialGeoJSON) return;
    if (!m.isStyleLoaded()) {
      m.once("styledata", () => updateGreensSource(props.initialGeoJSON!));
      return;
    }
    updateGreensSource(props.initialGeoJSON);
  });

  // map edit mode controlled by props.mode: if parent requests 'draw' startDraft
  createEffect(() => {
    const pMode = props.mode;
    if (!pMode) {
      // nothing
      return;
    }
    if (pMode === "draw") {
      startDraft();
    } else if (pMode === "edit") {
      // parent expects click-to-select to enter edit; do not force select
      // set internal mode none so clicks can select
      setInternalMode("none");
    } else {
      // view / pick_location
      setInternalMode("none");
      setDraftPoly(null);
    }
  });

  // UI controls overlay + small in-map buttons for draw/edit lifecycle
  return (
    <div class="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900">
      <div ref={container} class="w-full h-full" />

      <div class="absolute top-4 left-4 z-20 flex gap-2">
        <button
          class="btn-small"
          onClick={() => {
            startDraft();
          }}
        >
          Start Draw
        </button>

        <Show when={internalMode() === "drawing"}>
          <button
            class="btn-small"
            onClick={() => {
              finishDraft();
            }}
          >
            Finish Draw
          </button>
          <button
            class="btn-small"
            onClick={() => {
              setDraftPoly(null);
              setInternalMode("none");
            }}
          >
            Cancel
          </button>
        </Show>

        <Show when={internalMode() === "editing"}>
          <button
            class="btn-small"
            onClick={() => {
              exitEdit();
            }}
          >
            Done Editing
          </button>
        </Show>
      </div>

      <Show when={props.mode === "pick_location"}>
        <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-emerald-500/50 z-10">
          Click to set location
        </div>
      </Show>
    </div>
  );
}