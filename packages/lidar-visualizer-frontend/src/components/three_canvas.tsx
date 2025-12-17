// High-performance Three.js canvas with SolidJS integration

import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import * as THREE from 'three';
import type { PointCloudData } from '../types/lidar';

interface ThreeCanvasProps {
  pointCloudData: PointCloudData | null;
  width?: number;
  height?: number;
}

interface ThreeContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
}

export default function ThreeCanvas(props: ThreeCanvasProps) {
  let canvasRef: HTMLCanvasElement | undefined;
  let threeContext: ThreeContext | undefined;
  let animationId: number;
  let currentPointCloud: THREE.Points | null = null;
  
  // Camera orbit state managed by SolidJS  
  const [orbitState, setOrbitState] = createSignal({
    azimuth: 0,    // Horizontal rotation around target
    elevation: 0,  // Vertical rotation around target
    distance: 15,  // Distance from target
    target: { x: 0, y: 0, z: 0 } // Look-at target (center of point cloud)
  });
  const [isMouseDown, setIsMouseDown] = createSignal(false);

  const initializeThreeJS = (canvas: HTMLCanvasElement) => {
    console.log('🚀 Initializing vanilla Three.js r182...');
    
    const width = props.width || canvas.clientWidth || 800;
    const height = props.height || canvas.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Camera  
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const orbit = orbitState();
    camera.position.set(0, 0, orbit.distance);
    camera.lookAt(orbit.target.x, orbit.target.y, orbit.target.z);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      canvas,
      antialias: true,
      alpha: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    threeContext = { scene, camera, renderer, canvas };
    
    console.log('✅ Three.js scene initialized successfully');
    return threeContext;
  };

  const createPointCloudMesh = (data: PointCloudData): THREE.Points => {
    console.log('🔥 Creating centered point cloud with vanilla Three.js:', data.points.length, 'points');
    
    const pointCount = data.points.length;
    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);

    // Calculate center point for proper centering
    let centerX = 0, centerY = 0, centerZ = 0;
    for (let i = 0; i < pointCount; i++) {
      const point = data.points[i];
      centerX += point[0];
      centerY += point[1]; 
      centerZ += point[2];
    }
    centerX /= pointCount;
    centerY /= pointCount;
    centerZ /= pointCount;
    
    console.log(`📍 Point cloud center: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)})`);

    // Fill position and color arrays efficiently - CENTER THE POINTS
    for (let i = 0; i < pointCount; i++) {
      const point = data.points[i];
      positions[i * 3] = point[0] - centerX;      // Center X
      positions[i * 3 + 1] = point[1] - centerY;  // Center Y  
      positions[i * 3 + 2] = point[2] - centerZ;  // Center Z

      if (data.colors && data.colors[i]) {
        const color = data.colors[i];
        colors[i * 3] = color[0];
        colors[i * 3 + 1] = color[1];
        colors[i * 3 + 2] = color[2];
      } else {
        colors[i * 3] = 0.7;
        colors[i * 3 + 1] = 0.7;
        colors[i * 3 + 2] = 0.7;
      }
    }

    // Create geometry with direct Three.js API
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    // Create material with better point visibility
    const material = new THREE.PointsMaterial({
      size: 0.1,           // Slightly larger points
      vertexColors: true,
      sizeAttenuation: true,
      alphaTest: 0.1
    });

    const points = new THREE.Points(geometry, material);
    
    // Update orbit target to center of point cloud
    setOrbitState(prev => ({
      ...prev,
      target: { x: 0, y: 0, z: 0 } // Points are now centered at origin
    }));
    
    console.log('✅ Centered point cloud mesh created successfully');
    
    return points;
  };

  const setupMouseControls = (canvas: HTMLCanvasElement) => {
    const onMouseDown = (event: MouseEvent) => {
      setIsMouseDown(true);
      canvas.style.cursor = 'grabbing';
    };

    const onMouseUp = () => {
      setIsMouseDown(false);
      canvas.style.cursor = 'grab';
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isMouseDown()) return;

      const deltaX = event.movementX * 0.005; // Slower, more controlled rotation
      const deltaY = event.movementY * 0.005;

      setOrbitState(prev => ({
        ...prev,
        azimuth: prev.azimuth + deltaX,     // Horizontal rotation around target
        elevation: Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, prev.elevation + deltaY)) // Vertical with limits
      }));
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaY > 0 ? 1.1 : 0.9;
      
      setOrbitState(prev => ({
        ...prev,
        distance: Math.max(2, Math.min(100, prev.distance * scale)) // Zoom in/out from target
      }));
    };

    const onMouseLeave = () => {
      setIsMouseDown(false);
      canvas.style.cursor = 'grab';
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel);
    canvas.addEventListener('mouseleave', onMouseLeave);

    onCleanup(() => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    });
  };

  const animate = () => {
    if (!threeContext) return;
    
    animationId = requestAnimationFrame(animate);
    
    // Update camera position based on orbit state (PROPER ORBIT CONTROLS)
    const orbit = orbitState();
    
    // Calculate camera position using spherical coordinates
    const x = orbit.target.x + orbit.distance * Math.cos(orbit.elevation) * Math.cos(orbit.azimuth);
    const y = orbit.target.y + orbit.distance * Math.sin(orbit.elevation);
    const z = orbit.target.z + orbit.distance * Math.cos(orbit.elevation) * Math.sin(orbit.azimuth);
    
    // Update camera position and look-at
    threeContext.camera.position.set(x, y, z);
    threeContext.camera.lookAt(orbit.target.x, orbit.target.y, orbit.target.z);
    
    threeContext.renderer.render(threeContext.scene, threeContext.camera);
  };

  const handleResize = () => {
    if (!threeContext || !canvasRef) return;

    const width = props.width || canvasRef.clientWidth || 800;
    const height = props.height || canvasRef.clientHeight || 600;

    threeContext.camera.aspect = width / height;
    threeContext.camera.updateProjectionMatrix();
    threeContext.renderer.setSize(width, height);
  };

  // Initialize Three.js when canvas is ready
  onMount(() => {
    if (canvasRef) {
      console.log('🎯 Mounting vanilla Three.js canvas...');
      initializeThreeJS(canvasRef);
      setupMouseControls(canvasRef);
      animate();
      
      // Handle window resize
      window.addEventListener('resize', handleResize);
    }
  });

  // Update point cloud when data changes
  createEffect(() => {
    const data = props.pointCloudData;
    if (!data || !threeContext) return;

    console.log('🔄 Updating point cloud with new data...');

    // Remove existing point cloud
    if (currentPointCloud) {
      threeContext.scene.remove(currentPointCloud);
      currentPointCloud.geometry.dispose();
      (currentPointCloud.material as THREE.Material).dispose();
      currentPointCloud = null;
    }

    // Create new point cloud
    currentPointCloud = createPointCloudMesh(data);
    threeContext.scene.add(currentPointCloud);
    
    console.log('✅ Point cloud updated successfully');
  });

  // Cleanup on unmount
  onCleanup(() => {
    console.log('🧹 Cleaning up Three.js resources...');
    
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    
    if (currentPointCloud) {
      currentPointCloud.geometry.dispose();
      (currentPointCloud.material as THREE.Material).dispose();
    }
    
    if (threeContext) {
      threeContext.renderer.dispose();
    }
    
    window.removeEventListener('resize', handleResize);
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: props.width ? `${props.width}px` : '100%',
          height: props.height ? `${props.height}px` : '100%',
          display: 'block',
          cursor: 'grab'
        }}
      />
      
      {/* Overlay UI */}
      <Show when={props.pointCloudData}>
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px 12px',
          'border-radius': '4px',
          'font-family': 'monospace',
          'font-size': '12px'
        }}>
          Points: {props.pointCloudData!.points.length.toLocaleString()}
        </div>

        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '8px 12px',
          'border-radius': '4px',
          'font-family': 'sans-serif',
          'font-size': '11px',
          'line-height': '1.4'
        }}>
          <div>🖱️ Drag: Orbit</div>
          <div>🎯 Target: Center</div>
          <div>🔍 Wheel: Zoom</div>
        </div>

        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(0,150,0,0.8)',
          color: 'white',
          padding: '4px 8px',
          'border-radius': '4px',
          'font-family': 'monospace',
          'font-size': '10px'
        }}>
          🔥 Three.js r182 • Orbit
        </div>
      </Show>
    </div>
  );
}