// map_editor_utils.ts
export const HEATMAP_SRC = 'greens-heatmap-src';
export const GREENS_SRC = 'greens-src';
export const DRAFT_SRC = 'draft-src';
export const GREENS_FILL = 'greens-fill';
export const GREENS_LINE = 'greens-line';
export const GREENS_HIT = 'greens-hit';
export const GREENS_POINT = 'greens-point';
export const GREENS_HEATMAP = 'greens-heatmap';

export const SATELLITE_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
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

export const DRAW_STYLES: any[] = [
  // LineString styles (for trajectory) - Inactive with hover
  {
    id: 'gl-draw-line-inactive',
    type: 'line',
    filter: [
      'all',
      ['==', 'active', 'false'],
      ['==', '$type', 'LineString'],
      ['!=', 'mode', 'static'],
    ],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#60A5FA', // Lighter blue on hover
        '#3B82F6',
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        5, // Thicker on hover
        3,
      ],
      'line-dasharray': [2, 2],
    },
  },
  // LineString styles (for trajectory) - Active/Drawing
  {
    id: 'gl-draw-line-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#2563EB',
      'line-width': 4,
      'line-dasharray': [2, 1],
    },
  },
  // Polygon Fill (Inactive) with hover
  {
    id: 'gl-draw-polygon-fill-inactive',
    type: 'fill',
    filter: [
      'all',
      ['==', 'active', 'false'],
      ['==', '$type', 'Polygon'],
      ['!=', 'mode', 'static'],
    ],
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#34D399', // Lighter green on hover
        '#10b981',
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.35, // More opaque on hover
        0.2,
      ],
    },
  },
  // Polygon Fill (Active)
  {
    id: 'gl-draw-polygon-fill-active',
    type: 'fill',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': '#10b981',
      'fill-opacity': 0.2,
    },
  },
  // Polygon Outline (Inactive) with hover
  {
    id: 'gl-draw-polygon-stroke-inactive',
    type: 'line',
    filter: [
      'all',
      ['==', 'active', 'false'],
      ['==', '$type', 'Polygon'],
      ['!=', 'mode', 'static'],
    ],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#34D399', // Lighter green on hover
        '#10b981',
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        3, // Thicker on hover
        2,
      ],
    },
  },
  // Polygon Outline (Active)
  {
    id: 'gl-draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#ef4444', // Red for active selection
      'line-width': 2,
    },
  },
  // Points (Slope/Markers) - Inactive with hover
  {
    id: 'gl-draw-point-inactive',
    type: 'circle',
    filter: [
      'all',
      ['==', 'active', 'false'],
      ['==', '$type', 'Point'],
      ['!=', 'mode', 'static'],
    ],
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        8, // Larger on hover
        5,
      ],
      'circle-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#FCD34D', // Lighter yellow on hover
        '#fbb03b',
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        2, // Thicker stroke on hover
        1,
      ],
      'circle-stroke-color': '#fff',
    },
  },
  // Points (Slope/Markers) - Active
  {
    id: 'gl-draw-point-active',
    type: 'circle',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point']],
    paint: {
      'circle-radius': 7,
      'circle-color': '#ef4444',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  },
  // Vertex Points (for editing polygons and lines) with hover
  {
    id: 'gl-draw-polygon-and-line-vertex-stroke-inactive',
    type: 'circle',
    filter: [
      'all',
      ['==', 'meta', 'vertex'],
      ['==', '$type', 'Point'],
      ['!=', 'mode', 'static'],
    ],
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        11, // Larger on hover
        8,
      ],
      'circle-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#60A5FA', // Lighter blue on hover
        '#3B82F6',
      ],
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  },
  {
    id: 'gl-draw-polygon-and-line-vertex-stroke-active',
    type: 'circle',
    filter: [
      'all',
      ['==', 'meta', 'vertex'],
      ['==', 'active', 'true'],
      ['==', '$type', 'Point'],
    ],
    paint: {
      'circle-radius': 10,
      'circle-color': '#1D4ED8',
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  },
  // Midpoints (for inserting new vertices) with hover
  {
    id: 'gl-draw-polygon-midpoint',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        7, // Larger on hover
        4,
      ],
      'circle-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#FCD34D', // Lighter yellow on hover
        '#fbb03b',
      ],
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, // Fully opaque on hover
        0.8,
      ],
    },
  },
];

export function ensureHeatmapLayer(m: maplibregl.Map) {
  if (!m.getSource(HEATMAP_SRC)) {
    m.addSource(HEATMAP_SRC, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      generatedId: true,
      promotedId: 'id'
    } as any);
  }

  if (!m.getLayer('greens-heatmap')) {
    m.addLayer({
      id: 'greens-heatmap',
      type: 'heatmap',
      source: HEATMAP_SRC,
      filter: ['==', 'type', 'slope'],
      maxzoom: 24,
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 18, 3],
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
}
