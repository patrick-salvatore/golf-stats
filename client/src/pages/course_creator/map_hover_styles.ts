// map_hover_styles.ts

/**
 * Hover styles configuration for MapboxDraw features
 * These styles provide visual feedback when hovering over features
 */
export const HOVER_STYLES: any[] = [
  // Hover style for LineString (trajectory)
  {
    id: 'gl-draw-line-hover',
    type: 'line',
    filter: [
      'all',
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
        ['case',
          ['==', ['get', 'active'], 'true'],
          '#2563EB',
          '#3B82F6'
        ]
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        5, // Thicker on hover
        ['case',
          ['==', ['get', 'active'], 'true'],
          4,
          3
        ]
      ],
      'line-dasharray': [2, 1],
    },
  },

  // Hover style for Polygon fill
  {
    id: 'gl-draw-polygon-fill-hover',
    type: 'fill',
    filter: [
      'all',
      ['==', '$type', 'Polygon'],
      ['!=', 'mode', 'static'],
    ],
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#34D399', // Lighter green on hover
        '#10b981'
      ],
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        0.35, // More opaque on hover
        0.2
      ],
    },
  },

  // Hover style for Polygon outline
  {
    id: 'gl-draw-polygon-stroke-hover',
    type: 'line',
    filter: [
      'all',
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
        ['case',
          ['==', ['get', 'active'], 'true'],
          '#ef4444',
          '#10b981'
        ]
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        4, // Thicker on hover
        ['case',
          ['==', ['get', 'active'], 'true'],
          3,
          2
        ]
      ],
    },
  },

  // Hover style for Points
  {
    id: 'gl-draw-point-hover',
    type: 'circle',
    filter: [
      'all',
      ['==', '$type', 'Point'],
      ['!=', 'meta', 'vertex'],
      ['!=', 'meta', 'midpoint'],
      ['!=', 'mode', 'static'],
    ],
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        9, // Larger on hover
        ['case',
          ['==', ['get', 'active'], 'true'],
          7,
          5
        ]
      ],
      'circle-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#FCD34D', // Lighter yellow on hover
        ['case',
          ['==', ['get', 'active'], 'true'],
          '#ef4444',
          '#fbb03b'
        ]
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        3, // Thicker stroke on hover
        ['case',
          ['==', ['get', 'active'], 'true'],
          2,
          1
        ]
      ],
      'circle-stroke-color': '#ffffff',
    },
  },

  // Hover style for Vertices
  {
    id: 'gl-draw-vertex-hover',
    type: 'circle',
    filter: [
      'all',
      ['==', 'meta', 'vertex'],
      ['==', '$type', 'Point'],
    ],
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        12, // Larger on hover
        ['case',
          ['==', ['get', 'active'], 'true'],
          10,
          8
        ]
      ],
      'circle-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#60A5FA', // Lighter blue on hover
        ['case',
          ['==', ['get', 'active'], 'true'],
          '#1D4ED8',
          '#3B82F6'
        ]
      ],
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
    },
  },

  // Hover style for Midpoints
  {
    id: 'gl-draw-midpoint-hover',
    type: 'circle',
    filter: [
      'all',
      ['==', '$type', 'Point'],
      ['==', 'meta', 'midpoint'],
    ],
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        7, // Larger on hover
        4
      ],
      'circle-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        '#FCD34D', // Lighter yellow on hover
        '#fbb03b'
      ],
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        1, // Fully opaque on hover
        0.8
      ],
    },
  },
];

/**
 * Helper function to apply hover effect programmatically
 */
export function applyHoverEffect(map: maplibregl.Map, feature: any): void {
  if (!feature || !feature.id) return;
  
  // Set hover state for the feature
  map.setFeatureState(
    { source: feature.source, id: feature.id },
    { hover: true }
  );
}

/**
 * Helper function to remove hover effect
 */
export function removeHoverEffect(map: maplibregl.Map, feature: any): void {
  if (!feature || !feature.id) return;
  
  // Remove hover state for the feature
  map.setFeatureState(
    { source: feature.source, id: feature.id },
    { hover: false }
  );
}

/**
 * Get cursor style based on feature type
 */
export function getCursorForFeature(feature: any): string {
  if (!feature) return 'default';
  
  const meta = feature.properties?.meta;
  const active = feature.properties?.active;
  
  if (meta === 'vertex') {
    return 'move'; // Move cursor for vertices
  } else if (meta === 'midpoint') {
    return 'cell'; // Cell cursor for adding new vertices
  } else if (active === 'true') {
    return 'move'; // Move cursor for active features
  } else {
    return 'pointer'; // Pointer cursor for selectable features
  }
}