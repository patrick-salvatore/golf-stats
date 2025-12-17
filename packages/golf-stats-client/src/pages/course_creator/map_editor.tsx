/// map_editor.tsx - Refactored to use MapDrawingManager
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
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SATELLITE_STYLE } from './map_editor_utils';
import {
  MapDrawingManager,
  TooltipData,
  HoleMetadata,
} from './map_drawing_manager';
import { FeatureType, HoleFeature } from './types';

type DrawMode = 'polygon' | 'point' | 'circle' | 'slope' | 'trajectory';
type Mode = 'view' | 'pick_location' | 'draw' | 'edit';

export interface MarkerSpec {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

export interface MapEditorRef {
  saveCurrentState: () => Promise<void>;
}

export interface MapEditorProps {
  features: Accessor<GeoJSON.FeatureCollection>;
  trajectory: Accessor<HoleFeature<'trajectory'> | null>;

  // Existing props
  markers: Accessor<MarkerSpec[]>;
  center: [number, number];
  zoom?: number;
  mode: Accessor<Mode>;
  drawMode?: Accessor<DrawMode>;
  style?: any;
  onLocationPick?: (lat: number, lng: number) => void;

  courseId?: number;
  holeNumber?: number;

  getCurrentHoleMetadata?: () => HoleMetadata;
  onHoleStateRestore?: (
    features: GeoJSON.FeatureCollection,
    metadata: HoleMetadata,
  ) => void;

  ref?: (ref: MapEditorRef) => void;

  onFeatureCreate?: (
    type: FeatureType,
    geometry: GeoJSON.Geometry,
    properties?: any,
  ) => void;
  onFeatureUpdate?: (
    featureId: string,
    updates: { geometry?: GeoJSON.Geometry; properties?: any },
  ) => void;
  onFeatureDelete?: (featureId: string) => void;
  onEditModeEnter?: () => void;
  onEditModeExit?: () => void;

  // DEPRECATED: Legacy callbacks for backward compatibility
  initialGeoJSON?: GeoJSON.FeatureCollection | null; // For backward compatibility
  onDrawCreate?: (feature: GeoJSON.Feature) => void;
  onDrawUpdate?: (feature: GeoJSON.Feature) => void;
  onDrawDelete?: (featureId: string) => void;
}

export default function MapEditor(props: MapEditorProps): JSX.Element {
  let containerRef: HTMLDivElement | undefined;
  let tooltipRef: HTMLDivElement | undefined;

  // Signals for map and manager instances
  const [map, setMap] = createSignal<maplibregl.Map | null>(null);
  const [manager, setManager] = createSignal<MapDrawingManager | null>(null);

  // UI state
  const [tooltip, setTooltip] = createSignal<TooltipData | null>(null);
  const [internalMode, setInternalMode] = createSignal<Mode>(
    props.mode() || 'view',
  );

  // Circle drawing state (for custom circle mode)
  const [draftPoly, setDraftPoly] = createSignal<GeoJSON.Polygon | null>(null);
  const [circleCenter, setCircleCenter] = createSignal<[number, number] | null>(
    null,
  );

  let isMouseDown = false;
  let dragStart: maplibregl.LngLat | null = null;

  // Update mode display when props change
  createEffect(() => {
    setInternalMode(props.mode());
  });

  // Update map markers when props.markers change
  createEffect((prevMarkers: maplibregl.Marker[] | undefined) => {
    const markers = props.markers?.();
    const m = map();

    if (!m) return;

    // Remove previous markers
    prevMarkers?.forEach((pm) => pm.remove());

    // Add new markers
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

      marker.on('click', console.log);

      newMarkers.push(marker);
    }

    return newMarkers;
  });

  // Update trajectory when it changes
  createEffect(() => {
    const mgr = manager();
    if (mgr && props.trajectory?.()) {
      mgr.setTrajectory(props.trajectory()?.geometry as GeoJSON.LineString);
    } else if (mgr) {
      mgr.setTrajectory(null);
    }
  });

