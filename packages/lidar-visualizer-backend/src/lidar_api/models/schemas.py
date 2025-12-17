"""Pydantic models for LiDAR API."""

from typing import List, Optional, Tuple
from pydantic import BaseModel, Field


class PointCloudBounds(BaseModel):
    """Bounding box for point cloud data."""

    min_x: float
    max_x: float
    min_y: float
    max_y: float
    min_z: float
    max_z: float


class PointCloudMetadata(BaseModel):
    """Metadata about a point cloud file."""

    filename: str
    point_count: int
    bounds: PointCloudBounds
    has_colors: bool = False
    has_intensity: bool = False
    file_size: int
    las_version: str
    point_data_format: int


class PointCloudData(BaseModel):
    """Point cloud data for visualization."""

    points: List[List[float]] = Field(..., description="Array of [x, y, z] coordinates")
    colors: Optional[List[List[float]]] = Field(
        None, description="Array of [r, g, b] values (0-1)"
    )
    metadata: PointCloudMetadata


class FileUploadResponse(BaseModel):
    """Response after successful file upload."""

    file_id: str
    message: str
    metadata: PointCloudMetadata


class ErrorResponse(BaseModel):
    """Error response model."""

    error: str
    detail: Optional[str] = None


class ProcessingOptions(BaseModel):
    """Options for point cloud processing."""

    downsample_factor: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Fraction of points to keep (0-1)"
    )
    max_points: Optional[int] = Field(
        None, ge=1000, description="Maximum number of points to return"
    )
    color_by: str = Field(
        "height", description="Color scheme: 'height', 'intensity', or 'classification'"
    )
    apply_ground_filter: bool = Field(False, description="Apply ground point filtering")
