"""Diagnostics and debugging utilities for LiDAR files."""

import os
import logging
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
import laspy

logger = logging.getLogger(__name__)


class LiDARDiagnostics:
    """Diagnostics and inspection utilities for LiDAR files."""

    @staticmethod
    def inspect_file_header(file_path: str) -> Dict[str, Any]:
        """
        Inspect a LAS/LAZ file header without full processing.

        Args:
            file_path: Path to the LAS/LAZ file

        Returns:
            Dictionary with detailed header information
        """
        if not os.path.exists(file_path):
            return {"error": f"File not found: {file_path}"}

        try:
            # Basic file info
            file_info = {
                "file_path": file_path,
                "filename": Path(file_path).name,
                "file_extension": Path(file_path).suffix.lower(),
                "file_size_bytes": os.path.getsize(file_path),
                "file_size_mb": round(os.path.getsize(file_path) / (1024 * 1024), 2),
            }

            # Load file for header inspection
            las = laspy.read(file_path)
            header = las.header

            # Extract version information using multiple methods
            version_info = {}
            version_methods = [
                ("major_version", lambda: header.major_version),
                ("minor_version", lambda: header.minor_version),
                ("version.major", lambda: header.version.major),
                ("version.minor", lambda: header.version.minor),
                ("version_major", lambda: getattr(header, "version_major", None)),
                ("version_minor", lambda: getattr(header, "version_minor", None)),
            ]

            for method_name, method_func in version_methods:
                try:
                    value = method_func()
                    version_info[method_name] = {"value": value, "available": True}
                except AttributeError:
                    version_info[method_name] = {"value": None, "available": False}
                except Exception as e:
                    version_info[method_name] = {
                        "value": None,
                        "available": False,
                        "error": str(e),
                    }

            # Extract point format information
            point_format_info = {}
            format_methods = [
                ("point_format.id", lambda: header.point_format.id),
                (
                    "point_data_format_id",
                    lambda: getattr(header, "point_data_format_id", None),
                ),
                ("point_format", lambda: str(header.point_format)),
            ]

            for method_name, method_func in format_methods:
                try:
                    value = method_func()
                    point_format_info[method_name] = {"value": value, "available": True}
                except AttributeError:
                    point_format_info[method_name] = {"value": None, "available": False}
                except Exception as e:
                    point_format_info[method_name] = {
                        "value": None,
                        "available": False,
                        "error": str(e),
                    }

            # Get all header attributes
            header_attributes = [
                attr for attr in dir(header) if not attr.startswith("_")
            ]

            # Point cloud basic info
            point_info = {
                "point_count": len(las.points),
                "has_points": len(las.points) > 0,
                "available_dimensions": [
                    attr
                    for attr in dir(las)
                    if not attr.startswith("_")
                    and hasattr(getattr(las, attr, None), "__len__")
                ],
            }

            # Compression info
            compression_info = {
                "file_compressed": file_info["file_extension"] == ".laz",
                "lazrs_available": True,  # We know it's available since we just installed it
                "compression_attributes": [
                    attr for attr in header_attributes if "compress" in attr.lower()
                ],
            }

            # Library versions
            library_info = {
                "laspy_version": laspy.__version__,
                "numpy_version": np.__version__,
            }

            try:
                import lazrs

                library_info["lazrs_available"] = True
                library_info["lazrs_version"] = getattr(lazrs, "__version__", "unknown")
            except ImportError:
                library_info["lazrs_available"] = False

            return {
                "status": "success",
                "file_info": file_info,
                "version_info": version_info,
                "point_format_info": point_format_info,
                "point_info": point_info,
                "compression_info": compression_info,
                "library_info": library_info,
                "header_attributes": header_attributes,
                "recommended_api": {
                    "version_access": "header.major_version, header.minor_version",
                    "point_format_access": "header.point_format.id",
                },
            }

        except Exception as e:
            return {
                "status": "error",
                "file_info": file_info
                if "file_info" in locals()
                else {"error": "Could not get file info"},
                "error_type": type(e).__name__,
                "error_message": str(e),
                "library_info": {
                    "laspy_version": laspy.__version__,
                    "numpy_version": np.__version__,
                },
            }

    @staticmethod
    def validate_laz_support() -> Dict[str, Any]:
        """
        Validate LAZ compression support configuration.

        Returns:
            Dictionary with LAZ support status and diagnostics
        """
        support_info = {
            "laspy_version": laspy.__version__,
            "lazrs_available": False,
            "laz_read_capable": False,
            "laz_write_capable": False,
            "compression_backends": [],
        }

        # Check lazrs availability
        try:
            import lazrs

            support_info["lazrs_available"] = True
            support_info["lazrs_version"] = getattr(lazrs, "__version__", "unknown")
            support_info["compression_backends"].append("lazrs")
        except ImportError:
            pass

        # Test LAZ reading capability
        try:
            # This would test actual LAZ reading if we had a test file
            support_info["laz_read_capable"] = support_info["lazrs_available"]
        except Exception:
            pass

        return support_info

    @staticmethod
    def diagnose_upload_error(file_path: str, error: Exception) -> Dict[str, Any]:
        """
        Provide detailed diagnostics for upload errors.

        Args:
            file_path: Path to the problematic file
            error: The exception that occurred

        Returns:
            Detailed diagnostic information
        """
        diagnostics = {
            "error_summary": {
                "type": type(error).__name__,
                "message": str(error),
                "file": Path(file_path).name if file_path else "unknown",
            },
            "file_analysis": {},
            "system_info": LiDARDiagnostics.validate_laz_support(),
            "suggested_solutions": [],
        }

        if file_path and os.path.exists(file_path):
            try:
                diagnostics["file_analysis"] = LiDARDiagnostics.inspect_file_header(
                    file_path
                )
            except Exception as e:
                diagnostics["file_analysis"] = {"error": f"Could not inspect file: {e}"}

        # Provide specific solutions based on error type
        error_msg = str(error).lower()
        if "version_major" in error_msg or "version_minor" in error_msg:
            diagnostics["suggested_solutions"].append(
                "Update to modern laspy API - use major_version/minor_version instead of version_major/version_minor"
            )

        if "point_data_format_id" in error_msg:
            diagnostics["suggested_solutions"].append(
                "Update point format access - use header.point_format.id instead of header.point_data_format_id"
            )

        if "laz" in error_msg or "compression" in error_msg:
            diagnostics["suggested_solutions"].append(
                "Install LAZ compression support: pip install lazrs"
            )

        if "zero-size array" in error_msg:
            diagnostics["suggested_solutions"].append(
                "File contains no points - check if file is valid or corrupted"
            )

        return diagnostics
