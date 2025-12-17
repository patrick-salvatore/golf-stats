"""Run the LiDAR API server."""

try:
    import uvicorn
except ImportError:
    print("❌ uvicorn not found. Please install dependencies with: uv sync")
    exit(1)

from src.lidar_api.main import app
from src.lidar_api.core.config import settings

if __name__ == "__main__":
    print("🚀 Starting LiDAR Visualizer API...")
    print(f"📍 Server: http://{settings.host}:{settings.port}")
    print(f"📚 API Docs: http://{settings.host}:{settings.port}/docs")
    print(
        f"🌐 OpenTopography: {'✅ Configured' if settings.opentopography_api_key else '❌ Not configured'}"
    )
    print("")

    uvicorn.run(
        "src.lidar_api.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
