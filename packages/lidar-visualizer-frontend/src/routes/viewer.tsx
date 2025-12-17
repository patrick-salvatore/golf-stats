// Individual file viewer route

import { createSignal, createEffect, Show, onMount } from 'solid-js';
import { useParams, useNavigate, useSearchParams } from '@solidjs/router';
import ThreeCanvas from '../components/three_canvas';
import Controls from '../components/controls';
import { LidarAPI } from '../services/api';
import type { PointCloudData, FileInfo } from '../types/lidar';

export default function Viewer() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [pointCloudData, setPointCloudData] = createSignal<PointCloudData | null>(null);
  const [fileInfo, setFileInfo] = createSignal<FileInfo | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  
  // Visualization controls - initialize from URL params
  const [colorScheme, setColorScheme] = createSignal<'height' | 'intensity' | 'original'>(
    (searchParams.colorBy as any) || 'height'
  );
  const [maxPoints, setMaxPoints] = createSignal(
    parseInt(searchParams.maxPoints as string ) || 50000
  );
  const [downsample, setDownsample] = createSignal(
    parseFloat(searchParams.downsample as string) || 1.0
  );

  // Update URL params when controls change
  createEffect(() => {
    const newParams: any = {};
    if (colorScheme() !== 'height') newParams.colorBy = colorScheme();
    if (maxPoints() !== 50000) newParams.maxPoints = maxPoints().toString();
    if (downsample() !== 1.0) newParams.downsample = downsample().toString();
    
    setSearchParams(newParams);
  });

  const loadFileInfo = async (fileId: string) => {
    try {
      const info = await LidarAPI.getFileInfo(fileId);
      setFileInfo({
        file_id: fileId,
        filename: info.filename,
        metadata: info
      });
    } catch (err) {
      console.error('Failed to load file info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file info');
    }
  };

  const loadPointCloudData = async (fileId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Loading point cloud data for file:', fileId);
      const data = await LidarAPI.getPointData(fileId, {
        maxPoints: maxPoints(),
        colorBy: colorScheme(),
        downsample: downsample() < 1.0 ? downsample() : undefined
      });
      console.log('Point cloud data loaded:', data);
      
      setPointCloudData(data);
      
    } catch (err) {
      console.error('Failed to load point cloud:', err);
      setError(err instanceof Error ? err.message : 'Failed to load point cloud');
    } finally {
      setIsLoading(false);
    }
  };

  // Load file when route params change
  onMount(() => {
    const fileId = params.fileId;
    if (!fileId) {
      navigate('/');
      return;
    }
    
    loadFileInfo(fileId);
    loadPointCloudData(fileId);
  });

  // Reload data when visualization controls change
  createEffect(() => {
    const fileId = params.fileId;
    if (fileId) {
      loadPointCloudData(fileId);
    }
  });

  const handleDelete = async () => {
    const fileId = params.fileId;
    if (!fileId) return;
    
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
      await LidarAPI.deleteFile(fileId);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  return (
    <div style={{ 
      'min-height': 'calc(100vh - 70px)', // Account for navigation height
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      {/* Breadcrumb Navigation */}
      <div style={{
        'margin-bottom': '20px',
        color: 'white',
        display: 'flex',
        'align-items': 'center',
        gap: '10px'
      }}>
        <a 
          href="/" 
          style={{ 
            color: 'rgba(255,255,255,0.8)', 
            'text-decoration': 'none',
            'font-size': '14px'
          }}
        >
          ← Back to Home
        </a>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>|</span>
        <span style={{ color: 'white', 'font-weight': 'bold' }}>
          {fileInfo()?.filename || 'Loading...'}
        </span>
      </div>

      <div style={{
        'max-width': '1400px',
        margin: '0 auto',
        display: 'grid',
        'grid-template-columns': '300px 1fr',
        gap: '20px'
      }}>
        {/* Left Panel */}
        <div>
          {/* File Information */}
          <Show when={fileInfo()}>
            <div style={{
              background: 'white',
              padding: '20px',
              'border-radius': '8px',
              'box-shadow': '0 2px 8px rgba(0,0,0,0.1)',
              'margin-bottom': '20px'
            }}>
              <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '15px' }}>
                <h3 style={{ margin: '0', color: '#333' }}>File Details</h3>
                <button
                  onClick={handleDelete}
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    'border-radius': '4px',
                    cursor: 'pointer',
                    'font-size': '12px'
                  }}
                >
                  🗑️ Delete
                </button>
              </div>
              
              <div style={{ 'font-size': '14px', 'line-height': '1.6' }}>
                <div><strong>File:</strong> {fileInfo()?.metadata.filename}</div>
                <div><strong>Points:</strong> {fileInfo()?.metadata.point_count.toLocaleString()}</div>
                <div><strong>Size:</strong> {((fileInfo()?.metadata.file_size || 0) / 1024 / 1024).toFixed(1)} MB</div>
                <div><strong>LAS Version:</strong> {fileInfo()?.metadata.las_version}</div>
                <div><strong>Point Format:</strong> {fileInfo()?.metadata.point_data_format}</div>
                <div><strong>Has Colors:</strong> {fileInfo()?.metadata.has_colors ? '✅ Yes' : '❌ No'}</div>
                <div><strong>Has Intensity:</strong> {fileInfo()?.metadata.has_intensity ? '✅ Yes' : '❌ No'}</div>
                
                {/* Unique Content Identifiers */}
                <div style={{ 'margin-top': '15px', 'padding-top': '15px', 'border-top': '1px solid #eee' }}>
                  <div style={{ 'font-weight': 'bold', 'margin-bottom': '8px', color: '#555' }}>Geographic Bounds</div>
                  <div style={{ 'font-size': '12px', 'font-family': 'monospace', 'line-height': '1.4' }}>
                    <div>X: {fileInfo()?.metadata.bounds.min_x.toFixed(2)} → {fileInfo()?.metadata.bounds.max_x.toFixed(2)}</div>
                    <div>Y: {fileInfo()?.metadata.bounds.min_y.toFixed(2)} → {fileInfo()?.metadata.bounds.max_y.toFixed(2)}</div>
                    <div>Z: {fileInfo()?.metadata.bounds.min_z.toFixed(2)} → {fileInfo()?.metadata.bounds.max_z.toFixed(2)}</div>
                  </div>
                </div>
                
                {/* Calculated unique identifiers */}
                <div style={{ 'margin-top': '10px' }}>
                  <div style={{ 'font-weight': 'bold', 'margin-bottom': '5px', color: '#555' }}>Content Signature</div>
                  <div style={{ 'font-size': '11px', 'font-family': 'monospace', color: '#777' }}>
                    {/* Generate a simple content signature from metadata */}
                    {`${fileInfo()?.metadata.las_version}_${fileInfo()?.metadata.point_data_format}_${fileInfo()?.metadata.point_count}`}
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* Visualization Controls */}
          <Show when={pointCloudData()}>
            <Controls
              colorScheme={colorScheme()}
              maxPoints={maxPoints()}
              downsample={downsample()}
              hasIntensity={pointCloudData()?.metadata.has_intensity || false}
              hasColors={pointCloudData()?.metadata.has_colors || false}
              onColorSchemeChange={setColorScheme}
              onMaxPointsChange={setMaxPoints}
              onDownsampleChange={setDownsample}
            />
          </Show>
        </div>

        {/* Main Viewer */}
        <div style={{
          background: 'white',
          'border-radius': '12px',
          'box-shadow': '0 4px 16px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          height: '600px',
          position: 'relative'
        }}>
          <Show
            when={!error() && !isLoading() && pointCloudData()}
            fallback={
              <div style={{
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                height: '100%',
                'flex-direction': 'column',
                color: '#666'
              }}>
                <Show when={error()}>
                  <div style={{ 
                    color: '#d32f2f',
                    'text-align': 'center',
                    padding: '20px'
                  }}>
                    <h3>Error Loading File</h3>
                    <p>{error()}</p>
                    <button
                      onClick={() => navigate('/')}
                      style={{
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        'border-radius': '6px',
                        cursor: 'pointer',
                        'margin-top': '10px'
                      }}
                    >
                      ← Back to Home
                    </button>
                  </div>
                </Show>
                
                <Show when={isLoading()}>
                  <div style={{ 'text-align': 'center' }}>
                    <div style={{ 'font-size': '24px', 'margin-bottom': '10px' }}>⏳</div>
                    <div>Loading point cloud...</div>
                  </div>
                </Show>
                
                <Show when={!error() && !isLoading() && !pointCloudData()}>
                  <div style={{ 'text-align': 'center' }}>
                    <div style={{ 'font-size': '48px', 'margin-bottom': '20px', opacity: '0.5' }}>📊</div>
                    <h3>File Not Found</h3>
                    <p>The requested file could not be loaded</p>
                    <button
                      onClick={() => navigate('/')}
                      style={{
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        'border-radius': '6px',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back to Home
                    </button>
                  </div>
                </Show>
              </div>
            }
          >
            <ThreeCanvas 
              pointCloudData={pointCloudData()!}
              width={undefined} 
              height={600}
            />
          </Show>
        </div>
      </div>
    </div>
  );
}