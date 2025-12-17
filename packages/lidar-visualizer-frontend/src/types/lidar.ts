// TypeScript types for LiDAR data

export interface PointCloudBounds {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
  min_z: number;
  max_z: number;
}

export interface PointCloudMetadata {
  filename: string;
  point_count: number;
  bounds: PointCloudBounds;
  has_colors: boolean;
  has_intensity: boolean;
  file_size: number;
  las_version: string;
  point_data_format: number;
}

export interface PointCloudData {
  points: number[][];  // Array of [x, y, z] coordinates
  colors?: number[][]; // Array of [r, g, b] values (0-1)
  metadata: PointCloudMetadata;
}

export interface FileUploadResponse {
  file_id: string;
  message: string;
  metadata: PointCloudMetadata;
}

export interface FileInfo {
  file_id: string;
  filename: string;
  metadata: PointCloudMetadata;
  upload_date?: string;
  source?: 'upload' | 'opentopography';
}

export interface FileIndex {
  file_id: string;
  filename: string;
  las_version: string;
  point_data_format: number;
  point_count: number;
  file_signature: string;
  bounds_signature: string;
  elevation_range: [number, number];
  geographic_center: [number, number];
  upload_timestamp: string;
  file_size: number;
  source: 'upload' | 'opentopography';
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}