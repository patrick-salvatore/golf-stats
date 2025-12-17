import { FeatureType, HoleFeature, UnifiedHoleFeatures } from './types';

/**
 * Generate a stable UUID-based ID for a feature
 * Format: {type}_{uuid}
 * Example: green_123e4567-e89b-12d3-a456-426614174000
 */
export const generateFeatureId = (type: FeatureType): string => {
  return `${type}_${crypto.randomUUID()}`;
};

/**
 * Parse a feature ID to extract type and UUID
 */
export const parseFeatureId = (id: string): { type: FeatureType; uuid: string } => {
  const [type, uuid] = id.split('_', 2);
  return { type: type as FeatureType, uuid };
};

/**
 * Create a new feature with stable ID and timestamps
 */
export const createFeature = <T extends FeatureType>(
  type: T,
  geometry: GeoJSON.Geometry,
  properties: Record<string, any> = {}
): HoleFeature<T> => {
  const now = new Date().toISOString();
  return {
    id: generateFeatureId(type),
    type,
    geometry,
    properties: { ...properties, type },
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Update an existing feature with new timestamp
 */
export const updateFeature = <T extends FeatureType>(
  feature: HoleFeature<T>,
  updates: Partial<Omit<HoleFeature<T>, 'id' | 'type' | 'createdAt'>>
): HoleFeature<T> => {
  return {
    ...feature,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Create an empty unified features structure
 */
export const createEmptyFeatures = (): UnifiedHoleFeatures => ({
  greens: [],
  trajectory: null,
  teeBoxes: [],
  slopes: [],
  hazards: [],
});

/**
 * Get all features as a flat array for map rendering
 */
export const getAllFeatures = (features: UnifiedHoleFeatures): HoleFeature[] => {
  const allFeatures: HoleFeature[] = [
    ...features.greens,
    ...features.slopes,
    ...features.hazards,
    ...features.teeBoxes,
  ];
  
  if (features.trajectory) {
    allFeatures.push(features.trajectory);
  }
  
  return allFeatures;
};

/**
 * Convert unified features to GeoJSON FeatureCollection for map rendering
 */
export const featuresToGeoJSON = (features: UnifiedHoleFeatures): GeoJSON.FeatureCollection => {
  const allFeatures = getAllFeatures(features);
  
  return {
    type: 'FeatureCollection',
    features: allFeatures.map(feature => ({
      type: 'Feature',
      id: feature.id,
      properties: feature.properties,
      geometry: feature.geometry,
    })) as GeoJSON.Feature[],
  };
};

/**
 * Find a feature by ID within unified features
 */
export const findFeatureById = (features: UnifiedHoleFeatures, id: string): HoleFeature | null => {
  const { type } = parseFeatureId(id);
  
  switch (type) {
    case 'green':
      return features.greens.find(f => f.id === id) || null;
    case 'trajectory':
      return features.trajectory?.id === id ? features.trajectory : null;
    case 'tee_box':
      return features.teeBoxes.find(f => f.id === id) || null;
    case 'slope':
      return features.slopes.find(f => f.id === id) || null;
    case 'hazard':
      return features.hazards.find(f => f.id === id) || null;
    default:
      return null;
  }
};

/**
 * Get the collection name for a feature type
 */
export const getCollectionName = (type: FeatureType): keyof UnifiedHoleFeatures => {
  switch (type) {
    case 'green':
      return 'greens';
    case 'trajectory':
      return 'trajectory';
    case 'tee_box':
      return 'teeBoxes';
    case 'slope':
      return 'slopes';
    case 'hazard':
      return 'hazards';
  }
};

/**
 * Validate that a feature has the required structure
 */
export const validateFeature = (feature: any): feature is HoleFeature => {
  return (
    feature &&
    typeof feature.id === 'string' &&
    typeof feature.type === 'string' &&
    feature.geometry &&
    feature.properties &&
    typeof feature.createdAt === 'string' &&
    typeof feature.updatedAt === 'string'
  );
};