  // Update features when they change (when currentHole changes)
  createEffect(() => {
    const mgr = manager();
    const features = props.features();

    if (mgr && features) {
      // Clear existing features and reload with new ones
      const drawInstance = mgr.getDrawInstance();
      if (drawInstance) {
        drawInstance.deleteAll();
        if (features.features.length > 0) {
          drawInstance.set(features);
        }
        // Ensure we're in simple select mode (not drawing mode)
        drawInstance.changeMode('simple_select');
      }
    }
  });

  // Update drawing mode when it changes
  createEffect(() => {
    const mgr = manager();
    const drawInstance = mgr?.getDrawInstance();
    const drawMode = props.drawMode?.();
    if (!drawInstance || !mgr || !drawMode) return;

    if (props.mode() === 'draw') {
      if (drawMode === 'polygon') {
        mgr.changeMode('draw_polygon');
      } else if (drawMode === 'point' || drawMode === 'slope') {
        mgr.changeMode('draw_point');
      } else if (drawMode === 'trajectory') {
        mgr.changeMode('draw_line_string');
      } else if (drawMode === 'circle') {
        mgr.changeMode('simple_select');
        startCircleDraft();
      }
    } else if (props.mode() === 'edit') {
      const selected = mgr.getSelectedFeatures();
      if (selected.length > 0) {
        mgr.changeMode('direct_select', { featureId: selected[0].id });
      } else {
        mgr.changeMode('simple_select');
      }
    } else if (props.mode() === 'view') {
      mgr.changeMode('simple_select', { featureIds: [] });
    } else {
      mgr.changeMode('simple_select');
    }
  });

  // Circle drawing functions
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

    const id = `green.${window.crypto.randomUUID()}`;
    const feat: GeoJSON.Feature = {
      type: 'Feature',
      id: id,
      properties: { type: 'green', isCircle: true, id },
      geometry: dp,
    };

    // Add to MapboxDraw
    const mgr = manager();
    const drawInstance = mgr?.getDrawInstance();
    if (drawInstance) {
      drawInstance.add(feat);
    }

    // Notify parent
    if (props.onDrawCreate) {
      props.onDrawCreate(feat);
    }

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
    const dp = draftPoly();

