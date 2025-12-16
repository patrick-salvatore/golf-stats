export type MapMode = 'view' | 'pick_location' | 'draw' | 'edit';

export type DrawTool = 'polygon' | 'circle' | 'slope' | 'trajectory';

// Core feature types for unified management
export type FeatureType = 'green' | 'trajectory' | 'tee_box' | 'slope' | 'hazard';

export interface HoleFeature<T extends FeatureType = FeatureType> {
  id: string; // UUID format: {type}_{uuid}
  type: T;
  geometry: GeoJSON.Geometry;
  properties: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface UnifiedHoleFeatures {
  greens: HoleFeature<'green'>[];
  trajectory: HoleFeature<'trajectory'> | null;
  teeBoxes: HoleFeature<'tee_box'>[];
  slopes: HoleFeature<'slope'>[];
  hazards: HoleFeature<'hazard'>[];
}

// Enhanced hole type for course creator
export interface EnhancedHole {
  holeNumber: number;
  par: number;
  handicap: number;
  
  // Pin positions (preserved for backward compatibility)
  lat?: number;
  lng?: number;
  front_lat?: number;
  front_lng?: number;
  back_lat?: number;
  back_lng?: number;
  
  // NEW: Unified features with stable IDs
  features: UnifiedHoleFeatures;
  
  // DEPRECATED: Will be removed after migration
  geo_features?: any;
  trajectory?: any;
  tee_boxes?: any[];
}
