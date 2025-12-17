import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import { DRAW_STYLES } from './map_editor_utils';
import {
  TRAJECTORY_STYLES,
  calculateTrajectoryDistance,
  formatYardage,
} from './trajectory_utils';
import { UndoRedoStorage } from './undo_redo_storage';

export interface TooltipData {
  x: number;
  y: number;
  text: string;
}

export interface HoleMetadata {
  // Pin positions
  lat?: number;
  lng?: number;
  front_lat?: number;
  front_lng?: number;
  back_lat?: number;
  back_lng?: number;
  // Tee boxes
  tee_boxes?: Array<{
    name: string;
    color: string;
    yardage: number;
    lat: number;
    lng: number;
  }>;
  // Basic hole info
  par?: number;
  handicap?: number;
}

export interface DrawingManagerCallbacks {
  // Draw events
  onDrawCreate?: (feature: GeoJSON.Feature) => void;
  onDrawUpdate?: (feature: GeoJSON.Feature) => void;
  onDrawDelete?: (featureId: string) => void;
  onSelectionChange?: (features: any[]) => void;
  onModeChange?: (mode: string) => void;

  // UI feedback
  onTooltipChange?: (tooltip: TooltipData | null) => void;
  onCursorChange?: (cursor: string) => void;

  // Keyboard events
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: (featureId: string) => void;
  onEscape?: () => void;
  onEnter?: () => void;

  // Location picking
  onLocationPick?: (lat: number, lng: number) => void;

  // Hole metadata for undo/redo
  getCurrentHoleMetadata?: () => HoleMetadata;
  onHoleStateRestore?: (features: GeoJSON.FeatureCollection, metadata: HoleMetadata) => void;
}

const MAP_CLICK_LAYERS = [
  'gl-draw-polygon-fill-inactive.cold',
  'gl-draw-polygon-stroke-inactive.cold',
  'gl-draw-line-inactive.cold',
  'gl-draw-point-inactive.cold',

  // Trajectory
  'trajectory-line',
  'trajectory-markers',
];

const MAP_MOUSE_LAYERS = [
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

  // Trajectory
  'trajectory-line',
  'trajectory-markers',
];

/**
 * Stateless drawing manager that handles all map drawing operations
 * State is controlled by the parent component through callbacks
 */
export class MapDrawingManager {
  private map: maplibregl.Map;
  private draw: MapboxDraw | null = null;
  private callbacks: DrawingManagerCallbacks;
  private sourcesInitialized = new Set<string>();
  private layersInitialized = new Set<string>();

  // Hover tracking (internal state for hover management only)
  private hoveredFeatureId: string | number | null = null;
  private hoveredSource: string | null = null;
  private lastCursor: string | null = null;
  private lastTooltipText: string | null = null;

  /** Keyboard cleanup */
  private keyboardCleanup: (() => void) | null = null;

  // IndexedDB storage for undo/redo operations
  private undoRedoStorage: UndoRedoStorage | null = null;

  constructor(map: maplibregl.Map, callbacks: DrawingManagerCallbacks = {}) {
    this.map = map;
    this.callbacks = callbacks;
  }

  /**
   * Initialize all drawing functionality
   */
  public initialize(initialGeoJSON?: GeoJSON.FeatureCollection | null): void {
    this.initializeGeoFeatures(initialGeoJSON);
    this.initializeTrajectoryLayers();
    this.initializeHoverHandlers();
    this.setupKeyboardHandlers();
  }

  /**
   * Initialize undo/redo storage for a specific course and hole
   */
  public initializeUndoRedoStorage(courseId: number, holeNumber: number): void {
    this.undoRedoStorage = new UndoRedoStorage(courseId, holeNumber);
  }

  private initializeHoverHandlers(): void {
    this.map.on('mousemove', this.handleMouseMove);
    this.map.on('mouseleave', this.handleMouseLeave);
  }

