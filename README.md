# LiDAR Visualizer

A modern web-based tool for visualizing LiDAR point cloud data built with Python FastAPI backend and SolidJS + Three.js frontend.

## Features

- **File Upload**: Drag and drop support for .las and .laz files
- **3D Visualization**: Interactive point cloud viewer with mouse controls
- **Color Schemes**: Height-based, intensity-based, and original color visualization
- **Performance Controls**: Adjustable point limits and downsampling for optimal performance
- **Real-time Processing**: Fast point cloud processing and visualization updates

## Architecture

```
┌─────────────────┐    HTTP API    ┌─────────────────┐
│   SolidJS +     │◄──────────────►│   FastAPI +     │
│   Three.js      │   Point Data   │   laspy +       │
│   Frontend      │                │   NumPy         │
└─────────────────┘                └─────────────────┘
```

### Backend (Python)
- **FastAPI**: High-performance async API framework
- **laspy**: LAS/LAZ file reading and processing
- **NumPy**: Efficient array operations for point cloud data
- **UV**: Modern Python package management

### Frontend (TypeScript/SolidJS)
- **SolidJS**: Reactive UI framework with fine-grained reactivity
- **Three.js**: 3D graphics library for WebGL-based rendering
- **Vite**: Fast development and build tooling

## Quick Start

### Prerequisites
- Python 3.12+ 
- Node.js 18+
- UV package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Option 1: Using Root NPM Scripts (Recommended)

From the project root directory:

```bash
# Install all dependencies
npm run lidar:install

# Start both backend and frontend
npm run lidar:dev

# Check status/URLs
npm run lidar:status
```

### Option 2: Manual Setup

#### 1. Start the Backend

```bash
cd backend
uv sync
uv run python run_server.py
```

The API will be available at http://127.0.0.1:8000

#### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The web application will be available at http://localhost:3000

### 3. Upload LiDAR Data

1. Open http://localhost:3000 in your browser
2. Drag and drop a .las or .laz file onto the upload area
3. Wait for processing and enjoy the 3D visualization!

## Available NPM Scripts

Run these commands from the project root directory:

```bash
# Setup and Installation
npm run lidar:install              # Install all dependencies (backend + frontend)
npm run lidar:install:backend      # Install only backend dependencies  
npm run lidar:install:frontend     # Install only frontend dependencies

# Development
npm run lidar:dev                  # Start both backend and frontend servers
npm run lidar:dev:backend          # Start only the Python backend server
npm run lidar:dev:frontend         # Start only the SolidJS frontend server

# Building and Testing  
npm run lidar:build               # Build frontend for production
npm run lidar:test:backend        # Test backend imports and setup

# Utilities
npm run lidar:status              # Show server URLs and status
npm run lidar:clean               # Clean all generated files and dependencies
```

## API Endpoints

### File Management
- `POST /api/v1/upload` - Upload LAS/LAZ file
- `GET /api/v1/files` - List uploaded files  
- `GET /api/v1/files/{id}/info` - Get file metadata
- `DELETE /api/v1/files/{id}` - Delete file

### Point Cloud Data
- `GET /api/v1/files/{id}/points` - Get point cloud data
  - Query parameters:
    - `max_points` - Maximum number of points (default: 50,000)
    - `color_by` - Color scheme: 'height', 'intensity', 'original' 
    - `downsample` - Downsample factor 0.1-1.0

## Visualization Controls

### Mouse Controls
- **Left Click + Drag**: Rotate view
- **Mouse Wheel**: Zoom in/out

### UI Controls
- **Color Scheme**: Switch between height, intensity, and original colors
- **Max Points**: Limit number of rendered points for performance
- **Downsample**: Reduce point density for faster rendering

## Supported File Formats

- **.las** - ASPRS LAS format (all versions 1.0-1.4)
- **.laz** - Compressed LAS format

The system automatically detects:
- Point coordinates (X, Y, Z)
- RGB color information (if available)
- Intensity values (if available)
- Point classifications
- File metadata and bounds

## Development

### Backend Development

```bash
cd backend

# Install development dependencies
uv add --group dev pytest black ruff

# Run tests
uv run pytest

# Format code
uv run black src/
uv run ruff check src/
```

### Frontend Development

```bash
cd frontend

# Type checking
npx tsc --noEmit

# Build for production
npm run build
```

## Performance Notes

- **Large Files**: Files with >1M points are automatically downsampled for real-time visualization
- **Memory Usage**: The system loads full datasets into memory - monitor RAM usage with very large files
- **Browser Limits**: WebGL has limits on buffer sizes; the system automatically handles this
- **Network**: Point cloud data is transferred as JSON arrays - consider compression for large datasets

## Troubleshooting

### Backend Issues

**Import Error**: Ensure Python 3.12 and UV are properly installed
```bash
uv python pin 3.12
uv sync
```

**File Upload Error**: Check file permissions and disk space in `data/uploads/`

**CORS Error**: Verify frontend URL is in CORS allowed origins (main.py line 30)

### Frontend Issues

**Canvas Not Rendering**: Check browser WebGL support
```javascript
// Test WebGL support in browser console
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
console.log('WebGL supported:', !!gl);
```

**Performance Issues**: 
- Reduce max points to 10,000-20,000
- Increase downsampling (reduce percentage)
- Check browser GPU acceleration

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable  
5. Submit a pull request

## Roadmap

- [ ] Mesh generation from point clouds
- [ ] Additional point cloud formats (PCD, PLY)
- [ ] Real-time collaboration features
- [ ] Advanced filtering (ground/vegetation classification)
- [ ] Export capabilities (images, processed files)
- [ ] WebGL shader-based coloring
- [ ] Progressive loading for very large files