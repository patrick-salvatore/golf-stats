import { UnifiedHoleFeatures, FeatureType } from './types';
import { createFeature, createEmptyFeatures } from './feature_utils';

/**
 * Migration interface for any hole object with legacy data
 */
interface LegacyHole {
  geo_features?: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: GeoJSON.Geometry;
      properties?: Record<string, any>;
    }>;
  };
  trajectory?: GeoJSON.LineString;
  tee_boxes?: Array<{
    id?: number;
    name: string;
    color: string;
    yardage: number;
    lat: number;
    lng: number;
  }>;
  hazards?: any;
}

/**
 * Migrate legacy hole data to unified features structure
 */
export const migrateHoleToUnifiedFeatures = (hole: LegacyHole): UnifiedHoleFeatures => {
  const features = createEmptyFeatures();

  // Migrate geo_features (greens, slopes, hazards)
  if (hole.geo_features?.features) {
    for (const feature of hole.geo_features.features) {
      try {
        // Determine feature type from properties or default to green
        const type = (feature.properties?.type as FeatureType) || 'green';
        
        // Validate that it's a supported type
        if (['green', 'slope', 'hazard'].includes(type)) {
          const migratedFeature = createFeature(type, feature.geometry, feature.properties || {});
          
          switch (type) {
            case 'green':
              features.greens.push(migratedFeature as any);
              break;
            case 'slope':
              features.slopes.push(migratedFeature as any);
              break;
            case 'hazard':
              features.hazards.push(migratedFeature as any);
              break;
          }
        } else {
          // Default unknown types to green
          const migratedFeature = createFeature('green', feature.geometry, { 
            ...feature.properties, 
            type: 'green',
            originalType: type  // Preserve original type for debugging
          });
          features.greens.push(migratedFeature);
        }
      } catch (error) {
        console.warn('Failed to migrate geo feature:', error, feature);
      }
    }
  }

  // Migrate trajectory
  if (hole.trajectory) {
    try {
      features.trajectory = createFeature('trajectory', hole.trajectory, {
        // Preserve any existing trajectory properties
        distance: (hole.trajectory as any).properties?.distance
      });
    } catch (error) {
      console.warn('Failed to migrate trajectory:', error, hole.trajectory);
    }
  }

  // Migrate tee_boxes
  if (hole.tee_boxes && Array.isArray(hole.tee_boxes)) {
    for (const teeBox of hole.tee_boxes) {
      try {
        if (teeBox.lat != null && teeBox.lng != null) {
          const teeFeature = createFeature('tee_box', {
            type: 'Point',
            coordinates: [teeBox.lng, teeBox.lat]
          }, {
            name: teeBox.name || '',
            color: teeBox.color || '#ffffff',
            yardage: teeBox.yardage || 0,
            originalId: teeBox.id // Preserve original ID if it exists
          });
          features.teeBoxes.push(teeFeature);
        }
      } catch (error) {
        console.warn('Failed to migrate tee box:', error, teeBox);
      }
    }
  }

  // Migrate hazards (if they exist as a separate field)
  if (hole.hazards) {
    try {
      // If hazards is already a GeoJSON structure
      if (hole.hazards.features && Array.isArray(hole.hazards.features)) {
        for (const hazard of hole.hazards.features) {
          const hazardFeature = createFeature('hazard', hazard.geometry, hazard.properties || {});
          features.hazards.push(hazardFeature);
        }
      }
      // If hazards is a single feature
      else if (hole.hazards.type && hole.hazards.geometry) {
        const hazardFeature = createFeature('hazard', hole.hazards.geometry, hole.hazards.properties || {});
        features.hazards.push(hazardFeature);
      }
    } catch (error) {
      console.warn('Failed to migrate hazards:', error, hole.hazards);
    }
  }

  return features;
};

/**
 * Check if a hole needs migration
 */
export const needsMigration = (hole: any): boolean => {
  // Check if features doesn't exist but legacy data does
  return (
    !hole.features && 
    (hole.geo_features || hole.trajectory || hole.tee_boxes || hole.hazards)
  );
};

/**
 * Migrate a hole in place
 */
export const migrateHole = (hole: any): any => {
  if (!needsMigration(hole)) {
    return hole;
  }

  const unifiedFeatures = migrateHoleToUnifiedFeatures(hole);
  
  return {
    ...hole,
    unified_features: unifiedFeatures,
    features: unifiedFeatures, // For EnhancedHole interface
  };
};

/**
 * Migrate an array of holes
 */
export const migrateHoles = (holes: any[]): any[] => {
  return holes.map(migrateHole);
};

/**
 * Convert unified features back to legacy format for API compatibility
 * This is useful for syncing with the server until the API is updated
 */
export const convertToLegacyFormat = (features: UnifiedHoleFeatures): Partial<LegacyHole> => {
  const legacy: Partial<LegacyHole> = {};

  // Convert greens, slopes, and hazards to geo_features
  const geoFeatures: any[] = [];
  
  // Add greens
  for (const green of features.greens) {
    geoFeatures.push({
      type: 'Feature',
      geometry: green.geometry,
      properties: green.properties
    });
  }
  
  // Add slopes
  for (const slope of features.slopes) {
    geoFeatures.push({
      type: 'Feature',
      geometry: slope.geometry,
      properties: slope.properties
    });
  }
  
  // Add hazards
  for (const hazard of features.hazards) {
    geoFeatures.push({
      type: 'Feature',
      geometry: hazard.geometry,
      properties: hazard.properties
    });
  }

  if (geoFeatures.length > 0) {
    legacy.geo_features = {
      type: 'FeatureCollection',
      features: geoFeatures
    };
  }

  // Convert trajectory
  if (features.trajectory) {
    legacy.trajectory = features.trajectory.geometry as GeoJSON.LineString;
  }

  // Convert tee boxes
  if (features.teeBoxes.length > 0) {
    legacy.tee_boxes = features.teeBoxes.map(teeBox => {
      const coords = (teeBox.geometry as GeoJSON.Point).coordinates;
      return {
        name: teeBox.properties.name || '',
        color: teeBox.properties.color || '#ffffff',
        yardage: teeBox.properties.yardage || 0,
        lat: coords[1],
        lng: coords[0],
        id: teeBox.properties.originalId // Restore original ID if it exists
      };
    });
  }

  return legacy;
};

/**
 * Validate that migration was successful
 */
export const validateMigration = (original: LegacyHole, migrated: UnifiedHoleFeatures): boolean => {
  try {
    // Check that we didn't lose any features
    const originalFeatureCount = (original.geo_features?.features?.length || 0) +
                                (original.trajectory ? 1 : 0) +
                                (original.tee_boxes?.length || 0);

    const migratedFeatureCount = migrated.greens.length +
                               migrated.slopes.length +
                               migrated.hazards.length +
                               (migrated.trajectory ? 1 : 0) +
                               migrated.teeBoxes.length;

    if (migratedFeatureCount !== originalFeatureCount) {
      console.warn('Feature count mismatch during migration', {
        original: originalFeatureCount,
        migrated: migratedFeatureCount
      });
      return false;
    }

    // Check that all features have valid IDs
    const allFeatures = [
      ...migrated.greens,
      ...migrated.slopes,
      ...migrated.hazards,
      ...migrated.teeBoxes,
      ...(migrated.trajectory ? [migrated.trajectory] : [])
    ];

    for (const feature of allFeatures) {
      if (!feature.id || !feature.type || !feature.geometry) {
        console.warn('Invalid feature found during migration validation', feature);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.warn('Migration validation failed:', error);
    return false;
  }
};