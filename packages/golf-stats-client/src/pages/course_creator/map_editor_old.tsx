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
import {
  TRAJECTORY_STYLES,
  calculateTrajectoryDistance,
  formatYardage,
} from './trajectory_utils';

type DrawMode = 'polygon' | 'point' | 'circle' | 'slope' | 'trajectory';
type Mode = 'view' | 'pick_location' | 'draw' | 'edit';

export interface MarkerSpec {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

export type MapEditorProps = {
  initialGeoJSON: GeoJSON.FeatureCollection | null;
  markers: Accessor<MarkerSpec[]>;
  center: [number, number];
  zoom?: number;
  mode: Accessor<Mode>;
  drawMode?: Accessor<DrawMode>;
  style?: any;
  trajectory?: GeoJSON.LineString | null;
  onLocationPick?: (lat: number, lng: number) => void;
  onDrawCreate?: (feature: GeoJSON.Feature) => void;
  onDrawUpdate?: (feature: GeoJSON.Feature) => void;
  onDrawDelete?: (featureId: string) => void;
  onEditModeEnter?: () => void;
  onEditModeExit?: () => void;
};

type EditStore = {
  activeFeatureId: string | null;
  history: GeoJSON.FeatureCollection[];
  historyIndex: number;
  selectedVertexIndex: number | null;
  undoStack: GeoJSON.FeatureCollection[];
  redoStack: GeoJSON.FeatureCollection[];
};

export default function MapEditor(props: MapEditorProps): JSX.Element {
  let containerRef: HTMLDivElement | undefined;
  let tooltipRef: HTMLDivElement | undefined;
  const [map, setMap] = createSignal<maplibregl.Map | null>(null);
  const [draw, setDraw] = createSignal<MapboxDraw | null>(null);
  const [tooltip, setTooltip] = createSignal<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const [internalMode, setInternalMode] = createSignal<MapMode>(
    props.mode?.() || 'view',
  );
  const [internalDrawMode, setinternalDrawMode] = createSignal<DrawMode>(
    props.drawMode?.() || 'point',
  );
  const [draftPoly, setDraftPoly] = createSignal<GeoJSON.Polygon | null>(null);
  const [circleCenter, setCircleCenter] = createSignal<[number, number] | null>(
    null,
  );

  const [editStore, setEditStore] = createStore<EditStore>({
    activeFeatureId: null,
    history: [],
    historyIndex: -1,
    selectedVertexIndex: null,
    undoStack: [],
    redoStack: [],
  });

  let isMouseDown = false;
  let dragStart: maplibregl.LngLat | null = null;

  // Initialize Mapbox Draw
  function initDraw(m: maplibregl.Map) {
    // Clean up any existing draw instance first
    const existingDraw = draw();
    if (existingDraw) {
      try {
        m.removeControl(existingDraw as any);
      } catch (e) {
        console.warn('Could not remove existing draw control:', e);
      }
      setDraw(null);
    }

    // Check if MapboxDraw sources already exist and clean them up
    const drawSources = ['mapbox-gl-draw-cold', 'mapbox-gl-draw-hot'];
    drawSources.forEach((sourceId) => {
      if (m.getSource(sourceId)) {
        try {
          m.removeSource(sourceId);
        } catch (e) {
          // Source might be in use by layers, remove those first
          const style = m.getStyle();
          if (style && style.layers) {
            style.layers.forEach((layer: any) => {
              if (layer.source === sourceId) {
                try {
                  m.removeLayer(layer.id);
                } catch (err) {
                  console.warn(`Could not remove layer ${layer.id}:`, err);
                }
              }
            });
          }
          // Try removing source again
          try {
            m.removeSource(sourceId);
          } catch (err) {
            console.warn(`Could not remove source ${sourceId}:`, err);
          }
        }
      }
    });

    // Create new MapboxDraw instance
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

    // Listen for drawing mode changes to update vertices
    m.on('draw.modechange', (e) => {
      if (e.mode === 'draw_line_string') {
        // Starting to draw trajectory
        setTimeout(() => updateDrawingVertices(), 50);
      } else {
        // Clear drawing vertices when not drawing
        const src = m.getSource('drawing-vertices') as maplibregl.GeoJSONSource;
        if (src) {
          src.setData({ type: 'FeatureCollection', features: [] } as any);
        }
      }
    });

    // Update vertices while drawing (for real-time feedback)
    m.on('draw.actionable', () => {
      if (props.drawMode?.() === 'trajectory') {
        updateDrawingVertices();
      }
    });

    // Initial Data Load
    if (props.initialGeoJSON) {
      // Filter out trajectory from initialGeoJSON if it exists in props.trajectory
      const filteredFeatures = props.initialGeoJSON.features.filter(
        (f: any) => (f.properties as any)?.type !== 'trajectory',
      );
      const filteredGeoJSON = {
        ...props.initialGeoJSON,
        features: filteredFeatures,
      };
      d.set(filteredGeoJSON);
      updateHeatmapSource(filteredGeoJSON);
    }
  }

  function initTrajectoryLayer(m: maplibregl.Map) {
    try {
      // Add source for trajectory lines
      if (!m.getSource('trajectory-source')) {
        m.addSource('trajectory-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        } as any);
      }

      // Add trajectory line layer
      if (!m.getLayer('trajectory-line')) {
        m.addLayer({
          id: 'trajectory-line',
          type: 'line',
          source: 'trajectory-source',
          paint: TRAJECTORY_STYLES.viewing,
        } as any);
      }

      // Add distance markers layer
      if (!m.getLayer('trajectory-markers')) {
        m.addLayer({
          id: 'trajectory-markers',
          type: 'symbol',
          source: 'trajectory-source',
          filter: ['==', '$type', 'Point'],
          layout: {
            'text-field': ['get', 'distance'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-anchor': 'center',
            'text-offset': [0, -1.5],
          },
          paint: {
            'text-color': '#3B82F6',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        } as any);
      }

      // Add source for drawing trajectory vertices (to show distances while drawing)
      if (!m.getSource('drawing-vertices')) {
        m.addSource('drawing-vertices', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        } as any);
      }

      // Add layer to show vertex numbers/distances while drawing
      if (!m.getLayer('drawing-vertex-labels')) {
        m.addLayer({
          id: 'drawing-vertex-labels',
          type: 'symbol',
          source: 'drawing-vertices',
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-anchor': 'center',
            'text-offset': [0, -2],
          },
          paint: {
            'text-color': '#1D4ED8',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        } as any);
      }
    } catch (e) {
      console.warn('Error initializing trajectory layers:', e);
    }
  }

  function handleDrawEvent(type: 'create' | 'update' | 'delete', e: any) {
    const features = e.features;
    if (!features || features.length === 0) return;

    // Save state for undo functionality (but only for user actions, not programmatic changes)
    if (type === 'create' || type === 'update' || type === 'delete') {
      // Small delay to ensure the draw state is updated
      setTimeout(() => saveDrawState(), 10);
    }

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

        if (props.drawMode?.() === 'slope' && f.geometry.type === 'Point') {
          f.properties.type = 'slope';
          f.properties.intensity = 1.0;
          // Must update back to Draw so it has the properties
          draw()?.add(f);
        } else if (
          f.geometry.type === 'LineString' &&
          props.drawMode?.() === 'trajectory'
        ) {
          f.properties.type = 'trajectory';
          // Calculate and display distance
          const distance = calculateTrajectoryDistance(f.geometry);
          f.properties.distance = formatYardage(distance);
          // Clear drawing vertices after trajectory is created
          setTimeout(() => updateDrawingVertices(), 50);
        } else if (f.geometry.type === 'Polygon') {
          // Default green type
          if (!f.properties.type) f.properties.type = 'green';
        }
      }

      // Update drawing vertices for trajectory
      if (props.drawMode?.() === 'trajectory') {
        setTimeout(() => updateDrawingVertices(), 50);
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

  function updateDrawingVertices() {
    const m = map();
    const d = draw();
    if (!m || !d) return;

    const src = m.getSource('drawing-vertices') as maplibregl.GeoJSONSource;
    if (!src) return;

    // Get all features being drawn
    const allFeatures = d.getAll();
    const vertexFeatures: GeoJSON.Feature[] = [];

    // Find active LineString (trajectory being drawn)
    allFeatures.features.forEach((feature: any) => {
      if (
        feature.geometry?.type === 'LineString' &&
        (feature.properties?.active === 'true' ||
          props.drawMode?.() === 'trajectory')
      ) {
        const coords = feature.geometry.coordinates;
        let cumulativeDistance = 0;

        coords.forEach((coord: [number, number], index: number) => {
          // Calculate cumulative distance
          if (index > 0) {
            const from = turf.point(coords[index - 1]);
            const to = turf.point(coord);
            const segmentDistance = turf.distance(from, to, { units: 'yards' });
            cumulativeDistance += segmentDistance;
          }

          // Create a point feature for each vertex with its distance label
          vertexFeatures.push({
            type: 'Feature',
            properties: {
              label:
                index === 0 ? 'Start' : `${Math.round(cumulativeDistance)} yds`,
              vertexIndex: index,
            },
            geometry: {
              type: 'Point',
              coordinates: coord,
            },
          });
        });
      }
    });

    src.setData({
      type: 'FeatureCollection',
      features: vertexFeatures,
    } as any);
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
    setInternalMode('draw');
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
      setInternalMode('view');
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
    setInternalMode('view');
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

  function saveDrawState() {
    const d = draw();
    if (!d) return;

    const currentState = d.getAll();
    setEditStore('undoStack', [...editStore.undoStack, currentState]);
    // Clear redo stack when new action is performed
    setEditStore('redoStack', []);
  }

  function performUndo() {
    const d = draw();
    if (!d) return;

    if (editStore.undoStack.length === 0) {
      console.log('Nothing to undo');
      return;
    }

    // Save current state to redo stack
    const currentState = d.getAll();
    setEditStore('redoStack', [...editStore.redoStack, currentState]);

    // Get previous state from undo stack
    const undoStack = [...editStore.undoStack];
    const previousState = undoStack.pop();
    setEditStore('undoStack', undoStack);

    if (previousState) {
      // Apply the previous state
      d.set(previousState);

      // Notify parent component about changes
      if (props.onDrawUpdate) {
        // Find trajectory feature if it exists
        const trajectoryFeature = previousState.features.find(
          (f: any) => f.properties?.type === 'trajectory',
        );
        if (trajectoryFeature) {
          props.onDrawUpdate(trajectoryFeature as GeoJSON.Feature);
        }
      }
    }
  }

  function performRedo() {
    const d = draw();
    if (!d) return;

    if (editStore.redoStack.length === 0) {
      console.log('Nothing to redo');
      return;
    }

    // Save current state to undo stack
    const currentState = d.getAll();
    setEditStore('undoStack', [...editStore.undoStack, currentState]);

    // Get next state from redo stack
    const redoStack = [...editStore.redoStack];
    const nextState = redoStack.pop();
    setEditStore('redoStack', redoStack);

    if (nextState) {
      // Apply the next state
      d.set(nextState);

      // Notify parent component about changes
      if (props.onDrawUpdate) {
        // Find trajectory feature if it exists
        const trajectoryFeature = nextState.features.find(
          (f: any) => f.properties?.type === 'trajectory',
        );
        if (trajectoryFeature) {
          props.onDrawUpdate(trajectoryFeature as GeoJSON.Feature);
        }
      }
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
    // setupVertexMarkersForPolygon(updatedPoly, featureId);
    if (props.onDrawUpdate) {
      props.onDrawUpdate({
        type: 'Feature',
        properties: { ...(feat.properties as any) },
        geometry: updatedPoly,
      });
    }
  }

  function handleDelete() {
    if (internalMode() === 'edit' && editStore.activeFeatureId) {
      if (editStore.selectedVertexIndex !== null) {
        deleteVertex(
          editStore.activeFeatureId!,
          editStore.selectedVertexIndex!,
        );
        // setSelectedVertexIndex(undefined);
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
    setInternalMode('edit');
    props.onEditModeEnter?.();
  }

  function exitEdit() {
    setEditStore('activeFeatureId', null);
    setInternalMode('view');
    // clearVertexMarkers();
    props.onEditModeExit?.();
  }

  function finishDraft() {
    if (internalDrawMode() === 'circle') {
      const dp = draftPoly();
      if (!dp) {
        setInternalMode('view');
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
      setInternalMode('view');
      return;
    }

    const dp = draftPoly();
    if (!dp) return;
    const ring = dp.coordinates[0].slice();
    if (ring.length < 3) {
      setDraftPoly(null);
      setInternalMode('view');
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
    setInternalMode('view');
  }

  // Initialize hover handlers for better feature interaction
  function initHoverHandlers(m: maplibregl.Map) {
    let hoveredFeatureId: string | number | null = null;
    let hoveredSource: string | null = null;

    // Handle mouse move for hover effects
    m.on('mousemove', (e) => {
      // Get features at the mouse position from MapboxDraw layers
      const drawLayers = [
        'gl-draw-polygon-fill-inactive.cold',
        'gl-draw-polygon-stroke-inactive.cold',
        'gl-draw-line-inactive.cold',
        'gl-draw-point-inactive.cold',
        'gl-draw-polygon-and-line-vertex-stroke-inactive.cold',
        'gl-draw-polygon-midpoint.cold',
        'gl-draw-polygon-fill-active.hot',
        'gl-draw-polygon-stroke-active.hot',
        'gl-draw-line-active.hot',
        'gl-draw-point-active.hot',
        'gl-draw-polygon-and-line-vertex-stroke-active.hot',
      ];

      // Query features under the mouse
      const features = m.queryRenderedFeatures(e.point, {
        layers: drawLayers.filter((layer) => m.getLayer(layer)),
      });

      // Remove previous hover state
      if (hoveredFeatureId !== null && hoveredSource) {
        m.setFeatureState(
          { source: hoveredSource, id: hoveredFeatureId },
          { hover: false },
        );
      }

      // Apply new hover state and show tooltip
      if (features.length > 0) {
        const feature = features[0];
        hoveredFeatureId = feature.id || null;
        hoveredSource = feature.source;

        if (hoveredFeatureId !== null && hoveredSource) {
          m.setFeatureState(
            { source: hoveredSource, id: hoveredFeatureId },
            { hover: true },
          );
        }

        // Update cursor and tooltip based on feature type
        const meta = feature.properties?.meta;
        let tooltipText = '';

        if (meta === 'vertex') {
          m.getCanvas().style.cursor = 'move';
          tooltipText = 'Drag to move vertex • Delete to remove';
        } else if (meta === 'midpoint') {
          m.getCanvas().style.cursor = 'cell';
          tooltipText = 'Click to add vertex';
        } else if (feature.properties?.active === 'true') {
          m.getCanvas().style.cursor = 'move';
          tooltipText = 'Selected - Edit vertices or press Delete';
        } else {
          m.getCanvas().style.cursor = 'pointer';
          const type = feature.properties?.type || feature.geometry?.type;
          if (type === 'trajectory') {
            tooltipText = `Trajectory • ${feature.properties?.distance || 'Click to edit'}`;
          } else if (type === 'green' || feature.geometry?.type === 'Polygon') {
            tooltipText = 'Green • Click to edit';
          } else if (type === 'slope' || feature.geometry?.type === 'Point') {
            tooltipText = 'Slope point • Click to edit';
          } else {
            tooltipText = 'Click to edit';
          }
        }

        // Update tooltip
        if (tooltipText) {
          setTooltip({
            x: e.point.x,
            y: e.point.y - 30,
            text: tooltipText,
          });
        }
      } else {
        hoveredFeatureId = null;
        hoveredSource = null;
        m.getCanvas().style.cursor = '';
        setTooltip(null);
      }
    });

    // Reset hover state when mouse leaves the map
    m.on('mouseleave', () => {
      if (hoveredFeatureId !== null && hoveredSource) {
        m.setFeatureState(
          { source: hoveredSource, id: hoveredFeatureId },
          { hover: false },
        );
      }
      hoveredFeatureId = null;
      hoveredSource = null;
      m.getCanvas().style.cursor = '';
      setTooltip(null);
    });
  }

  function handleMapClick(e: maplibregl.MapMouseEvent) {
    if (internalMode() === 'pick_location' && props.onLocationPick) {
      props.onLocationPick(e.lngLat.lat, e.lngLat.lng);
      return;
    }

    // Enable feature selection when not in drawing mode
    const d = draw();
    if (d && internalMode() === 'view') {
      // Query features at click point
      const drawLayers = [
        'gl-draw-polygon-fill-inactive.cold',
        'gl-draw-polygon-stroke-inactive.cold',
        'gl-draw-line-inactive.cold',
        'gl-draw-point-inactive.cold',
      ];

      const features = map()?.queryRenderedFeatures(e.point, {
        layers: drawLayers.filter((layer) => map()?.getLayer(layer)),
      });

      if (features && features.length > 0) {
        const feature = features[0];
        if (feature.id) {
          // Select the feature for editing
          // @ts-ignore
          d.changeMode('direct_select', { featureId: feature.id });
          setInternalMode('edit');
        }
      }
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

  // Custom keyboard event handling
  function setupKeyboardHandlers() {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for certain combinations to avoid browser conflicts
      const isMeta = e.metaKey || e.ctrlKey;

      // Undo: Cmd+Z / Ctrl+Z
      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
      }
      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
      else if (isMeta && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        performRedo();
      }
      // Delete/Backspace
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete();
      }
      // Escape - exit drawing or editing mode
      else if (e.key === 'Escape') {
        if (internalMode() === 'draw') {
          setDraftPoly(null);
          setCircleCenter(null);
          setInternalMode('view');
          // Also cancel any active MapboxDraw drawing
          const d = draw();
          if (d) {
            d.changeMode('simple_select');
          }
        } else if (internalMode() === 'edit') {
          exitEdit();
        }
      }
      // Enter - finish drawing
      else if (e.key === 'Enter') {
        if (internalMode() === 'draw') {
          finishDraft();
        }
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Return cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }

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

  // Update trajectory layer when props.trajectory changes
  createEffect(() => {
    const m = map();
    if (!m) return;

    const src = m.getSource('trajectory-source') as maplibregl.GeoJSONSource;
    if (!src) return;

    if (props.trajectory) {
      const trajectoryFeature: GeoJSON.Feature = {
        type: 'Feature',
        properties: { type: 'trajectory' },
        geometry: props.trajectory,
      };

      src.setData({
        type: 'FeatureCollection',
        features: [trajectoryFeature],
      } as any);
    } else {
      src.setData({
        type: 'FeatureCollection',
        features: [],
      } as any);
    }
  });

  createEffect(() => {
    const d = draw();
    if (!d) return;

    if (props.mode() === 'draw') {
      if (props.drawMode?.() === 'polygon') {
        d.changeMode('draw_polygon');
      } else if (
        props.drawMode?.() === 'point' ||
        props.drawMode?.() === 'slope'
      ) {
        d.changeMode('draw_point');
      } else if (props.drawMode?.() === 'trajectory') {
        d.changeMode('draw_line_string');
      } else if (props.drawMode?.() === 'circle') {
        d.changeMode('simple_select'); // Stop native draw
        startCircleDraft();
      }
    } else if (props.mode() === 'edit') {
      // Use direct_select mode for better vertex editing
      const selected = d.getSelected();
      if (selected.features.length > 0) {
        // @ts-ignore
        d.changeMode('direct_select', { featureId: selected.features[0].id });
      } else {
        d.changeMode('simple_select');
      }
    } else if (props.mode() === 'view') {
      d.changeMode('simple_select');
      // Deselect all
      d.changeMode('simple_select', { featureIds: [] });
    } else {
      d.changeMode('simple_select');
    }
  });

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

    // Setup keyboard handlers
    const cleanupKeyboard = setupKeyboardHandlers();

    const m = new maplibregl.Map({
      container: containerRef,
      style: props.style ?? (SATELLITE_STYLE as any),
      center: props.center ?? [-97.7431, 30.2672],
      zoom: props.zoom ?? 15,
      minZoom: 14, // Prevent zooming out too far from the hole
      maxZoom: 20, // Allow detailed zoom for precise drawing
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });

    m.addControl(new maplibregl.NavigationControl(), 'top-right');

    m.on('load', () => {
      initDraw(m);
      initTrajectoryLayer(m);
      initHoverHandlers(m);
      setMap(m);
      setInternalMode(props.mode());
      // syncDraftToMap();
    });

    // Store cleanup function for onCleanup
    onCleanup(cleanupKeyboard);

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

    // Remove draw control and clean up its sources/layers
    if (m && d) {
      try {
        // Remove the control
        m.removeControl(d as any);

        // Clean up MapboxDraw sources and layers
        const drawSources = ['mapbox-gl-draw-cold', 'mapbox-gl-draw-hot'];
        const style = m.getStyle();

        // Remove layers first
        if (style && style.layers) {
          style.layers.forEach((layer: any) => {
            if (drawSources.includes(layer.source)) {
              try {
                m.removeLayer(layer.id);
              } catch (err) {
                console.warn(`Could not remove layer ${layer.id}:`, err);
              }
            }
          });
        }

        // Then remove sources
        drawSources.forEach((sourceId) => {
          if (m.getSource(sourceId)) {
            try {
              m.removeSource(sourceId);
            } catch (err) {
              console.warn(`Could not remove source ${sourceId}:`, err);
            }
          }
        });
      } catch (e) {
        console.warn('Error during draw cleanup:', e);
      }
    }

    // Finally remove the map
    m?.remove();
  });

  return (
    <div class="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900">
      <div ref={containerRef} class="w-full h-full" />
      <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg border border-slate-700 z-10 flex items-center gap-2">
        <div
          class={`w-2 h-2 rounded-full ${internalMode() === 'edit' ? 'bg-amber-500' : 'bg-blue-500'} animate-pulse`}
        />
        <span class="uppercase tracking-wider">
          {internalMode()}
          {props.mode?.() === 'draw' &&
            props.drawMode?.() === 'trajectory' &&
            ' - Click points along fairway, double-click to finish'}
        </span>
      </div>
      <Show when={props.mode?.() === 'pick_location'}>
        <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-emerald-500/50 z-10">
          Click to set location
        </div>
      </Show>
      <Show when={tooltip()}>
        {(t) => (
          <div
            ref={tooltipRef}
            class="absolute pointer-events-none bg-slate-900/95 text-white px-2 py-1 rounded text-xs font-medium shadow-lg border border-slate-600 z-20"
            style={{
              left: `${t().x}px`,
              top: `${t().y}px`,
              transform: 'translate(-50%, 0)',
            }}
          >
            {t().text}
          </div>
        )}
      </Show>
    </div>
  );
}
