import { createEffect, createSignal, onCleanup } from "solid-js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HoleDefinition } from "../../db";

// Fix Leaflet's default icon path issues
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface HoleMapProps {
  holeDef: HoleDefinition | null;
  userLat?: number;
  userLng?: number;
}

export const HoleMap = (props: HoleMapProps) => {
  let mapContainer: HTMLDivElement | undefined;
  let map: L.Map | null = null;
  let userMarker: L.Marker | null = null;
  let holeMarker: L.Marker | null = null;
  let distanceLine: L.Polyline | null = null;

  const [distance, setDistance] = createSignal<number | null>(null);

  // Initialize Map
  createEffect(() => {
    if (!mapContainer || map) return;

    map = L.map(mapContainer, {
      zoomControl: false,
      attributionControl: false
    }).setView([0, 0], 2);

    // Esri World Imagery (Satellite)
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxZoom: 19
      }
    ).addTo(map);
  });

  // Update Markers and View
  createEffect(() => {
    if (!map) return;

    const { holeDef, userLat, userLng } = props;

    // Handle User Marker
    if (userLat && userLng) {
      const userPos = new L.LatLng(userLat, userLng);
      
      if (!userMarker) {
        userMarker = L.marker(userPos, {
            icon: L.divIcon({
                className: 'bg-blue-500 w-4 h-4 rounded-full border-2 border-white shadow-lg',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(map);
      } else {
        userMarker.setLatLng(userPos);
      }
    }

    // Handle Hole Marker
    if (holeDef && holeDef.lat && holeDef.lng) {
      const holePos = new L.LatLng(holeDef.lat, holeDef.lng);

      if (!holeMarker) {
        holeMarker = L.marker(holePos, {
            icon: L.divIcon({
                className: 'text-2xl',
                html: '⛳️',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(map);
      } else {
        holeMarker.setLatLng(holePos);
      }
    }

    // Draw Line & Calculate Distance
    if (userLat && userLng && holeDef?.lat && holeDef?.lng) {
      const userPos = new L.LatLng(userLat, userLng);
      const holePos = new L.LatLng(holeDef.lat, holeDef.lng);

      // Distance in yards
      const distMeters = userPos.distanceTo(holePos);
      setDistance(Math.round(distMeters * 1.09361));

      if (!distanceLine) {
        distanceLine = L.polyline([userPos, holePos], {
          color: 'white',
          weight: 2,
          dashArray: '5, 10'
        }).addTo(map);
      } else {
        distanceLine.setLatLngs([userPos, holePos]);
      }

      // Fit bounds to show both
      const bounds = L.latLngBounds([userPos, holePos]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (holeDef?.lat && holeDef?.lng) {
        // Just center on hole if no user loc
        map.setView([holeDef.lat, holeDef.lng], 18);
    } else if (userLat && userLng) {
        map.setView([userLat, userLng], 18);
    }
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
      
      {/* Distance Overlay */}
      {distance() && (
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] bg-slate-900/90 backdrop-blur px-4 py-2 rounded-lg border border-white/10 shadow-xl">
          <span class="text-2xl font-bold text-white font-mono">{distance()}</span>
          <span class="text-xs text-slate-400 ml-1 uppercase font-bold">yds</span>
        </div>
      )}
    </div>
  );
};
