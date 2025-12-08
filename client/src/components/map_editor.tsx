import { createSignal, onMount, onCleanup } from "solid-js";
import maplibregl from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import osmtogeojson from "osmtogeojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// Using ESRI World Imagery for satellite view (free for non-commercial/dev use usually)
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
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
  onSave?: (geoJSON: any) => void;
  center?: [number, number]; // [lng, lat]
}

export default function MapEditor(props: MapEditorProps) {
  let mapContainer: HTMLDivElement | undefined;
  let map: maplibregl.Map | null = null;
  let draw: MapboxDraw | null = null;
  const [loading, setLoading] = createSignal(false);

  const [selectedFeatureId, setSelectedFeatureId] = createSignal<string | null>(null);
  const [featureProperties, setFeatureProperties] = createSignal<any>({});

  onMount(() => {
    if (!mapContainer) return;
    
    map = new maplibregl.Map({
      container: mapContainer,
      style: SATELLITE_STYLE as any,
      center: props.center || [-97.7431, 30.2672],
      zoom: 16,
    });

    draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        line_string: true,
        trash: true,
      },
      defaultMode: 'draw_polygon',
      styles: [
        // Style for the polygon fill
        {
          id: 'gl-draw-polygon-fill-inactive',
          type: 'fill',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': '#3bb2d0',
            'fill-outline-color': '#3bb2d0',
            'fill-opacity': 0.1
          }
        },
        {
          id: 'gl-draw-polygon-fill-active',
          type: 'fill',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          paint: {
            'fill-color': '#fbb03b',
            'fill-outline-color': '#fbb03b',
            'fill-opacity': 0.1
          }
        },
        // Style for the polygon stroke
        {
          id: 'gl-draw-polygon-stroke-inactive',
          type: 'line',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#3bb2d0',
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
            'line-dasharray': [0.2, 2],
            'line-width': 2
          }
        },
        // LineString styles
        {
          id: 'gl-draw-line-inactive',
          type: 'line',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#3bb2d0',
            'line-width': 2
          }
        },
        {
          id: 'gl-draw-line-active',
          type: 'line',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#fbb03b',
            'line-dasharray': [0.2, 2],
            'line-width': 2
          }
        },
        // Vertex points
        {
          id: 'gl-draw-polygon-and-line-vertex-stroke-inactive',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 5,
            'circle-color': '#fff'
          }
        },
        {
          id: 'gl-draw-polygon-and-line-vertex-inactive',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 3,
            'circle-color': '#fbb03b'
          }
        },
      ]
    });

    map.addControl(draw as any, 'top-left');
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      if (props.initialGeoJSON && draw) {
        draw.add(props.initialGeoJSON);
      }
    });

    const onSelect = (e: any) => {
      if (e.features.length > 0) {
        const feature = e.features[0];
        setSelectedFeatureId(feature.id);
        setFeatureProperties(feature.properties || {});
      } else {
        setSelectedFeatureId(null);
        setFeatureProperties({});
      }
    };

    map.on('draw.create', updateData);
    map.on('draw.delete', updateData);
    map.on('draw.update', updateData);
    map.on('draw.selectionchange', onSelect);
  });

  const updateFeatureProperty = (key: string, value: any) => {
    if (!draw || !selectedFeatureId()) return;
    const id = selectedFeatureId()!;
    const feature = draw.get(id);
    if (feature) {
      if (!feature.properties) feature.properties = {};
      feature.properties[key] = value;
      draw.add(feature); 
      setFeatureProperties({ ...feature.properties });
      updateData();
    }
  };

  const updateData = () => {
    if (draw && props.onSave) {
      props.onSave(draw.getAll());
    }
  };

  const importFromOSM = async () => {
    if (!map) return;
    setLoading(true);
    const bounds = map.getBounds();
    // Overpass API query for golf features
    const query = `
      [out:json];
      (
        way["golf"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
        relation["golf"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
      );
      out geom;
    `;

    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });
      const data = await response.json();
      const geojson = osmtogeojson(data);
      
      if (draw) {
        geojson.features.forEach((feature: any) => {
           if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
             draw?.add(feature);
           }
        });
        updateData();
      }
      
    } catch (error) {
      console.error("Error fetching OSM data:", error);
      alert("Failed to fetch OSM data");
    } finally {
      setLoading(false);
    }
  };

  onCleanup(() => {
    if (map) map.remove();
  });

  return (
    <div class="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      <div ref={mapContainer} class="w-full h-full bg-slate-900" />
      
      <div class="absolute top-4 left-14 z-10 bg-slate-800 p-2 rounded shadow-lg flex flex-col gap-2">
         <button 
           onClick={importFromOSM}
           disabled={loading()}
           class="bg-emerald-600 hover:bg-emerald-500 text-xs text-white p-2 rounded"
         >
           {loading() ? "Importing..." : "Import OSM Data"}
         </button>
      </div>

      {selectedFeatureId() && (
        <div class="absolute bottom-4 right-4 z-20 bg-slate-800 p-4 rounded shadow-lg w-64 border border-slate-600">
          <h3 class="text-white font-bold mb-2">Feature Properties</h3>
          <div class="space-y-2">
            <div>
              <label class="block text-xs text-slate-400">Hole Number</label>
              <input 
                type="number" 
                class="w-full bg-slate-900 text-white p-1 rounded border border-slate-700"
                value={featureProperties().hole || ''}
                onInput={(e) => updateFeatureProperty('hole', parseInt(e.currentTarget.value))}
              />
            </div>
            <div>
              <label class="block text-xs text-slate-400">Type</label>
              <select 
                class="w-full bg-slate-900 text-white p-1 rounded border border-slate-700"
                value={featureProperties().type || 'fairway'}
                onChange={(e) => updateFeatureProperty('type', e.currentTarget.value)}
              >
                <option value="fairway">Fairway</option>
                <option value="green">Green</option>
                <option value="tee">Tee</option>
                <option value="bunker">Bunker</option>
                <option value="water">Water</option>
                <option value="slope">Slope Arrow</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
