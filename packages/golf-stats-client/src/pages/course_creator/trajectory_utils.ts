// trajectory_utils.ts

import * as turf from '@turf/turf';

/**
 * Calculate the total distance of a trajectory line in yards
 */
export function calculateTrajectoryDistance(
  trajectory: GeoJSON.LineString,
): number {
  if (!trajectory || trajectory.coordinates.length < 2) return 0;
  const line = turf.lineString(trajectory.coordinates);
  return Math.round(turf.length(line, { units: 'yards' }));
}

/**
 * Calculate distance from a tee box to green center along the trajectory
 */
export function calculateTeeToGreenDistance(
  teeBoxCoord: [number, number],
  greenCoord: [number, number],
  trajectory: GeoJSON.LineString | null | undefined,
): number {
  if (
    !trajectory ||
    !trajectory.coordinates ||
    trajectory.coordinates.length < 2
  ) {
    // Fallback to straight line distance
    const from = turf.point(teeBoxCoord);
    const to = turf.point(greenCoord);
    return Math.round(turf.distance(from, to, { units: 'yards' }));
  }

  const trajectoryLine = turf.lineString(trajectory.coordinates);
  const teePoint = turf.point(teeBoxCoord);
  const greenPoint = turf.point(greenCoord);

  // Find the closest point on trajectory to tee box
  const teeOnLine = turf.nearestPointOnLine(trajectoryLine, teePoint);

  // Find the closest point on trajectory to green
  const greenOnLine = turf.nearestPointOnLine(trajectoryLine, greenPoint);

  // Slice the trajectory between these two points
  const slicedLine = turf.lineSlice(teeOnLine, greenOnLine, trajectoryLine);

  // Calculate the distance along the trajectory
  return Math.round(turf.length(slicedLine, { units: 'yards' }));
}

/**
 * Snap a point to the nearest point on a trajectory line
 */
export function snapToTrajectory(
  point: [number, number],
  trajectory: GeoJSON.LineString,
): [number, number] {
  if (!trajectory || trajectory.coordinates.length < 2) return point;

  const trajectoryLine = turf.lineString(trajectory.coordinates);
  const inputPoint = turf.point(point);
  const snapped = turf.nearestPointOnLine(trajectoryLine, inputPoint);

  return snapped.geometry.coordinates as [number, number];
}

/**
 * Create trajectory line styles for MapLibre GL
 */
export const TRAJECTORY_STYLES = {
  drawing: {
    'line-color': '#3B82F6',
    'line-width': 3,
    'line-dasharray': [2, 2],
    'line-opacity': 0.8,
  },
  viewing: {
    'line-color': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      '#60A5FA',
      '#3B82F6',
    ],
    'line-width': [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      4,
      2,
    ],
    'line-dasharray': [3, 2],
    'line-opacity': 0.8,
  },
  editing: {
    'line-color': '#EF4444',
    'line-width': 3,
    'line-dasharray': [2, 2],
    'line-opacity': 0.8,
  },
};

/**
 * Format distance for display
 */
export function formatYardage(yards: number): string {
  return `${yards} yds`;
}

/**
 * Validate trajectory data
 */
export function isValidTrajectory(trajectory: any): boolean {
  return (
    trajectory &&
    trajectory.type === 'LineString' &&
    Array.isArray(trajectory.coordinates) &&
    trajectory.coordinates.length >= 2 &&
    trajectory.coordinates.every(
      (coord: any) =>
        Array.isArray(coord) &&
        coord.length === 2 &&
        typeof coord[0] === 'number' &&
        typeof coord[1] === 'number',
    )
  );
}

/**
 * Create a GeoJSON LineString from coordinates
 */
export function createLineString(
  coordinates: [number, number][],
): GeoJSON.LineString {
  return {
    type: 'LineString',
    coordinates: coordinates,
  };
}

/**
 * Get intermediate points along a trajectory for distance markers
 */
export function getDistanceMarkers(
  trajectory: GeoJSON.LineString,
  interval: number = 100, // yards
): Array<{ point: [number, number]; distance: number }> {
  if (!trajectory || trajectory.coordinates.length < 2) return [];

  const markers: Array<{ point: [number, number]; distance: number }> = [];
  const line = turf.lineString(trajectory.coordinates);
  const totalDistance = turf.length(line, { units: 'yards' });

  for (
    let distance = interval;
    distance < totalDistance;
    distance += interval
  ) {
    const point = turf.along(line, distance, { units: 'yards' });
    markers.push({
      point: point.geometry.coordinates as [number, number],
      distance: Math.round(distance),
    });
  }

  return markers;
}