  private handleMouseMove = (e: maplibregl.MapMouseEvent) => {
    if (!this.map.isStyleLoaded()) return;

    const layers = MAP_MOUSE_LAYERS.filter((id) => this.map.getLayer(id));

    const features = this.map.queryRenderedFeatures(e.point, { layers });

    this.updateHoverState(features[0] ?? null, e.point);
  };

  private handleMouseLeave = () => {
    this.updateHoverState(null);
  };

  private updateHoverState(
    feature: maplibregl.MapGeoJSONFeature | null,
    point?: maplibregl.Point,
  ): void {
    const nextId = feature?.id ?? null;
    const nextSource = feature?.source ?? null;

    const sameFeature =
      nextId === this.hoveredFeatureId && nextSource === this.hoveredSource;

    if (sameFeature && feature) {
      return;
    }

    if (
      this.hoveredFeatureId !== null &&
      this.hoveredSource &&
      (!feature || !sameFeature)
    ) {
      this.map.setFeatureState(
        { source: this.hoveredSource, id: this.hoveredFeatureId },
        { hover: false },
      );
    }

    this.hoveredFeatureId = null;
    this.hoveredSource = null;

    if (!feature || nextId == null) {
      this.updateCursor('');
      this.updateTooltip(null);
      return;
    }

    this.map.setFeatureState(
      { source: nextSource!, id: nextId },
      { hover: true },
    );
    this.hoveredFeatureId = nextId;
    this.hoveredSource = nextSource!;

    const props = feature.properties as any;
    let cursor = 'pointer';
    let tooltip = '';

    if (props?.meta === 'vertex') {
      cursor = 'move';
      tooltip = 'Drag to move vertex • Delete to remove';
    } else if (props?.meta === 'midpoint') {
      cursor = 'cell';
      tooltip = 'Click to add vertex';
    } else if (props?.active === 'true') {
      cursor = 'move';
      tooltip = 'Selected • Edit vertices or press Delete';
    } else {
      const type = props?.type || feature.geometry?.type;
      if (type === 'trajectory') {
        tooltip = `Trajectory • ${props?.distance ?? 'Click to edit'}`;
      } else if (type === 'green' || feature.geometry?.type === 'Polygon') {
        tooltip = 'Green • Click to edit';
      } else if (type === 'slope' || feature.geometry?.type === 'Point') {
        tooltip = 'Slope point • Click to edit';
      } else {
        tooltip = 'Click to edit';
      }
    }

    this.updateCursor(cursor);

    if (tooltip && point) {
      this.updateTooltip({
        x: point.x,
        y: point.y - 30,
        text: tooltip,
      });
    } else {
      this.updateTooltip(null);
    }
  }

  private updateCursor(cursor: string): void {
    if (cursor === this.lastCursor) return;
    this.lastCursor = cursor;
    this.callbacks.onCursorChange?.(cursor);
  }

  private updateTooltip(tooltip: TooltipData | null): void {
    const text = tooltip?.text ?? null;
    if (text === this.lastTooltipText) return;
    this.lastTooltipText = text;
    this.callbacks.onTooltipChange?.(tooltip);
  }

  public cleanup(): void {
    if (this.keyboardCleanup) {
      this.keyboardCleanup();
      this.keyboardCleanup = null;
    }

    this.map.off('mousemove', this.handleMouseMove);
    this.map.off('mouseleave', this.handleMouseLeave);

    if (this.draw) {
      try {
        this.map.removeControl(this.draw as any);
      } catch {}
      this.draw = null;
    }

    this.sourcesInitialized.clear();
    this.layersInitialized.clear();
    this.undoRedoStorage = null;
  }

