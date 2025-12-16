import { createEffect, createSignal, onCleanup } from 'solid-js';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { HoleDefinition } from '~/lib/db';

interface HoleMapProps {
  holeDef: HoleDefinition | null;
  userLat?: number;
  userLng?: number;
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
      attribution: 'Tiles &copy; Esri',
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

export const HoleMap = (props: HoleMapProps) => {
  let mapContainer: HTMLDivElement | undefined;
  let map: maplibregl.Map | null = null;
  let userMarker: maplibregl.Marker | null = null;

  const [distances, setDistances] = createSignal<{
    front: number | null;
    middle: number | null;
    back: number | null;
  }>({ front: null, middle: null, back: null });

  // Initialize Map
  createEffect(() => {
    if (!mapContainer || map) return;

    map = new maplibregl.Map({
      container: mapContainer,
      style: SATELLITE_STYLE as any,
      center: [0, 0],
      zoom: 2,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on('load', () => {
      // Add sources/layers for features once map is loaded
      updateMapFeatures();
    });
  });

  const updateMapFeatures = () => {
    if (!map || !map.isStyleLoaded()) return;
    const { holeDef } = props;

    // Remove existing layers if any (simple cleanup)
    if (map.getLayer('hole-features-fill'))
      map.removeLayer('hole-features-fill');
    if (map.getLayer('hole-features-line'))
      map.removeLayer('hole-features-line');
    if (map.getSource('hole-features')) map.removeSource('hole-features');

    if (holeDef?.geo_features) {
      map.addSource('hole-features', {
        type: 'geojson',
        data: holeDef.geo_features as GeoJSON.GeoJSON,
        generateId: true,
      });

      map.addLayer({
        id: 'hole-features-fill',
        type: 'fill',
        source: 'hole-features',
        filter: ['!=', 'type', 'slope'], // Don't fill slope lines
        paint: {
          'fill-color': [
            'match',
            ['get', 'type'],
            'green',
            '#2ecc71',
            'fairway',
            '#27ae60',
            'tee',
            '#f1c40f',
            'bunker',
            '#f39c12',
            'water',
            '#3498db',
            '#888888', // default
          ],
          'fill-opacity': 0.5,
        },
      });

      map.addLayer({
        id: 'hole-features-line',
        type: 'line',
        source: 'hole-features',
        filter: ['!=', 'type', 'slope'],
        paint: {
          'line-color': '#ffffff',
          'line-width': 1,
        },
      });

      // Slope Arrows
      map.addLayer({
        id: 'hole-features-slope',
        type: 'line',
        source: 'hole-features',
        filter: ['==', 'type', 'slope'],
        paint: {
          'line-color': '#e74c3c', // Red for slope
          'line-width': 4,
        },
      });
    }
  };

  // React to props changes
  createEffect(() => {
    if (!map) return;
    const { holeDef, userLat, userLng } = props;

    // Update User Marker
    if (userLat && userLng) {
      if (!userMarker) {
        const el = document.createElement('div');
        el.className =
          'w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg';
        userMarker = new maplibregl.Marker({ element: el })
          .setLngLat([userLng, userLat])
          .addTo(map);
      } else {
        userMarker.setLngLat([userLng, userLat]);
      }
    }

    // Update view bounds and distance
    if (userLat && userLng && holeDef?.lat && holeDef?.lng) {
      const from = turf.point([userLng, userLat]);

      // Middle Distance
      const toMiddle = turf.point([holeDef.lng, holeDef.lat]);
      const distMiddle = Math.round(
        turf.distance(from, toMiddle, { units: 'yards' }),
      );

      // Front Distance
      let distFront = null;
      // @ts-ignore
      if (holeDef.front_lat && holeDef.front_lng) {
        // @ts-ignore
        const toFront = turf.point([holeDef.front_lng, holeDef.front_lat]);
        distFront = Math.round(
          turf.distance(from, toFront, { units: 'yards' }),
        );
      }

      // Back Distance
      let distBack = null;
      // @ts-ignore
      if (holeDef.back_lat && holeDef.back_lng) {
        // @ts-ignore
        const toBack = turf.point([holeDef.back_lng, holeDef.back_lat]);
        distBack = Math.round(turf.distance(from, toBack, { units: 'yards' }));
      }

      setDistances({ front: distFront, middle: distMiddle, back: distBack });

      // Fit bounds
      const bounds = new maplibregl.LngLatBounds()
        .extend([userLng, userLat])
        .extend([holeDef.lng, holeDef.lat]);

      map.fitBounds(bounds, { padding: 50 });
    } else if (holeDef?.lat && holeDef?.lng) {
      map.flyTo({ center: [holeDef.lng, holeDef.lat], zoom: 17 });
    }

    // Reload features if hole changes
    updateMapFeatures();
  });

  onCleanup(() => {
    if (map) {
      map.remove();
      map = null;
    }
  });

  return (
    <div class="relative w-full h-full min-h-[300px] rounded-xl overflow-hidden shadow-inner bg-slate-900">
      <div ref={mapContainer} class="absolute inset-0 z-0" />

      {/* HUD Overlay */}
      <div class="absolute bottom-4 left-4 z-10 flex flex-col gap-1">
        {distances().back && (
          <div class="bg-slate-900/90 backdrop-blur px-3 py-1 rounded-lg border border-blue-500/30 text-blue-400">
            <span class="text-[10px] uppercase font-bold block">Back</span>
            <span class="text-lg font-bold font-mono">{distances().back}</span>
          </div>
        )}
        {distances().middle && (
          <div class="bg-slate-900/90 backdrop-blur px-4 py-2 rounded-lg border border-white/10 shadow-xl">
            <span class="text-xs text-slate-400 block uppercase font-bold">
              Center
            </span>
            <span class="text-2xl font-bold text-white font-mono">
              {distances().middle}
            </span>
            <span class="text-xs text-slate-400 ml-1 uppercase font-bold">
              yds
            </span>
          </div>
        )}
        {distances().front && (
          <div class="bg-slate-900/90 backdrop-blur px-3 py-1 rounded-lg border border-red-500/30 text-red-400">
            <span class="text-[10px] uppercase font-bold block">Front</span>
            <span class="text-lg font-bold font-mono">{distances().front}</span>
          </div>
        )}
      </div>
    </div>
  );
};
