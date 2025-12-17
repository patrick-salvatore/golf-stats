"""FastAPI routes for LiDAR API."""

import os
import uuid
import logging
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional

import numpy as np

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Depends
from fastapi.responses import JSONResponse

from ..models.schemas import (
    FileUploadResponse,
    PointCloudData,
    PointCloudMetadata,
    ProcessingOptions,
    ErrorResponse,
)
from ..core.loader import LiDARLoader
from ..core.processor import PointCloudProcessor
from ..core.diagnostics import LiDARDiagnostics

logger = logging.getLogger(__name__)

router = APIRouter()

# File storage configuration
UPLOAD_DIR = "data/uploads"
PROCESSED_DIR = "data/processed"

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

# In-memory storage for demo (in production, use a database)
file_registry = {}


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a LAS/LAZ file for processing.

    Args:
        file: Uploaded LAS/LAZ file

    Returns:
        FileUploadResponse with file ID and metadata
    """
    # Validate file extension
    if not file.filename or not file.filename.lower().endswith((".las", ".laz")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only .las and .laz files are supported.",
        )

    try:
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        stored_filename = f"{file_id}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, stored_filename)

        # Save uploaded file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Load and analyze file
        las = LiDARLoader.load_file(file_path)
        metadata = LiDARLoader.get_metadata(file_path, las)

        # Store in registry with timestamp
        from datetime import datetime

        file_registry[file_id] = {
            "original_filename": file.filename,
            "stored_path": file_path,
            "metadata": metadata,
            "upload_date": datetime.now().isoformat(),
            "source": "upload",
        }

        logger.info(f"Uploaded file {file.filename} with ID {file_id}")

        return FileUploadResponse(
            file_id=file_id,
            message=f"Successfully uploaded {file.filename}",
            metadata=metadata,
        )

    except Exception as e:
        logger.error(f"Failed to upload file {file.filename}: {e}")

        # Generate detailed diagnostics for developers
        try:
            error_diagnostics = LiDARDiagnostics.diagnose_upload_error(
                file_path if "file_path" in locals() else file.filename, e
            )
            detailed_error = (
                f"Failed to process file: {str(e)}. Diagnostics: {error_diagnostics}"
            )
        except Exception:
            # Fallback if diagnostics fail
            detailed_error = f"Failed to process file: {str(e)}"

        raise HTTPException(status_code=500, detail=detailed_error)


@router.get("/files", response_model=List[dict])
async def list_files():
    """
    List all uploaded files.

    Returns:
        List of file information
    """
    files = []
    for file_id, info in file_registry.items():
        files.append(
            {
                "file_id": file_id,
                "filename": info["original_filename"],
                "metadata": info["metadata"],
                "upload_date": info.get("upload_date"),
                "source": info.get("source", "upload"),
            }
        )
    return files


@router.get("/files/{file_id}/info", response_model=PointCloudMetadata)
async def get_file_info(file_id: str):
    """
    Get metadata for a specific file.

    Args:
        file_id: Unique file identifier

    Returns:
        PointCloudMetadata for the file
    """
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")

    return file_registry[file_id]["metadata"]


@router.get("/files/{file_id}/points", response_model=PointCloudData)
async def get_point_data(
    file_id: str,
    max_points: Optional[int] = Query(
        50000, description="Maximum number of points to return"
    ),
    color_by: str = Query(
        "height", description="Color scheme: 'height', 'intensity', or 'original'"
    ),
    downsample: Optional[float] = Query(
        None, ge=0.1, le=1.0, description="Downsample factor (0.1-1.0)"
    ),
):
    """
    Get point cloud data for visualization.

    Args:
        file_id: Unique file identifier
        max_points: Maximum number of points to return
        color_by: Color scheme to apply
        downsample: Downsample factor

    Returns:
        PointCloudData ready for visualization
    """
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        file_info = file_registry[file_id]
        file_path = file_info["stored_path"]

        # Load the file
        las = LiDARLoader.load_file(file_path)
        points = LiDARLoader.extract_points(las)
        original_colors = LiDARLoader.extract_colors(las)
        intensity = LiDARLoader.extract_intensity(las)

        # Apply downsampling if requested
        if downsample and downsample < 1.0:
            points, original_colors = PointCloudProcessor.downsample_random(
                points, original_colors, downsample
            )

        # Limit points if necessary
        if max_points != None and len(points) > max_points:
            points, original_colors = PointCloudProcessor.limit_points(
                points, original_colors, max_points
            )

        # Apply color scheme
        colors = None
        if color_by == "height":
            colors = PointCloudProcessor.generate_height_colors(points)
        elif color_by == "intensity" and intensity is not None:
            # Need to apply same sampling to intensity
            if downsample and downsample < 1.0:
                n_points = len(points)
                n_original = int(n_points / downsample)
                indices = np.random.choice(n_original, size=n_points, replace=False)
                sampled_intensity = intensity[indices]
            else:
                sampled_intensity = intensity[: len(points)]
            colors = PointCloudProcessor.generate_intensity_colors(sampled_intensity)
        elif color_by == "original" and original_colors is not None:
            colors = original_colors
        else:
            # Default to height-based colors
            colors = PointCloudProcessor.generate_height_colors(points)

        # Center and normalize points for better visualization
        points, _ = PointCloudProcessor.center_points(points)
        points, _ = PointCloudProcessor.normalize_scale(points, target_size=10.0)

        # Convert to lists for JSON serialization
        points_list = points.tolist()
        colors_list = colors.tolist() if colors is not None else None

        return PointCloudData(
            points=points_list, colors=colors_list, metadata=file_info["metadata"]
        )

    except Exception as e:
        logger.error(f"Failed to get point data for file {file_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process point data: {str(e)}"
        )


@router.delete("/files/{file_id}")
async def delete_file(file_id: str):
    """
    Delete an uploaded file.

    Args:
        file_id: Unique file identifier

    Returns:
        Success message
    """
    if file_id not in file_registry:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        file_info = file_registry[file_id]
        file_path = file_info["stored_path"]

        # Delete file from disk
        if os.path.exists(file_path):
            os.remove(file_path)

        # Remove from registry
        del file_registry[file_id]

        logger.info(f"Deleted file {file_id}")
        return {"message": "File deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete file {file_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@router.get("/debug/laz-support")
async def debug_laz_support():
    """
    Debug endpoint to check LAZ compression support.

    Returns:
        Detailed LAZ support diagnostics
    """
    try:
        support_info = LiDARDiagnostics.validate_laz_support()
        return {
            "status": "success",
            "laz_support": support_info,
            "recommendations": [
                "If LAZ files fail to load, ensure lazrs is properly installed",
                "Check that laspy[laszip] extra is installed",
                "Verify LAZ file is not corrupted",
            ],
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "recommendations": ["Install LAZ dependencies: uv add lazrs"],
        }


@router.post("/debug/inspect-file")
async def debug_inspect_file(file: UploadFile = File(...)):
    """
    Debug endpoint to inspect a LAS/LAZ file header without processing.

    Args:
        file: LAS/LAZ file to inspect

    Returns:
        Detailed file inspection results
    """
    if not file.filename or not file.filename.lower().endswith((".las", ".laz")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only .las and .laz files are supported.",
        )

    # Save temp file for inspection
    temp_path = None
    try:
        # Create temporary file
        import tempfile

        with tempfile.NamedTemporaryFile(
            suffix=Path(file.filename).suffix, delete=False
        ) as tmp:
            temp_path = tmp.name
            shutil.copyfileobj(file.file, tmp)

        # Inspect the file
        inspection_result = LiDARDiagnostics.inspect_file_header(temp_path)

        return {
            "status": "success",
            "inspection": inspection_result,
            "debug_info": "This endpoint provides detailed technical information for debugging LAS/LAZ file issues",
        }

    except Exception as e:
        error_diagnostics = LiDARDiagnostics.diagnose_upload_error(
            temp_path or file.filename, e
        )
        return {"status": "error", "error": str(e), "diagnostics": error_diagnostics}

    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
