// Point cloud viewer using Three.js

import { createSignal, createEffect, onCleanup } from 'solid-js';
import * as THREE from 'three';
import type { PointCloudData } from '../types/lidar';

interface PointCloudViewerProps {
  pointCloudData: PointCloudData | null;
  width?: number;
  height?: number;
}

export default function PointCloudViewer(props: PointCloudViewerProps) {
  const [canvasRef, setCanvasRef] = createSignal<HTMLCanvasElement>();
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let points: THREE.Points | null = null;
  let animationId: number;
  let controls: any; // Will implement basic mouse controls

  // Mouse control state
  let isMouseDown = false;
  let mouseX = 0;
  let mouseY = 0;
  let targetRotationX = 0;
  let targetRotationY = 0;
  let rotationX = 0;
  let rotationY = 0;

  const setupScene = (canvas: HTMLCanvasElement) => {
    const width = props.width || canvas.clientWidth || 800;
    const height = props.height || canvas.clientHeight || 600;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Camera
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 15);

    // Renderer
    renderer = new THREE.WebGLRenderer({ 
      canvas,
      antialias: true,
      alpha: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    setupMouseControls(canvas);
    animate();
  };

  const setupMouseControls = (canvas: HTMLCanvasElement) => {
    const onMouseDown = (event: MouseEvent) => {
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isMouseDown) return;

      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      targetRotationY += deltaX * 0.01;
      targetRotationX += deltaY * 0.01;

      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaY > 0 ? 1.1 : 0.9;
      camera.position.multiplyScalar(scale);
      camera.position.clampLength(2, 50);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel);

    onCleanup(() => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
    });
  };

  const updatePointCloud = (data: PointCloudData) => {
    // Remove existing points
    if (points) {
      scene.remove(points);
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    }

    // Convert point data to Float32Arrays for Three.js
    const pointCount = data.points.length;
    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);

    // Fill position and color arrays
    for (let i = 0; i < pointCount; i++) {
      const point = data.points[i];
      positions[i * 3] = point[0];
      positions[i * 3 + 1] = point[1];
      positions[i * 3 + 2] = point[2];

      if (data.colors && data.colors[i]) {
        const color = data.colors[i];
        colors[i * 3] = color[0];
        colors[i * 3 + 1] = color[1];
        colors[i * 3 + 2] = color[2];
      } else {
        // Default gray color
        colors[i * 3] = 0.7;
        colors[i * 3 + 1] = 0.7;
        colors[i * 3 + 2] = 0.7;
      }
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create material
    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      sizeAttenuation: true,
      alphaTest: 0.1
    });

    // Create points object
    points = new THREE.Points(geometry, material);
    scene.add(points);

    console.log(`Rendered ${pointCount} points`);
  };

  const animate = () => {
    animationId = requestAnimationFrame(animate);

    // Smooth rotation interpolation
    rotationX += (targetRotationX - rotationX) * 0.1;
    rotationY += (targetRotationY - rotationY) * 0.1;

    if (points) {
      points.rotation.x = rotationX;
      points.rotation.y = rotationY;
    }

    renderer.render(scene, camera);
  };

  const handleResize = () => {
    const canvas = canvasRef();
    if (!canvas || !camera || !renderer) return;

    const width = props.width || canvas.clientWidth || 800;
    const height = props.height || canvas.clientHeight || 600;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  // Setup scene when canvas is available
  createEffect(() => {
    const canvas = canvasRef();
    if (canvas && !renderer) {
      setupScene(canvas);
    }
  });

  // Update point cloud when data changes
  createEffect(() => {
    const data = props.pointCloudData;
    if (data && renderer) {
      updatePointCloud(data);
    }
  });

  // Handle window resize
  createEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      onCleanup(() => window.removeEventListener('resize', handleResize));
    }
  });

  // Cleanup on component unmount
  onCleanup(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    if (renderer) {
      renderer.dispose();
    }
    if (points) {
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    }
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={setCanvasRef}
        style={{
          width: props.width ? `${props.width}px` : '100%',
          height: props.height ? `${props.height}px` : '100%',
          display: 'block',
          cursor: 'grab'
        }}
      />
      {props.pointCloudData && (
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
          Points: {props.pointCloudData.points.length.toLocaleString()}
        </div>
      )}
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
        <div>Mouse: Rotate</div>
        <div>Wheel: Zoom</div>
      </div>
    </div>
  );
}