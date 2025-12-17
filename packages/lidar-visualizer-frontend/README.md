# LiDAR Visualizer Frontend

SolidJS + solid-three frontend for LiDAR point cloud visualization.

## Tech Stack

- **SolidJS**: Reactive UI framework
- **solid-three**: Declarative Three.js for SolidJS
- **Three.js**: 3D graphics library
- **TypeScript**: Type safety
- **Vite**: Fast build tool

## Development

```bash
# From project root (recommended)
npm run lidar:dev:frontend

# Or directly in this package
pnpm run dev
```

## Building

```bash
# From project root (recommended)  
npm run lidar:build

# Or directly in this package
pnpm run build
```

## Package Management

```bash
# Add production dependency
npm run lidar:add:frontend <package>

# Add dev dependency  
npm run lidar:add:frontend:dev <package>

# Or use pnpm directly
pnpm --filter lidar-visualizer-frontend add <package>
pnpm --filter lidar-visualizer-frontend add -D <package>
```

## Components

- `PointCloudCanvas.tsx` - Main canvas wrapper with solid-three
- `PointCloudScene.tsx` - 3D scene setup and lighting
- `PointCloud.tsx` - Reactive point cloud rendering
- `CameraControls.tsx` - Mouse/keyboard camera controls
- `PointCloudOverlay.tsx` - UI overlays and information
- `FileUpload.tsx` - Drag & drop file upload interface
- `Controls.tsx` - Visualization parameter controls

## Architecture

The frontend uses solid-three for declarative 3D scene management:

```tsx
<Canvas camera={{ position: [0, 0, 15] }}>
  <ambientLight intensity={0.6} />
  <PointCloud data={pointCloudData} />
  <CameraControls />
</Canvas>
```

This approach provides:
- Automatic memory management
- Reactive updates via SolidJS signals
- Declarative scene structure
- Clean component separation