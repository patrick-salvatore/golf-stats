"""OpenTopography API client for downloading LiDAR data."""

import logging
from typing import Optional, Dict, Any, Tuple
import httpx
from ..core.config import settings

logger = logging.getLogger(__name__)


class OpenTopographyClient:
    """Client for interacting with OpenTopography API."""

    def __init__(self):
        self.api_key = settings.opentopography_api_key
        self.base_url = settings.opentopography_base_url
        self.client = httpx.AsyncClient(timeout=30.0)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def get_datasets(self) -> Dict[str, Any]:
        """Get available LiDAR datasets from OpenTopography."""
        try:
            url = f"{self.base_url}datasets"
            params = {"key": self.api_key}

            response = await self.client.get(url, params=params)
            response.raise_for_status()

            return response.json()

        except httpx.RequestError as e:
            logger.error(f"Failed to fetch datasets: {e}")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching datasets: {e.response.status_code}")
            raise

    async def search_datasets(
        self,
        south: float,
        north: float,
        west: float,
        east: float,
        dataset_type: str = "lidar",
    ) -> Dict[str, Any]:
        """
        Search for LiDAR datasets within a bounding box.

        Args:
            south: Southern boundary (latitude)
            north: Northern boundary (latitude)
            west: Western boundary (longitude)
            east: Eastern boundary (longitude)
            dataset_type: Type of dataset to search for

        Returns:
            Dictionary containing search results
        """
        try:
            url = f"{self.base_url}datasets"
            params = {
                "key": self.api_key,
                "south": south,
                "north": north,
                "west": west,
                "east": east,
                "type": dataset_type,
                "format": "json",
            }

            response = await self.client.get(url, params=params)
            response.raise_for_status()

            result = response.json()
            logger.info(
                f"Found {len(result.get('datasets', []))} datasets in bounding box"
            )

            return result

        except httpx.RequestError as e:
            logger.error(f"Failed to search datasets: {e}")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error searching datasets: {e.response.status_code}")
            raise

    async def download_dataset(
        self,
        dataset_id: str,
        south: float,
        north: float,
        west: float,
        east: float,
        output_format: str = "LAS",
    ) -> bytes:
        """
        Download LiDAR data for a specific dataset and bounding box.

        Args:
            dataset_id: OpenTopography dataset identifier
            south: Southern boundary (latitude)
            north: Northern boundary (latitude)
            west: Western boundary (longitude)
            east: Eastern boundary (longitude)
            output_format: Output format (LAS, LAZ, XYZ, etc.)

        Returns:
            Raw bytes of the downloaded file
        """
        try:
            url = f"{self.base_url}download"
            params = {
                "key": self.api_key,
                "south": south,
                "north": north,
                "west": west,
                "east": east,
                "dataset": dataset_id,
                "format": output_format,
            }

            logger.info(f"Downloading dataset {dataset_id} in {output_format} format")

            response = await self.client.get(url, params=params)
            response.raise_for_status()

            logger.info(f"Successfully downloaded {len(response.content)} bytes")
            return response.content

        except httpx.RequestError as e:
            logger.error(f"Failed to download dataset: {e}")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error downloading dataset: {e.response.status_code}")
            raise

    async def get_dataset_info(self, dataset_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific dataset.

        Args:
            dataset_id: OpenTopography dataset identifier

        Returns:
            Dictionary containing dataset information
        """
        try:
            url = f"{self.base_url}datasets/{dataset_id}"
            params = {"key": self.api_key}

            response = await self.client.get(url, params=params)
            response.raise_for_status()

            return response.json()

        except httpx.RequestError as e:
            logger.error(f"Failed to get dataset info: {e}")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error getting dataset info: {e.response.status_code}")
            raise


# Helper function to create client instance
async def get_opentopography_client() -> OpenTopographyClient:
    """Get an OpenTopography client instance."""
    return OpenTopographyClient()
