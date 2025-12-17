// Home page with file upload and history

import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import FileUpload from '../components/file_upload';
import FileHistoryList from '../components/file_history_list';
import { LidarAPI } from '../services/api';
import type { FileUploadResponse } from '../types/lidar';

export default function Home() {
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);
  const [recentUpload, setRecentUpload] = createSignal<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    setRecentUpload(null);

    try {
      console.log('Uploading file from home page:', file.name);
      const response: FileUploadResponse = await LidarAPI.uploadFile(file);
      console.log('Upload response:', response);
      
      setRecentUpload(response.file_id);
      
      // Auto-navigate to viewer after successful upload
      setTimeout(() => {
        navigate(`/viewer/${response.file_id}`);
      }, 1500);
      
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ 
      'min-height': 'calc(100vh - 70px)', // Account for navigation
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '30px 20px'
    }}>
      <div style={{
        'max-width': '1200px',
        margin: '0 auto'
      }}>
        {/* Welcome Header */}
        <div style={{
          'text-align': 'center',
          'margin-bottom': '40px',
          color: 'white'
        }}>
          <h1 style={{ 
            margin: '0 0 15px 0',
            'font-size': '3rem',
            'font-weight': 'bold'
          }}>
            Welcome to LiDAR Visualizer
          </h1>
          <p style={{ 
            margin: '0 0 10px 0',
            opacity: '0.9',
            'font-size': '1.2rem'
          }}>
            Upload, manage, and visualize your LiDAR point cloud data
          </p>
          <p style={{ 
            margin: '0',
            opacity: '0.7',
            'font-size': '1rem'
          }}>
            Supports LAS and LAZ files • Powered by solid-three
          </p>
        </div>

        {/* Quick Upload Section */}
        <div style={{
          'margin-bottom': '40px'
        }}>
          <h2 style={{ 
            color: 'white', 
            'text-align': 'center', 
            'margin-bottom': '20px',
            'font-size': '1.5rem'
          }}>
            📁 Quick Upload
          </h2>
          
          <div style={{ 'max-width': '600px', margin: '0 auto' }}>
            <FileUpload
              onFileSelect={handleFileSelect}
              isUploading={isUploading()}
            />
            
            {/* Upload Status */}
            <Show when={uploadError()}>
              <div style={{
                background: 'rgba(220, 53, 69, 0.9)',
                color: 'white',
                padding: '15px',
                'border-radius': '8px',
                'margin-top': '15px',
                'text-align': 'center'
              }}>
                <strong>Upload Error:</strong> {uploadError()}
              </div>
            </Show>
            
            <Show when={recentUpload()}>
              <div style={{
                background: 'rgba(40, 167, 69, 0.9)',
                color: 'white',
                padding: '15px',
                'border-radius': '8px',
                'margin-top': '15px',
                'text-align': 'center'
              }}>
                ✅ Upload successful! Redirecting to viewer...
              </div>
            </Show>
          </div>
        </div>

        {/* File History Section */}
        <div>
          <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '20px' }}>
            <h2 style={{ 
              color: 'white', 
              margin: '0',
              'font-size': '1.5rem'
            }}>
              📚 File History
            </h2>
            
            <div style={{ 
              color: 'rgba(255,255,255,0.8)', 
              'font-size': '14px',
              'font-family': 'monospace'
            }}>
              Recently uploaded files
            </div>
          </div>
          
          <FileHistoryList 
            onFileSelect={(fileId) => navigate(`/viewer/${fileId}`)}
            maxDisplay={12} // Show up to 12 files on home page
          />
        </div>

        {/* Quick Actions */}
        <div style={{
          'margin-top': '30px',
          'text-align': 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            gap: '15px',
            'flex-wrap': 'wrap'
          }}>
            <button
              onClick={() => window.open('http://127.0.0.1:8000/docs', '_blank')}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '12px 20px',
                'border-radius': '8px',
                cursor: 'pointer',
                'backdrop-filter': 'blur(10px)',
                transition: 'all 0.2s'
              }}
            >
              📚 API Documentation
            </button>
            
            <button
              onClick={() => navigate('/upload')}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '12px 20px',
                'border-radius': '8px',
                cursor: 'pointer',
                'backdrop-filter': 'blur(10px)',
                transition: 'all 0.2s'
              }}
            >
              📤 Advanced Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}