    if (dp) {
      const coords = dp.coordinates[0];
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

  // Update draft visualization when it changes
  createEffect(() => {
    syncDraftToMap();
  });

  onMount(() => {
    if (!containerRef) return;

    // Create map instance
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
      // Create and initialize drawing manager
      const mgr = new MapDrawingManager(m, {
        onDrawCreate: (feature) => {
          const type = (feature.properties?.type as FeatureType) || 'green';

          // Use new unified callback if available
          if (props.onFeatureCreate) {
            props.onFeatureCreate(type, feature.geometry, feature.properties);
          }
          // Fall back to legacy callback for backward compatibility
          else if (props.onDrawCreate) {
            props.onDrawCreate(feature);
          }
        },
        onDrawUpdate: (feature) => {
          // Use new unified callback if available
          if (props.onFeatureUpdate && feature.id) {
            props.onFeatureUpdate(feature.id as string, {
              geometry: feature.geometry,
              properties: feature.properties,
            });
          }
          // Fall back to legacy callback for backward compatibility
          else if (props.onDrawUpdate) {
            props.onDrawUpdate(feature);
          }
        },
        onDrawDelete: (featureId) => {
          // Use new unified callback if available
          if (props.onFeatureDelete) {
            props.onFeatureDelete(featureId);
          }
          // Fall back to legacy callback for backward compatibility
          else if (props.onDrawDelete) {
            props.onDrawDelete(featureId);
          }
        },
        onSelectionChange: (features) => {
          if (features.length > 0) {
            setInternalMode('edit');
            props.onEditModeEnter?.();
          } else {
            setInternalMode('view');
            props.onEditModeExit?.();
          }
        },
        onModeChange: (_mode) => {
          // Handle mode changes if needed
        },
        onTooltipChange: setTooltip,
        onCursorChange: (cursor) => {
          m.getCanvas().style.cursor = cursor;
        },
        onLocationPick: props.onLocationPick,
        onEscape: () => {
          if (internalMode() === 'draw') {
            setDraftPoly(null);
            setCircleCenter(null);
            setInternalMode('view');
            mgr.changeMode('simple_select');
          } else if (internalMode() === 'edit') {
            setInternalMode('view');
            mgr.changeMode('simple_select');
            props.onEditModeExit?.();
          }
        },
        onEnter: () => {
          if (internalMode() === 'draw' && props.drawMode?.() === 'circle') {
            finishCircleDraft();
          }
        },
        onDelete: (featureId: string) => {
          if (props.onFeatureDelete) {
            props.onFeatureDelete(featureId);
          } else if (props.onDrawDelete) {
            props.onDrawDelete(featureId);
          }
        },

        getCurrentHoleMetadata: props.getCurrentHoleMetadata,
        onHoleStateRestore: props.onHoleStateRestore,
      });

      // Initialize with new features system or fall back to legacy
      mgr.initialize(props.features() || props.initialGeoJSON);
      if (props.trajectory?.()) {
        mgr.setTrajectory(props.trajectory()?.geometry as GeoJSON.LineString);
      }

      // Initialize undo/redo storage if courseId and holeNumber are provided
      if (props.courseId && props.holeNumber) {
        mgr.initializeUndoRedoStorage(props.courseId, props.holeNumber);
      }

      setManager(mgr);
      setMap(m);
      setInternalMode(props.mode());
    });

    // Handle map clicks
    m.on('click', (e) => {
      const mgr = manager();
      if (mgr) {
        mgr.handleMapClick(e, props.mode());
      }
    });

    // Handle circle drawing mouse events
    m.on('mousedown', (e) => {
      if (internalMode() === 'draw' && props.drawMode?.() === 'circle') {
        isMouseDown = true;
        dragStart = e.lngLat;
        m.dragPan.disable();
      }
    });

    m.on('mousemove', (e) => {
      if (internalMode() === 'draw' && props.drawMode?.() === 'circle') {
        if (isMouseDown && dragStart && !circleCenter()) {
          setCircleCenter([dragStart.lng, dragStart.lat]);
        }
        if (circleCenter()) {
          updateCircleDraft(e.lngLat);
        }
      }
    });

    m.on('mouseup', () => {
      if (internalMode() === 'draw' && props.drawMode?.() === 'circle') {
        if (isMouseDown && circleCenter()) {
          finishCircleDraft();
        }
        isMouseDown = false;
        dragStart = null;
        m.dragPan.enable();
      }
    });
  });

  onCleanup(() => {
    const m = map();
    const mgr = manager();

    // Clean up manager
    if (mgr) {
      mgr.cleanup();
    }

    // Remove map
    if (m) {
      m.remove();
    }
  });

  // Expose API through ref
  const mapEditorRef: MapEditorRef = {
    saveCurrentState: async () => {
      const mgr = manager();
      if (mgr) {
        await mgr.saveCurrentState();
      }
    },
  };

  // Call ref callback when ref is available
  createEffect(() => {
    if (props.ref) {
      props.ref(mapEditorRef);
    }
  });

  return (
    <div class="relative w-full h-full">
      <div ref={containerRef} class="w-full h-full" />

      <Show when={tooltip()}>
        <div
          ref={tooltipRef}
          class="absolute z-50 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg border border-slate-700 pointer-events-none whitespace-nowrap"
          style={{
            left: `${tooltip()!.x}px`,
            top: `${tooltip()!.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip()!.text}
        </div>
      </Show>
    </div>
  );
}
