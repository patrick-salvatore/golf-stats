"""Point cloud processing utilities."""

import logging
from typing import Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)


class PointCloudProcessor:
    """Handles point cloud processing operations."""

    @staticmethod
    def downsample_random(
        points: np.ndarray, colors: Optional[np.ndarray], sample_rate: float
    ) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        Randomly downsample point cloud.

        Args:
            points: Array of [x, y, z] coordinates
            colors: Array of [r, g, b] colors (optional)
            sample_rate: Fraction of points to keep (0-1)

        Returns:
            Tuple of (downsampled_points, downsampled_colors)
        """
        if sample_rate >= 1.0:
            return points, colors

        n_points = len(points)
        n_sample = int(n_points * sample_rate)

        # Random sampling without replacement
        indices = np.random.choice(n_points, size=n_sample, replace=False)
        indices = np.sort(indices)  # Sort for better memory access

        sampled_points = points[indices]
        sampled_colors = colors[indices] if colors is not None else None

        logger.info(
            f"Downsampled from {n_points} to {n_sample} points ({sample_rate:.2%})"
        )
        return sampled_points, sampled_colors

    @staticmethod
    def limit_points(
        points: np.ndarray, colors: Optional[np.ndarray], max_points: int
    ) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        Limit number of points by random sampling.

        Args:
            points: Array of [x, y, z] coordinates
            colors: Array of [r, g, b] colors (optional)
            max_points: Maximum number of points to return

        Returns:
            Tuple of (limited_points, limited_colors)
        """
        if len(points) <= max_points:
            return points, colors

        sample_rate = max_points / len(points)
        return PointCloudProcessor.downsample_random(points, colors, sample_rate)

    @staticmethod
    def generate_height_colors(points: np.ndarray) -> np.ndarray:
        """
        Generate colors based on height (Z coordinate).

        Args:
            points: Array of [x, y, z] coordinates

        Returns:
            Array of [r, g, b] colors (0-1) based on height
        """
        z_coords = points[:, 2]
        z_min, z_max = np.min(z_coords), np.max(z_coords)

        if z_max == z_min:
            # All points at same height, use single color
            return np.ones((len(points), 3)) * 0.5

        # Normalize height to 0-1
        normalized_height = (z_coords - z_min) / (z_max - z_min)

        # Create RGB colors using a simple gradient (blue to green to red)
        colors = np.zeros((len(points), 3))

        # Blue to cyan (low heights)
        mask = normalized_height < 0.33
        colors[mask, 2] = 1.0  # Blue
        colors[mask, 1] = normalized_height[mask] / 0.33  # Green increases

        # Cyan to yellow (medium heights)
        mask = (normalized_height >= 0.33) & (normalized_height < 0.67)
        colors[mask, 1] = 1.0  # Green
        colors[mask, 2] = (
            1.0 - (normalized_height[mask] - 0.33) / 0.34
        )  # Blue decreases
        colors[mask, 0] = (normalized_height[mask] - 0.33) / 0.34  # Red increases

        # Yellow to red (high heights)
        mask = normalized_height >= 0.67
        colors[mask, 0] = 1.0  # Red
        colors[mask, 1] = (
            1.0 - (normalized_height[mask] - 0.67) / 0.33
        )  # Green decreases

        return colors.astype(np.float32)

    @staticmethod
    def generate_intensity_colors(intensity: np.ndarray) -> np.ndarray:
        """
        Generate colors based on intensity values.

        Args:
            intensity: Array of intensity values

        Returns:
            Array of [r, g, b] colors (0-1) based on intensity
        """
        if len(intensity) == 0:
            return np.array([]).reshape(0, 3)

        # Normalize intensity to 0-1
        i_min, i_max = np.min(intensity), np.max(intensity)
        if i_max == i_min:
            # All same intensity, use gray
            gray_value = 0.5
            return np.ones((len(intensity), 3)) * gray_value

        normalized_intensity = (intensity - i_min) / (i_max - i_min)

        # Create grayscale colors
        colors = np.column_stack(
            (normalized_intensity, normalized_intensity, normalized_intensity)
        )

        return colors.astype(np.float32)

    @staticmethod
    def center_points(points: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Center point cloud at origin.

        Args:
            points: Array of [x, y, z] coordinates

        Returns:
            Tuple of (centered_points, translation_offset)
        """
        center = np.mean(points, axis=0)
        centered_points = points - center
        return centered_points, center

    @staticmethod
    def normalize_scale(
        points: np.ndarray, target_size: float = 10.0
    ) -> Tuple[np.ndarray, float]:
        """
        Normalize point cloud to fit within target size.

        Args:
            points: Array of [x, y, z] coordinates
            target_size: Target size for the largest dimension

        Returns:
            Tuple of (scaled_points, scale_factor)
        """
        # Calculate current size
        min_coords = np.min(points, axis=0)
        max_coords = np.max(points, axis=0)
        current_size = np.max(max_coords - min_coords)

        if current_size == 0:
            return points, 1.0

        # Calculate scale factor
        scale_factor = target_size / current_size
        scaled_points = points * scale_factor

        return scaled_points, scale_factor
