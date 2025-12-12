import { createEffect, onMount, onCleanup, createSignal } from "solid-js";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// Using ESRI World Imagery for satellite view
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles &copy; Esri"
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

interface MapEditorProps {
  initialGeoJSON?: any;
  center?: [number, number];
  zoom?: number;
  mode?: 'view' | 'pick_location' | 'draw';
  drawMode?: 'polygon' | 'point';
  onLocationPick?: (lat: number, lng: number) => void;
  onDrawCreate?: (feature: any) => void;
  markers?: { lat: number; lng: number; label?: string; color?: string }[];
}

export default function MapEditor(props: MapEditorProps) {
  let mapContainer: HTMLDivElement | undefined;
  const [map, setMap] = createSignal<maplibregl.Map | null>(null);
  let draw: MapboxDraw | null = null;
  let markerInstances: maplibregl.Marker[] = [];

  // Update map center/zoom when props change
  createEffect(() => {
    const m = map();
    if (!m) return;
    if (props.center) {
      m.flyTo({ center: props.center, zoom: props.zoom || 18 });
    }
  });

  // Update markers
  createEffect(() => {
    const m = map();
    if (!m) return;
    
    // Clear existing
    markerInstances.forEach(marker => marker.remove());
    markerInstances = [];

    if (props.markers) {
      props.markers.forEach(markerData => {
        if (markerData.lat && markerData.lng) {
          const marker = new maplibregl.Marker({ color: markerData.color || '#10b981' })
            .setLngLat([markerData.lng, markerData.lat])
            .addTo(m);
          markerInstances.push(marker);
        }
      });
    }
  });

  // Handle Mode Changes
  createEffect(() => {
    const m = map();
    if (!m || !draw) return;

    if (props.mode === 'draw') {
        if (props.drawMode === 'polygon') {
            draw.changeMode('draw_polygon');
        } else if (props.drawMode === 'point') {
            draw.changeMode('draw_point');
        }
    } else {
        // Stop drawing
        draw.changeMode('simple_select');
    }
  });

  onMount(() => {
    if (!mapContainer) return;
    
    const m = new maplibregl.Map({
      container: mapContainer,
      style: SATELLITE_STYLE as any,
      center: props.center || [-97.7431, 30.2672],
      zoom: props.zoom || 16,
    });

    draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: false,
        trash: true,
      },
      styles: [
        // Polygon Fill
        {
          id: 'gl-draw-polygon-fill-inactive',
          type: 'fill',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': '#10b981',
            'fill-outline-color': '#10b981',
            'fill-opacity': 0.2
          }
        },
        {
          id: 'gl-draw-polygon-fill-active',
          type: 'fill',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          paint: {
            'fill-color': '#fbb03b',
            'fill-outline-color': '#fbb03b',
            'fill-opacity': 0.2
          }
        },
        // Polygon Stroke
        {
          id: 'gl-draw-polygon-stroke-inactive',
          type: 'line',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#10b981',
            'line-width': 2
          }
        },
        {
          id: 'gl-draw-polygon-stroke-active',
          type: 'line',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#fbb03b',
            'line-dasharray': [2, 2],
            'line-width': 2
          }
        },
        // Points
        {
          id: 'gl-draw-point-inactive',
          type: 'circle',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 5,
            'circle-color': '#10b981'
          }
        },
        {
          id: 'gl-draw-point-active',
          type: 'circle',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point']],
          paint: {
            'circle-radius': 7,
            'circle-color': '#fbb03b'
          }
        },
      ]
    });

    m.addControl(draw as any);
    m.addControl(new maplibregl.NavigationControl(), 'top-right');

    m.on('load', () => {
      if (props.initialGeoJSON && draw) {
        draw.add(props.initialGeoJSON);
      }
      setMap(m); // Trigger effects
    });

    m.on('click', (e) => {
        if (props.mode === 'pick_location' && props.onLocationPick) {
            props.onLocationPick(e.lngLat.lat, e.lngLat.lng);
        }
    });

    m.on('draw.create', (e) => {
        if (props.onDrawCreate && e.features[0]) {
            props.onDrawCreate(e.features[0]);
            // If we only want single feature creation, we could reset mode here
        }
    });
  });

  onCleanup(() => {
    const m = map();
    if (m) m.remove();
  });

  return (
    <div class="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900">
      <div ref={mapContainer} class="w-full h-full" />
      
      {props.mode === 'pick_location' && (
          <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg border border-emerald-500/50 animate-pulse z-10">
              Click map to set location
          </div>
      )}
    </div>
  );
}
