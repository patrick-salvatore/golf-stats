/// map_editor.tsx
import {
  createEffect,
  onMount,
  onCleanup,
  createSignal,
  JSX,
  Show,
  Accessor,
} from 'solid-js';
import { createShortcut } from '@solid-primitives/keyboard';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  DRAW_STYLES,
  ensureHeatmapLayer,
  GREENS_FILL,
  GREENS_HEATMAP,
  GREENS_HIT,
  GREENS_LINE,
  GREENS_POINT,
  GREENS_SRC,
  HEATMAP_SRC,
  makeFeatureId,
  SATELLITE_STYLE,
} from './map_editor_utils';
import { createStore } from 'solid-js/store';
import { MapMode } from './types';

type DrawMode = 'polygon' | 'point' | 'circle' | 'slope';
type Mode = 'view' | 'pick_location' | 'draw' | 'edit';

export interface MarkerSpec {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

export interface MapEditorProps {
  initialGeoJSON: GeoJSON.FeatureCollection | null;
  markers: Accessor<MarkerSpec[]>;
  center: [number, number];
  zoom?: number;
  mode: Accessor<Mode>;
  drawMode?: Accessor<DrawMode>;
  style?: any;
  onLocationPick?: (lat: number, lng: number) => void;
  onDrawCreate?: (feature: GeoJSON.Feature) => void;
  onDrawUpdate?: (feature: GeoJSON.Feature) => void;
  onDrawDelete?: (featureId: string) => void;
  onEditModeEnter?: () => void;
  onEditModeExit?: () => void;
}

type EditStore = {
  activeFeatureId: string | null;
  history: GeoJSON.FeatureCollection[];
  historyIndex: number | null;
  selectedVertexIndex: number | null;
};

export default function MapEditor(props: MapEditorProps): JSX.Element {
  let containerRef: HTMLDivElement | undefined;
  const [map, setMap] = createSignal<maplibregl.Map | null>(null);
  const [draw, setDraw] = createSignal<MapboxDraw | null>(null);

  const [internalMode, setInternalMode] = createSignal<MapMode>(
    props.mode?.() || 'view',
  );
  const [internalDrawMode, setinternalDrawMode] = createSignal(props.drawMode);
  const [draftPoly, setDraftPoly] = createSignal<GeoJSON.Polygon | null>(null);
  const [circleCenter, setCircleCenter] = createSignal<[number, number] | null>(
    null,
  );

  const [editStore, setEditStore] = createStore<EditStore>({
    activeFeatureId: null,
    history: [],
    historyIndex: -1,
    selectedVertexIndex: null,
  });

  let isMouseDown = false;
  let dragStart: maplibregl.LngLat | null = null;

  // Initialize Mapbox Draw
  function initDraw(m: maplibregl.Map) {
    const d = new MapboxDraw({
      displayControlsDefault: false,
      userProperties: true,
      styles: DRAW_STYLES,
      controls: {}, // We control modes programmatically
    });

    m.addControl(d as any);
    setDraw(d);

    m.on('draw.create', (e) => handleDrawEvent('create', e));
    m.on('draw.update', (e) => handleDrawEvent('update', e));
    m.on('draw.delete', (e) => handleDrawEvent('delete', e));
    m.on('draw.selectionchange', (e) => {
      const selected = e.features;
      if (selected.length > 0) {
        setInternalMode('edit');
        if (selected[0].id) {
          enterEditFeature(selected[0].id as string);
        }
      } else {
        exitEdit();
      }
    });

    // Initial Data Load
    if (props.initialGeoJSON) {
      d.set(props.initialGeoJSON);
      updateHeatmapSource(props.initialGeoJSON);
    }
  }

  function handleDrawEvent(type: 'create' | 'update' | 'delete', e: any) {
    const features = e.features;
    if (!features || features.length === 0) return;

    // Update heatmap source whenever features change
    const d = draw();
    if (d) {
      updateHeatmapSource(d.getAll());
    }

    features.forEach((f: any) => {
      // Ensure ID
      if (!f.id) f.id = makeFeatureId();
      // Ensure properties based on draw mode if missing
      if (type === 'create') {
        if (!f.properties) f.properties = {};
        if (!f.properties.id) f.properties.id = f.id;

        if (props.drawMode === 'slope' && f.geometry.type === 'Point') {
          f.properties.type = 'slope';
          f.properties.intensity = 1.0;
          // Must update back to Draw so it has the properties
          draw()?.add(f);
        } else if (f.geometry.type === 'Polygon') {
          // Default green type
          if (!f.properties.type) f.properties.type = 'green';
        }
      }

      const featureWithId = { ...f, id: f.id };

      if (type === 'create' && props.onDrawCreate) {
        props.onDrawCreate(featureWithId);
      } else if (type === 'update' && props.onDrawUpdate) {
        props.onDrawUpdate(featureWithId);
      } else if (type === 'delete' && props.onDrawDelete) {
        props.onDrawDelete(featureWithId.id as string);
      }
    });
  }

  function updateHeatmapSource(fc: GeoJSON.FeatureCollection) {
    const m = map();
    if (!m) return;
    const src = m.getSource(HEATMAP_SRC) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (src) {
      src.setData(fc as any);
    } else {
      // Create source if missing (unlikely if init order is correct)
    }
  }

  function refreshPropMarkers(markers: MarkerSpec[]) {
    const m = map();
    if (!m) return;

    const newMarkers: maplibregl.Marker[] = [];
    for (const mk of markers) {
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
      newMarkers.push(marker);
    }

    return newMarkers;
  }

  function startCircleDraft() {
    setCircleCenter(null);
    setDraftPoly(null);
    setInternalMode('drawing');
  }

  function updateCircleDraft(lngLat: maplibregl.LngLat) {
    const center = circleCenter();
    if (center) {
      const from = turf.point(center);
      const to = turf.point([lngLat.lng, lngLat.lat]);
      const radius = turf.distance(from, to, { units: 'kilometers' });
      const options = { steps: 64, units: 'kilometers' as const };
      const circle = turf.circle(center, radius, options);
      setDraftPoly(circle.geometry as GeoJSON.Polygon);
    }
  }

  function finishCircleDraft() {
    const dp = draftPoly();
    if (!dp) {
      setInternalMode('none');
      return;
    }
    const feat: GeoJSON.Feature = {
      type: 'Feature',
      id: makeFeatureId(),
      properties: { type: 'green', isCircle: true },
      geometry: dp,
    };

    // Add to Mapbox Draw manually
    draw()?.add(feat);
    handleDrawEvent('create', { features: [feat] });

    setDraftPoly(null);
    setCircleCenter(null);
    setInternalMode('none');
  }

  function syncDraftToMap() {
    const m = map();
    if (!m) return;

    const DRAFT_SRC_ID = 'draft-circle-src';

    if (!m.getSource(DRAFT_SRC_ID)) {
      m.addSource(DRAFT_SRC_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      } as any);

      m.addLayer({
        id: 'draft-circle-line',
        type: 'line',
        source: DRAFT_SRC_ID,
        paint: {
          'line-color': '#fbb03b',
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      } as any);
    }

    const src = m.getSource(DRAFT_SRC_ID) as maplibregl.GeoJSONSource;
    if (draftPoly()) {
      const coords = draftPoly()!.coordinates[0];
      const features: GeoJSON.Feature[] = [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords } as any,
        },
      ];
      src.setData({ type: 'FeatureCollection', features } as any);
    } else {
      src.setData({ type: 'FeatureCollection', features: [] } as any);
    }
  }

  function performUndo() {
    if (editStore.historyIndex && editStore.historyIndex > 0) {
      const idx = editStore.historyIndex - 1;
      const fc = editStore.history[idx];
      if (editStore.activeFeatureId) {
        const feat = fc.features.find(
          (f) => (f.properties as any)?.id === editStore.activeFeatureId,
        );
        if (feat && props.onDrawUpdate) {
          props.onDrawUpdate(feat);
        }
      }
      setEditStore('historyIndex', idx);
    }
  }

  function performRedo() {
    if (
      editStore.historyIndex &&
      editStore.historyIndex < editStore.history.length - 1
    ) {
      const idx = editStore.historyIndex + 1;
      const fc = editStore.history[idx];

      if (editStore.activeFeatureId) {
        const feat = fc.features.find(
          (f) => (f.properties as any)?.id === editStore.activeFeatureId,
        );
        if (feat && props.onDrawUpdate) {
          props.onDrawUpdate(feat);
        }
      }

      setEditStore('historyIndex', idx);
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

  function handleDelete() {
    if (internalMode() === 'editing' && editStore.activeFeatureId) {
      if (editStore.selectedVertexIndex !== null) {
        deleteVertex(
          editStore.activeFeatureId!,
          editStore.selectedVertexIndex!,
        );
        setSelectedVertexIndex(undefined);
        return;
      }
      if (props.onDrawDelete) {
        props.onDrawDelete(editStore.activeFeatureId!);
        exitEdit();
      }
    }
  }

  function enterEditFeature(featureId: string) {
    setEditStore('activeFeatureId', featureId);
    setInternalMode('editing');
    props.onEditModeEnter?.();
  }

  function exitEdit() {
    setEditStore('activeFeatureId', null);
    setInternalMode('none');
    // clearVertexMarkers();
    props.onEditModeExit?.();
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
    if (internalMode() === 'pick_location' && props.onLocationPick) {
      props.onLocationPick(e.lngLat.lat, e.lngLat.lng);
    }

    // if (internalMode() === 'drawing') {
    //   addDraftVertex(e.lngLat);
    //   return;
    // }

    // const m = map();
    // if (!m) return;
    // const features = m.queryRenderedFeatures(e.point, {
    //   layers: [GREENS_FILL],
    // });
    // console.log(e, features)
    // if (features?.length) {
    //   const f = features[0];
    //   const id = (f.properties as any)?.id as string | undefined;
    //   if (id) {
    //     enterEditFeature(id);
    //     return;
    //   }
    // }

    // if (internalMode() === 'editing') {
    //   const edgeFeatures = m.queryRenderedFeatures(e.point, {
    //     layers: [GREENS_HIT],
    //   });
    //   if (edgeFeatures?.length) {
    //     const f = edgeFeatures[0];
    //     const id = (f.properties as any)?.id as string | undefined;
    //     if (id) insertVertexAtEdge(id, e.lngLat);
    //   } else {
    //     setSelectedVertexIndex(undefined);
    //   }
    // }
  }

  function ensureGreensLayers(m: maplibregl.Map) {
    if (!m.getStyle()) return;

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

    if (!m.getLayer(GREENS_HEATMAP)) {
      m.addLayer({
        id: GREENS_HEATMAP,
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

    // console.log(m.getLayer(GREENS_POINT) )
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

  // undo / redo
  createShortcut(['Meta', 'z'], performUndo);
  createShortcut(['Meta', 'Shift', 'z'], performRedo);

  // delete
  createShortcut(['Delete'], handleDelete, { preventDefault: false });
  createShortcut(['Backspace'], handleDelete, {
    preventDefault: false,
  });

  // exit / save
  createShortcut(['Escape'], () => {
    if (internalMode() === 'draw') {
      setDraftPoly(null);
      setCircleCenter(null);
      setInternalMode('view');
    } else if (internalMode() === 'edit') {
      exitEdit();
    }
  });
  createShortcut(['Enter'], () => {
    if (internalMode() === 'draw') {
      finishDraft();
    }
  });

  createEffect(() => {
    setInternalMode(props.mode());
  });

  // update map markers when props.markers change
  createEffect((prevMarkers: maplibregl.Marker[] | undefined) => {
    const markers = props.markers?.();
    prevMarkers?.forEach((pm) => pm.remove());
    const newMarkers = refreshPropMarkers(markers);
    return newMarkers;
  });

  // createEffect(() => {
  //   const d = draw();
  //   if (!d) return;

  //   if (props.mode === 'draw') {
  //     if (props.drawMode === 'polygon') {
  //       d.changeMode('draw_polygon');
  //     } else if (props.drawMode === 'point' || props.drawMode === 'slope') {
  //       d.changeMode('draw_point');
  //     } else if (props.drawMode === 'circle') {
  //       d.changeMode('simple_select'); // Stop native draw
  //       startCircleDraft();
  //     }
  //   } else if (props.mode === 'edit') {
  //     d.changeMode('simple_select');
  //   } else if (props.mode === 'view') {
  //     d.changeMode('simple_select');
  //     // Deselect all
  //     d.changeMode('simple_select', { featureIds: [] });
  //   } else {
  //     d.changeMode('simple_select');
  //   }
  // });

  // createEffect(() => {
  //   const d = draw();
  //   if (!d || !props.initialGeoJSON) return;

  //   const current = d.getAll();
  //   if (
  //     current.features.length === 0 &&
  //     props.initialGeoJSON.features.length > 0
  //   ) {
  //     d.set(props.initialGeoJSON);
  //     updateHeatmapSource(props.initialGeoJSON);
  //   }
  // });

  // createEffect((prevCenter: [number, number] | undefined) => {
  //   const m = map();
  //   if (!m) return props.center;
  //   if (props.center) {
  //     const [lng, lat] = props.center;
  //     const [pLng, pLat] = prevCenter || [null, null];
  //     if (lng !== pLng || lat !== pLat) {
  //       try {
  //         m.flyTo({ center: props.center, zoom: props.zoom ?? 15 });
  //       } catch (_) {}
  //     }
  //   }
  //   return props.center;
  // });

  onMount(() => {
    if (!containerRef) return;

    const m = new maplibregl.Map({
      container: containerRef,
      style: props.style ?? (SATELLITE_STYLE as any),
      center: props.center ?? [-97.7431, 30.2672],
      zoom: props.zoom ?? 15,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });

    m.addControl(new maplibregl.NavigationControl(), 'top-right');

    m.on('load', () => {
      initDraw(m);
      setMap(m);
      setInternalMode(props.mode());
      // syncDraftToMap();
    });

    // m.on('styledata', () => {
    //   ensureGreensLayers(m);
    //   ensureHeatmapLayer(m);
    // });

    // m.on('mousedown', (e) => {
    //   if (internalMode() === 'drawing' && props.drawMode === 'circle') {
    //     isMouseDown = true;
    //     dragStart = e.lngLat;
    //     m.dragPan.disable();
    //   }
    // });

    // m.on('mousemove', (e) => {
    //   if (internalMode() === 'drawing' && props.drawMode === 'circle') {
    //     if (isMouseDown && dragStart && !circleCenter()) {
    //       setCircleCenter([dragStart.lng, dragStart.lat]);
    //     }
    //     updateCircleDraft(e.lngLat);
    //   }
    // });

    // m.on('mouseup', () => {
    //   if (internalMode() === 'drawing' && props.drawMode === 'circle') {
    //     if (isMouseDown && circleCenter()) {
    //       finishCircleDraft();
    //     }
    //     isMouseDown = false;
    //     dragStart = null;
    //     m.dragPan.enable();
    //   }
    // });

    m.on('click', handleMapClick);

    // m.on('click', GREENS_HIT, (e) => {
    //   if (internalMode() === 'editing' && e && e.features && e.features[0]) {
    //     const id = (e.features[0].properties as any)?.id;
    //     if (id) insertVertexAtEdge(id, e.lngLat);
    //   }
    // });

    // m.on('click', GREENS_FILL, (e) => {
    //   if (e && e.features && e.features[0]) {
    //     const id = (e.features[0].properties as any)?.id;
    //     if (id) enterEditFeature(id);
    //   }
    // });

    // m.on('click', GREENS_POINT, (e) => {
    //   console.log(e);
    // if (e && e.features && e.features[0]) {
    //   const id = (e.features[0].properties as any)?.id;
    //   if (id) enterEditFeature(id);
    // }
    // });
  });

  onCleanup(() => {
    const m = map();
    const d = draw();
    if (m && d) {
      m.removeControl(d as any);
    }
    m?.remove();
  });

  return (
    <div class="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900">
      <div ref={containerRef} class="w-full h-full" />
      <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg border border-slate-700 z-10 flex items-center gap-2">
        <div
          class={`w-2 h-2 rounded-full ${internalMode() === 'edit' ? 'bg-amber-500' : 'bg-blue-500'} animate-pulse`}
        />
        <span class="uppercase tracking-wider">{internalMode()}</span>
      </div>
      <Show when={props.mode?.() === 'pick_location'}>
        <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-emerald-500/50 z-10">
          Click to set location
        </div>
      </Show>
    </div>
  );
}
