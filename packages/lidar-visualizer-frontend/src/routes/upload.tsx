// Advanced upload page (original App.tsx functionality)

import { createSignal, createEffect, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import ThreeCanvas from '../components/three_canvas';
import FileUpload from '../components/file_upload';
import Controls from '../components/controls';
import { LidarAPI } from '../services/api';
import type { PointCloudData, FileUploadResponse } from '../types/lidar';

export default function Upload() {
  const navigate = useNavigate();
  const [pointCloudData, setPointCloudData] = createSignal<PointCloudData | null>(null);
  const [isUploading, setIsUploading] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [currentFileId, setCurrentFileId] = createSignal<string | null>(null);
  
  // Visualization controls
  const [colorScheme, setColorScheme] = createSignal<'height' | 'intensity' | 'original'>('height');
  const [maxPoints, setMaxPoints] = createSignal(50000);
  const [downsample, setDownsample] = createSignal(1.0);

  const handleFileSelect = async (file: File) => {
    setError(null);
    setIsUploading(true);

    try {
      console.log('Uploading file:', file.name);
      const response: FileUploadResponse = await LidarAPI.uploadFile(file);
      console.log('Upload response:', response);
      
      setCurrentFileId(response.file_id);
      
      // Load point cloud data immediately
      await loadPointCloudData(response.file_id);
      
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
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

  // Reload data when visualization controls change
  createEffect(() => {
    const fileId = currentFileId();
    if (fileId && !isLoading()) {
      loadPointCloudData(fileId);
    }
  });

  const handleViewInDedicatedPage = () => {
    const fileId = currentFileId();
    if (fileId) {
      navigate(`/viewer/${fileId}?colorBy=${colorScheme()}&maxPoints=${maxPoints()}&downsample=${downsample()}`);
    }
  };

  return (
    <div style={{ 
      'min-height': 'calc(100vh - 70px)',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        'text-align': 'center',
        'margin-bottom': '30px',
        color: 'white'
      }}>
        <h1 style={{ 
          margin: '0 0 10px 0',
          'font-size': '2.5rem',
          'font-weight': 'bold'
        }}>
          Advanced Upload & Preview
        </h1>
        <p style={{ 
          margin: '0',
          opacity: '0.9',
          'font-size': '1.1rem'
        }}>
          Upload and immediately preview your LiDAR data with full controls
        </p>
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
          <FileUpload
            onFileSelect={handleFileSelect}
            isUploading={isUploading()}
          />

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

          {/* Actions */}
          <Show when={currentFileId()}>
            <div style={{
              background: 'white',
              padding: '15px',
              'border-radius': '8px',
              'box-shadow': '0 2px 8px rgba(0,0,0,0.1)',
              'margin-top': '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Actions</h4>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
                <button
                  onClick={handleViewInDedicatedPage}
                  style={{
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    padding: '10px 15px',
                    'border-radius': '6px',
                    cursor: 'pointer',
                    'font-size': '14px'
                  }}
                >
                  🔍 Open in Full Viewer
                </button>
                
                <button
                  onClick={() => navigate('/')}
                  style={{
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    'border-radius': '6px',
                    cursor: 'pointer',
                    'font-size': '14px'
                  }}
                >
                  📚 Back to History
                </button>
              </div>
            </div>
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
                    <h3>Upload Error</h3>
                    <p>{error()}</p>
                    <div style={{
                      background: '#f8f9fa',
                      padding: '15px',
                      'border-radius': '6px',
                      'margin-top': '15px',
                      'text-align': 'left',
                      'font-size': '14px',
                      color: '#555'
                    }}>
                      <strong>Troubleshooting:</strong>
                      <ul style={{ margin: '5px 0', 'padding-left': '20px' }}>
                        <li>Ensure file is a valid .las or .laz format</li>
                        <li>Check file size is under 100MB</li>
                        <li>Try the debug endpoint: <code>/api/v1/debug/inspect-file</code></li>
                      </ul>
                    </div>
                  </div>
                </Show>
                
                <Show when={isLoading()}>
                  <div style={{ 'text-align': 'center' }}>
                    <div style={{ 'font-size': '24px', 'margin-bottom': '10px' }}>⏳</div>
                    <div>Processing LiDAR data...</div>
                    <div style={{ 'font-size': '12px', color: '#999', 'margin-top': '5px' }}>
                      This may take a moment for large files
                    </div>
                  </div>
                </Show>
                
                <Show when={!error() && !isLoading() && !pointCloudData()}>
                  <div style={{ 'text-align': 'center' }}>
                    <div style={{ 'font-size': '64px', 'margin-bottom': '20px', opacity: '0.3' }}>📊</div>
                    <h3>Ready for Upload</h3>
                    <p>Drag and drop a LiDAR file to start visualizing</p>
                    <div style={{
                      background: '#f8f9fa',
                      padding: '15px',
                      'border-radius': '6px',
                      'margin-top': '15px',
                      'font-size': '14px',
                      color: '#666'
                    }}>
                      <div><strong>Supported formats:</strong> .las, .laz</div>
                      <div><strong>Max file size:</strong> 100MB</div>
                      <div><strong>Features:</strong> Interactive 3D visualization, multiple color schemes</div>
                    </div>
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