  /**
   * Initialize MapboxDraw with proper cleanup
   */
  private initializeGeoFeatures(
    initialGeoJSON?: GeoJSON.FeatureCollection | null,
  ): void {
    // Clean up any existing draw instance
    if (this.draw) {
      try {
        this.map.removeControl(this.draw as any);
      } catch (e) {
        // Silently handle cleanup errors
      }
      this.draw = null;
    }

    // Create new draw instance
    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      userProperties: true,
      styles: DRAW_STYLES,
      controls: {},
    });

    // Add control to map
    this.map.addControl(this.draw as any);

    // Set up event listeners
    this.setupDrawEventListeners();

    // Load initial data if provided
    if (initialGeoJSON && initialGeoJSON.features.length > 0) {
      // Filter out trajectory from initial data as it's handled separately
      const filteredFeatures = initialGeoJSON.features.filter(
        (f: any) => (f.properties as any)?.type !== 'trajectory',
      );
      if (filteredFeatures.length > 0) {
        this.draw.set({
          type: 'FeatureCollection',
          features: filteredFeatures,
        });
      }
    }
  }

  /**
   * Setup draw event listeners
   */
  private setupDrawEventListeners(): void {
    if (!this.draw) return;

    this.map.on('draw.create', (e) => this.handleDrawEvent('create', e));
    this.map.on('draw.update', (e) => this.handleDrawEvent('update', e));
    this.map.on('draw.delete', (e) => this.handleDrawEvent('delete', e));

    this.map.on('draw.selectionchange', (e) => {
      if (this.callbacks.onSelectionChange) {
        this.callbacks.onSelectionChange(e.features);
      }
    });

    this.map.on('draw.modechange', (e) => {
      if (this.callbacks.onModeChange) {
        this.callbacks.onModeChange(e.mode);
      }

      // Update drawing vertices when mode changes
      if (e.mode === 'draw_line_string') {
        setTimeout(() => this.updateDrawingVertices(), 50);
      } else {
        this.clearDrawingVertices();
      }
    });

    // Update vertices while actively drawing
    this.map.on('draw.actionable', () => {
      this.updateDrawingVertices();
    });
  }

  /**
   * Handle draw events
   */
  private handleDrawEvent(type: 'create' | 'update' | 'delete', e: any): void {
    const features = e.features;
    if (!features || features.length === 0) return;

    // Save state for undo functionality
    if (type === 'create' || type === 'update' || type === 'delete') {
      setTimeout(() => {
        this.saveDrawState().catch(error => {
          console.warn('Failed to save draw state:', error);
        });
      }, 10);
    }

    features.forEach((f: any) => {
      // Ensure ID
      if (!f.id) f.id = this._generateId();

      // Ensure properties
      if (!f.properties) f.properties = {};
      if (!f.properties.id) f.properties.id = f.id;

      // Handle specific feature types
      if (type === 'create') {
        if (
          f.geometry.type === 'LineString' &&
          f.properties.type === 'trajectory'
        ) {
          // Calculate and display distance
          const distance = calculateTrajectoryDistance(f.geometry);
          f.properties.distance = formatYardage(distance);
          setTimeout(() => this.updateDrawingVertices(), 50);
        } else if (f.geometry.type === 'Polygon' && !f.properties.type) {
          f.properties.type = 'green';
        } else if (
          f.geometry.type === 'Point' &&
          f.properties.type === 'slope'
        ) {
          f.properties.intensity = 1.0;
        }
      }

      // Notify callbacks
      const featureWithId = { ...f, id: f.id };

      if (type === 'create' && this.callbacks.onDrawCreate) {
        this.callbacks.onDrawCreate(featureWithId);
      } else if (type === 'update' && this.callbacks.onDrawUpdate) {
        this.callbacks.onDrawUpdate(featureWithId);
      } else if (type === 'delete' && this.callbacks.onDrawDelete) {
        this.callbacks.onDrawDelete(featureWithId.id as string);
      }
    });

    // Update drawing vertices for trajectory
    if (this.getCurrentMode() === 'draw_line_string') {
      setTimeout(() => this.updateDrawingVertices(), 50);
    }
  }

  /**
   * Initialize trajectory visualization layers
   */
  private initializeTrajectoryLayers(): void {
    try {
      this.addSourceIfNeeded('trajectory-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        promoteId: 'id',
        generateId: true,
      });

      this.addLayerIfNeeded({
        id: 'trajectory-line',
        type: 'line',
        source: 'trajectory-source',
        filter: ['==', '$type', 'LineString'],
        paint: TRAJECTORY_STYLES.viewing,
      });

      this.addLayerIfNeeded({
        id: 'trajectory-markers',
        type: 'symbol',
        source: 'trajectory-source',
        filter: ['==', '$type', 'Point'],
        layout: {
          'text-field': ['get', 'label'],
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
      });

      // Drawing vertices visualization
      this.addSourceIfNeeded('drawing-vertices', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        generateId: true,
      });

      this.addLayerIfNeeded({
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
      });
    } catch (e) {
      // Silently handle layer initialization errors
    }
  }

  /**
   * Setup keyboard handlers
   */
  private setupKeyboardHandlers(): void {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Undo: Cmd+Z / Ctrl+Z
      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo().then(() => {
          if (this.callbacks.onUndo) {
            this.callbacks.onUndo();
          }
        });
      }
      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
      else if (isMeta && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        this.redo().then(() => {
          if (this.callbacks.onRedo) {
            this.callbacks.onRedo();
          }
        });
      }
      // Delete/Backspace
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelected();
      }
      // Escape
      else if (e.key === 'Escape') {
        if (this.callbacks.onEscape) {
          this.callbacks.onEscape();
        }
      }
      // Enter
      else if (e.key === 'Enter') {
        if (this.callbacks.onEnter) {
          this.callbacks.onEnter();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Store cleanup function
    this.keyboardCleanup = () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Handle map click for feature selection
   */
  public handleMapClick(e: maplibregl.MapMouseEvent, mode: string): void {
    if (mode === 'pick_location' && this.callbacks.onLocationPick) {
      this.callbacks.onLocationPick(e.lngLat.lat, e.lngLat.lng);
      return;
    }

    // Enable feature selection when in view mode
    if (this.draw && mode === 'view') {
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: MAP_CLICK_LAYERS.filter((layer) => this.map.getLayer(layer)),
      });

      if (features && features.length > 0) {
        const feature = features[0];
        if (feature.properties.id) {
          const id = this.draw.add(feature)[0];
          // Select the feature for editing
          this.changeMode('direct_select', {
            featureId: id,
          });
        }
      }
    }
  }

  /**
   * Update trajectory visualization
   */
  public setTrajectory(trajectory: GeoJSON.LineString | null): void {
    const src = this.map.getSource(
      'trajectory-source',
    ) as maplibregl.GeoJSONSource;

    if (!src) return;

    if (!trajectory) {
      // Clear trajectory data when no trajectory
      src.setData({ type: 'FeatureCollection', features: [] } as any);
      this.clearDrawingVertices();
      return;
    }

    const id = this._generateId();
    const trajectoryFeature: GeoJSON.Feature = {
      type: 'Feature',
      id: id,
      properties: { type: 'trajectory', id: id, source: 'trajectory-source' },
      geometry: trajectory,
    };

    // Create start and end markers for the trajectory
    const coords = trajectory.coordinates;
    const features = [trajectoryFeature];
    
    if (coords.length >= 2) {
      // Start point
      features.push({
        type: 'Feature',
        id: `${id}-start`,
        properties: { 
          type: 'trajectory-marker',
          label: 'Start',
          position: 'start'
        },
        geometry: {
          type: 'Point',
          coordinates: coords[0]
        }
      } as GeoJSON.Feature);
      
      // End point with distance
      const distance = this.calculateTrajectoryDistance(trajectory);
      features.push({
        type: 'Feature',
        id: `${id}-end`, 
        properties: {
          type: 'trajectory-marker',
          label: `${distance} yds`,
          position: 'end'
        },
        geometry: {
          type: 'Point',
          coordinates: coords[coords.length - 1]
        }
      } as GeoJSON.Feature);
    }

    src.setData({
      type: 'FeatureCollection',
      features: features,
    } as any);
  }

  /**
   * Update drawing vertices visualization
   */
  private updateDrawingVertices(): void {
    if (!this.draw) return;

    const src = this.map.getSource(
      'drawing-vertices',
    ) as maplibregl.GeoJSONSource;
    if (!src) return;

    // Only show vertices when actively drawing a line string
    const currentMode = this.draw.getMode();
    if (currentMode !== 'draw_line_string') {
      src.setData({ type: 'FeatureCollection', features: [] } as any);
      return;
    }

    const allFeatures = this.draw.getAll();
    const vertexFeatures: GeoJSON.Feature[] = [];

    // Find active LineString (trajectory being drawn)
    allFeatures.features.forEach((feature: any) => {
      if (feature.geometry?.type === 'LineString') {
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

          // Create a point feature for each vertex
          vertexFeatures.push({
            type: 'Feature',
            id: this._generateId(),
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

  /**
   * Clear drawing vertices
   */
  private clearDrawingVertices(): void {
    const src = this.map.getSource(
      'drawing-vertices',
    ) as maplibregl.GeoJSONSource;
    if (src) {
      src.setData({ type: 'FeatureCollection', features: [] } as any);
    }
  }

  /**
   * Save current draw state for undo
   */
  private async saveDrawState(): Promise<void> {
    if (!this.draw || !this.undoRedoStorage) return;

    const currentState = this.draw.getAll();
    const currentMetadata = this.callbacks.getCurrentHoleMetadata?.() || {};
    
    try {
      await this.undoRedoStorage.pushUndo(currentState, currentMetadata);
    } catch (error) {
      console.warn('Failed to save undo state:', error);
    }
  }

  /**
   * Perform undo operation
   */
  public async undo(): Promise<void> {
    if (!this.draw || !this.undoRedoStorage) return;

    try {
      const canUndo = await this.undoRedoStorage.canUndo();
      if (!canUndo) return;

      const currentState = this.draw.getAll();
      const currentMetadata = this.callbacks.getCurrentHoleMetadata?.() || {};
      const previousStateData = await this.undoRedoStorage.popUndo(currentState, currentMetadata);
      
      if (previousStateData) {
        this.draw.set(previousStateData.state);

        // Restore hole metadata (tee boxes, pin positions, etc.)
        if (this.callbacks.onHoleStateRestore) {
          this.callbacks.onHoleStateRestore(previousStateData.state, previousStateData.holeMetadata);
        }

        // Notify about trajectory changes if needed
        if (this.callbacks.onDrawUpdate) {
          const trajectoryFeature = previousStateData.state.features.find(
            (f: any) => f.properties?.type === 'trajectory',
          );
          if (trajectoryFeature) {
            this.callbacks.onDrawUpdate(trajectoryFeature as GeoJSON.Feature);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to perform undo:', error);
    }
  }

  /**
   * Perform redo operation
   */
  public async redo(): Promise<void> {
    if (!this.draw || !this.undoRedoStorage) return;

    try {
      const canRedo = await this.undoRedoStorage.canRedo();
      if (!canRedo) return;

      const currentState = this.draw.getAll();
      const currentMetadata = this.callbacks.getCurrentHoleMetadata?.() || {};
      const nextStateData = await this.undoRedoStorage.popRedo(currentState, currentMetadata);
      
      if (nextStateData) {
        this.draw.set(nextStateData.state);

        // Restore hole metadata (tee boxes, pin positions, etc.)
        if (this.callbacks.onHoleStateRestore) {
          this.callbacks.onHoleStateRestore(nextStateData.state, nextStateData.holeMetadata);
        }

        // Notify about trajectory changes if needed
        if (this.callbacks.onDrawUpdate) {
          const trajectoryFeature = nextStateData.state.features.find(
            (f: any) => f.properties?.type === 'trajectory',
          );
          if (trajectoryFeature) {
            this.callbacks.onDrawUpdate(trajectoryFeature as GeoJSON.Feature);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to perform redo:', error);
    }
  }

  /**
   * Change drawing mode
   */
  public changeMode(mode: string, options: any = {}): void {
    if (this.draw) {
      this.draw.changeMode(mode, options);
    }
  }

  /**
   * Get current drawing mode
   */
  public getCurrentMode(): string | null {
    if (this.draw) {
      return this.draw.getMode();
    }
    return null;
  }

  /**
   * Get MapboxDraw instance
   */
  public getDrawInstance(): MapboxDraw | null {
    return this.draw;
  }

  /**
   * Get all drawn features
   */
  public getAllFeatures(): GeoJSON.FeatureCollection {
    if (this.draw) {
      return this.draw.getAll();
    }
    return { type: 'FeatureCollection', features: [] };
  }

  /**
   * Get selected features
   */
  public getSelectedFeatures(): GeoJSON.Feature[] {
    if (this.draw) {
      return this.draw.getSelected().features;
    }
    return [];
  }

  /**
   * Delete selected features
   */
  public deleteSelected(): void {
    if (!this.draw) {
      return;
    }

    const selected = this.draw.getSelected();
    for (let i = 0; i < selected.features.length; i++) {
      const feature = selected.features[i];

      if (feature.id) {
        this.draw.delete(`${feature.id}`);
        
        if (this.callbacks.onDelete) {
          this.callbacks.onDelete(`${feature.id}`);
        }
      }
    }
  }

  /**
   * Check if undo is available
   */
  public async canUndo(): Promise<boolean> {
    if (!this.undoRedoStorage) return false;
    try {
      return await this.undoRedoStorage.canUndo();
    } catch (error) {
      console.warn('Failed to check undo availability:', error);
      return false;
    }
  }

  /**
   * Check if redo is available
   */
  public async canRedo(): Promise<boolean> {
    if (!this.undoRedoStorage) return false;
    try {
      return await this.undoRedoStorage.canRedo();
    } catch (error) {
      console.warn('Failed to check redo availability:', error);
      return false;
    }
  }

  /**
   * Get stack information for debugging
   */
  public async getStackInfo(): Promise<{ undoSize: number; redoSize: number } | null> {
    if (!this.undoRedoStorage) return null;
    try {
      return await this.undoRedoStorage.getStackSizes();
    } catch (error) {
      console.warn('Failed to get stack info:', error);
      return null;
    }
  }

  /**
   * Clear all undo/redo history
   */
  public async clearUndoRedoHistory(): Promise<void> {
    if (!this.undoRedoStorage) return;
    try {
      await this.undoRedoStorage.clearAll();
    } catch (error) {
      console.warn('Failed to clear undo/redo history:', error);
    }
  }

  /**
   * Manually save current state for undo (useful when hole metadata changes)
   */
  public async saveCurrentState(): Promise<void> {
    await this.saveDrawState();
  }

  /**
   * Helper to add source if it doesn't exist
   */
  private addSourceIfNeeded(id: string, source: any): void {
    if (!this.sourcesInitialized.has(id) && !this.map.getSource(id)) {
      this.map.addSource(id, source);
      this.sourcesInitialized.add(id);
    }
  }

  /**
   * Helper to add layer if it doesn't exist
   */
  private addLayerIfNeeded(layer: any): void {
    if (!this.layersInitialized.has(layer.id) && !this.map.getLayer(layer.id)) {
      this.map.addLayer(layer);
      this.layersInitialized.add(layer.id);
    }
  }

  private calculateTrajectoryDistance(trajectory: GeoJSON.LineString): number {
    if (!trajectory || trajectory.coordinates.length < 2) return 0;
    let totalDistance = 0;
    for (let i = 1; i < trajectory.coordinates.length; i++) {
      const from = turf.point(trajectory.coordinates[i - 1]);
      const to = turf.point(trajectory.coordinates[i]);
      totalDistance += turf.distance(from, to, { units: 'yards' });
    }
    return Math.round(totalDistance);
  }

  private _generateId() {
    const buf = new Uint8Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }
}
