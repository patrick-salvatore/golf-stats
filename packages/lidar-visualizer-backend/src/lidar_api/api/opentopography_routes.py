"""API routes for OpenTopography integration."""

import os
import uuid
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

from ..services.opentopography import get_opentopography_client, OpenTopographyClient
from ..core.loader import LiDARLoader
from ..core.config import settings
from ..models.schemas import FileUploadResponse, ErrorResponse

logger = logging.getLogger(__name__)

router = APIRouter()


class BoundingBox(BaseModel):
    """Bounding box for geographic area."""

    south: float
    north: float
    west: float
    east: float


class DatasetInfo(BaseModel):
    """Information about an OpenTopography dataset."""

    id: str
    name: str
    description: str
    bbox: BoundingBox
    point_count: int
    file_size: int


class DatasetSearchResult(BaseModel):
    """Result from searching OpenTopography datasets."""

    datasets: List[DatasetInfo]
    total_count: int


@router.get("/datasets/search", response_model=DatasetSearchResult)
async def search_datasets(
    south: float = Query(..., description="Southern boundary (latitude)"),
    north: float = Query(..., description="Northern boundary (latitude)"),
    west: float = Query(..., description="Western boundary (longitude)"),
    east: float = Query(..., description="Eastern boundary (longitude)"),
    client: OpenTopographyClient = Depends(get_opentopography_client),
):
    """
    Search for available LiDAR datasets in a geographic area.

    Args:
        south: Southern boundary (latitude)
        north: Northern boundary (latitude)
        west: Western boundary (longitude)
        east: Eastern boundary (longitude)

    Returns:
        List of available datasets in the specified area
    """
    try:
        async with client:
            result = await client.search_datasets(south, north, west, east)

            # Transform the result into our schema
            datasets = []
            for dataset in result.get("datasets", []):
                datasets.append(
                    DatasetInfo(
                        id=dataset.get("id", ""),
                        name=dataset.get("name", ""),
                        description=dataset.get("description", ""),
                        bbox=BoundingBox(
                            south=dataset.get("bbox", {}).get("south", south),
                            north=dataset.get("bbox", {}).get("north", north),
                            west=dataset.get("bbox", {}).get("west", west),
                            east=dataset.get("bbox", {}).get("east", east),
                        ),
                        point_count=dataset.get("point_count", 0),
                        file_size=dataset.get("file_size", 0),
                    )
                )

            return DatasetSearchResult(datasets=datasets, total_count=len(datasets))

    except Exception as e:
        logger.error(f"Failed to search datasets: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to search datasets: {str(e)}"
        )


@router.post("/datasets/{dataset_id}/download", response_model=FileUploadResponse)
async def download_dataset(
    dataset_id: str,
    bbox: BoundingBox,
    output_format: str = Query("LAS", description="Output format (LAS, LAZ, XYZ)"),
    client: OpenTopographyClient = Depends(get_opentopography_client),
):
    """
    Download a LiDAR dataset from OpenTopography.

    Args:
        dataset_id: OpenTopography dataset identifier
        bbox: Bounding box for the area to download
        output_format: Output format (LAS, LAZ, XYZ)

    Returns:
        FileUploadResponse with processed file information
    """
    try:
        async with client:
            # Download the dataset
            file_data = await client.download_dataset(
                dataset_id=dataset_id,
                south=bbox.south,
                north=bbox.north,
                west=bbox.west,
                east=bbox.east,
                output_format=output_format,
            )

            # Generate unique file ID and save
            file_id = str(uuid.uuid4())
            file_extension = f".{output_format.lower()}"
            stored_filename = f"{file_id}{file_extension}"
            file_path = os.path.join(settings.upload_dir, stored_filename)

            # Save the downloaded file
            with open(file_path, "wb") as f:
                f.write(file_data)

            # Load and analyze the file
            las = LiDARLoader.load_file(file_path)
            metadata = LiDARLoader.get_metadata(file_path, las)

            # Store in registry (using the same registry from the main routes)
            from ..api.routes import file_registry

            file_registry[file_id] = {
                "original_filename": f"opentopography_{dataset_id}{file_extension}",
                "stored_path": file_path,
                "metadata": metadata,
                "source": "opentopography",
                "dataset_id": dataset_id,
                "bbox": bbox.model_dump(),
            }

            logger.info(
                f"Downloaded OpenTopography dataset {dataset_id} with ID {file_id}"
            )

            return FileUploadResponse(
                file_id=file_id,
                message=f"Successfully downloaded dataset {dataset_id}",
                metadata=metadata,
            )

    except Exception as e:
        logger.error(f"Failed to download dataset {dataset_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to download dataset: {str(e)}"
        )


@router.get("/datasets/{dataset_id}/info")
async def get_dataset_info(
    dataset_id: str, client: OpenTopographyClient = Depends(get_opentopography_client)
):
    """
    Get detailed information about a specific dataset.

    Args:
        dataset_id: OpenTopography dataset identifier

    Returns:
        Detailed dataset information
    """
    try:
        async with client:
            result = await client.get_dataset_info(dataset_id)
            return result

    except Exception as e:
        logger.error(f"Failed to get dataset info for {dataset_id}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get dataset info: {str(e)}"
        )


@router.get("/status")
async def get_opentopography_status():
    """
    Get OpenTopography service status.

    Returns:
        Service status and configuration
    """
    return {
        "service": "OpenTopography",
        "api_key_configured": bool(settings.opentopography_api_key),
        "base_url": settings.opentopography_base_url,
        "status": "ready",
    }
