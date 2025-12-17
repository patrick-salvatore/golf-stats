"""Core LiDAR file loading functionality."""

import os
import logging
from pathlib import Path
from typing import Optional, Tuple
import numpy as np
import laspy
import lazrs

from ..models.schemas import PointCloudBounds, PointCloudMetadata

logger = logging.getLogger(__name__)

class LiDARLoader:
    """Handles loading and basic processing of LiDAR files."""

    @staticmethod
    def load_file(file_path: str) -> laspy.LasData:
        """
        Load a LAS/LAZ file using laspy with enhanced error diagnostics.

        Args:
            file_path: Path to the LAS/LAZ file

        Returns:
            Loaded LAS data object

        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If file format is invalid with detailed diagnostics
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        file_extension = Path(file_path).suffix.lower()
        file_size = os.path.getsize(file_path)

        try:
            logger.info(
                f"Loading LiDAR file: {file_path} ({file_extension}, {file_size:,} bytes)"
            )
            las = laspy.read(file_path)
            logger.info(
                f"✅ Successfully loaded {file_extension} file with {len(las.points):,} points"
            )
            return las

        except Exception as e:
            # Enhanced error diagnostics for developers
            try:

                laz_support = f"✅ lazrs {lazrs.__version__ if hasattr(lazrs, '__version__') else 'installed'}"
            except ImportError:
                laz_support = "❌ lazrs not available"

            error_context = {
                "file_path": file_path,
                "file_extension": file_extension,
                "file_size_bytes": file_size,
                "file_size_mb": round(file_size / (1024 * 1024), 2),
                "laspy_version": laspy.__version__,
                "laz_support": laz_support,
                "error_type": type(e).__name__,
                "error_message": str(e),
            }

            logger.error(f"❌ Failed to load {file_extension} file: {error_context}")

            # Specific error messages for different file types
            if file_extension == ".laz":
                if (
                    "lazrs" not in str(e).lower()
                    and "compression" not in str(e).lower()
                ):
                    error_msg = f"LAZ file loading failed - this may be due to laspy API compatibility issues. File: {Path(file_path).name}, Error: {e}"
                else:
                    error_msg = f"LAZ compression error - compression libraries may not be properly configured. File: {Path(file_path).name}, Error: {e}"
            else:
                error_msg = (
                    f"LAS file format error. File: {Path(file_path).name}, Error: {e}"
                )

            raise ValueError(f"{error_msg}. Diagnostics: {error_context}")

    @staticmethod
    def extract_points(las: laspy.LasData) -> np.ndarray:
        """
        Extract XYZ coordinates from LAS data.

        Args:
            las: Loaded LAS data object

        Returns:
            numpy array of shape (n_points, 3) with [x, y, z] coordinates
        """
        points = np.column_stack((las.x, las.y, las.z))
        return points.astype(np.float32)

    @staticmethod
    def extract_colors(las: laspy.LasData) -> Optional[np.ndarray]:
        """
        Extract RGB colors from LAS data if available.

        Args:
            las: Loaded LAS data object

        Returns:
            numpy array of shape (n_points, 3) with normalized [r, g, b] values (0-1)
            or None if no color data available
        """
        try:
            if hasattr(las, "red") and hasattr(las, "green") and hasattr(las, "blue"):
                # LAS color values are typically 16-bit (0-65535), normalize to 0-1
                colors = np.column_stack(
                    (las.red / 65535.0, las.green / 65535.0, las.blue / 65535.0)
                )
                return colors.astype(np.float32)
        except Exception as e:
            logger.warning(f"Failed to extract colors: {e}")

        return None

    @staticmethod
    def extract_intensity(las: laspy.LasData) -> Optional[np.ndarray]:
        """
        Extract intensity values from LAS data if available.

        Args:
            las: Loaded LAS data object

        Returns:
            numpy array of intensity values or None if not available
        """
        try:
            if hasattr(las, "intensity"):
                return las.intensity.astype(np.float32)
        except Exception as e:
            logger.warning(f"Failed to extract intensity: {e}")

        return None

    @staticmethod
    def calculate_bounds(points: np.ndarray) -> PointCloudBounds:
        """
        Calculate bounding box for point cloud.

        Args:
            points: Array of [x, y, z] coordinates

        Returns:
            PointCloudBounds object with min/max values
        """
        if len(points) == 0:
            # Handle empty point clouds
            logger.warning("Point cloud is empty, returning zero bounds")
            return PointCloudBounds(
                min_x=0.0, max_x=0.0, min_y=0.0, max_y=0.0, min_z=0.0, max_z=0.0
            )

        min_coords = np.min(points, axis=0)
        max_coords = np.max(points, axis=0)

        return PointCloudBounds(
            min_x=float(min_coords[0]),
            max_x=float(max_coords[0]),
            min_y=float(min_coords[1]),
            max_y=float(max_coords[1]),
            min_z=float(min_coords[2]),
            max_z=float(max_coords[2]),
        )

    @staticmethod
    def get_metadata(file_path: str, las: laspy.LasData) -> PointCloudMetadata:
        """
        Extract metadata from LAS file with robust error handling.

        Args:
            file_path: Path to the file
            las: Loaded LAS data object

        Returns:
            PointCloudMetadata object

        Raises:
            ValueError: If metadata extraction fails with detailed diagnostics
        """
        filename = Path(file_path).name
        file_size = os.path.getsize(file_path)

        try:
            points = LiDARLoader.extract_points(las)
            colors = LiDARLoader.extract_colors(las)
            intensity = LiDARLoader.extract_intensity(las)
            bounds = LiDARLoader.calculate_bounds(points)

            # Robust version extraction with fallbacks
            try:
                las_version = f"{las.header.major_version}.{las.header.minor_version}"
            except AttributeError as e:
                # Fallback for older API
                try:
                    las_version = (
                        f"{las.header.version.major}.{las.header.version.minor}"
                    )
                except AttributeError:
                    logger.error(
                        f"Cannot access LAS version. Available header attributes: {[attr for attr in dir(las.header) if 'version' in attr.lower()]}"
                    )
                    raise ValueError(
                        f"Cannot determine LAS version. laspy version: {laspy.__version__}, Error: {e}"
                    )

            # Robust point format extraction with fallbacks
            try:
                point_data_format = las.header.point_format.id
            except AttributeError as e:
                # Fallback for older API
                try:
                    point_data_format = las.header.point_data_format_id
                except AttributeError:
                    logger.error(
                        f"Cannot access point format. Available header attributes: {[attr for attr in dir(las.header) if 'format' in attr.lower()]}"
                    )
                    raise ValueError(
                        f"Cannot determine point format. laspy version: {laspy.__version__}, Error: {e}"
                    )

            return PointCloudMetadata(
                filename=filename,
                point_count=len(las.points),
                bounds=bounds,
                has_colors=colors is not None,
                has_intensity=intensity is not None,
                file_size=file_size,
                las_version=las_version,
                point_data_format=point_data_format,
            )

        except Exception as e:
            error_details = {
                "file_path": file_path,
                "file_size": os.path.getsize(file_path)
                if os.path.exists(file_path)
                else "unknown",
                "laspy_version": laspy.__version__,
                "has_lazrs": "lazrs" in str(e)
                or any("lazrs" in str(getattr(las, attr, "")) for attr in dir(las)),
                "header_attributes": [
                    attr for attr in dir(las.header) if not attr.startswith("_")
                ]
                if hasattr(las, "header")
                else "No header",
                "error_type": type(e).__name__,
                "original_error": str(e),
            }

            logger.error(f"Metadata extraction failed for {filename}: {error_details}")
            raise ValueError(
                f"Failed to extract metadata: {e}. Diagnostics: {error_details}"
            )
