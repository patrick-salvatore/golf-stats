// Individual file card component for history display

import { A } from '@solidjs/router';
import type { FileInfo } from '../types/lidar';
import { Show } from 'solid-js';

interface FileCardProps {
  file: FileInfo;
  onDelete?: (fileId: string) => void;
}

export default function FileCard(props: FileCardProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatPointCount = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  const getFileTypeIcon = (filename: string) => {
    return filename.toLowerCase().endsWith('.laz') ? '📦' : '📄';
  };

  const generateContentSignature = (file: FileInfo) => {
    // Create unique content signature from LAS metadata
    const bounds = file.metadata.bounds;
    const elevationRange = bounds.max_z - bounds.min_z;
    const centerX = (bounds.min_x + bounds.max_x) / 2;
    const centerY = (bounds.min_y + bounds.max_y) / 2;
    
    return {
      version: file.metadata.las_version,
      format: `PF${file.metadata.point_data_format}`,
      elevation: `${elevationRange.toFixed(1)}m range`,
      center: `${centerX.toFixed(2)}, ${centerY.toFixed(2)}`,
      density: `${(file.metadata.point_count / ((bounds.max_x - bounds.min_x) * (bounds.max_y - bounds.min_y))).toFixed(0)} pts/m²`
    };
  };

  const signature = () => generateContentSignature(props.file);

  return (
    <div style={{
      background: 'white',
      'border-radius': '12px',
      'box-shadow': '0 2px 8px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      border: '1px solid transparent'

    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px 10px',
        'border-bottom': '1px solid #f0f0f0'
      }}>
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
            <span style={{ 'font-size': '18px' }}>{getFileTypeIcon(props.file.filename)}</span>
            <h4 style={{ 
              margin: '0', 
              color: '#333',
              'font-size': '16px',
              'word-break': 'break-word',
              'max-width': '200px'
            }}>
              {props.file.filename}
            </h4>
          </div>
          
          <Show when={props.onDelete}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                props.onDelete?.(props.file.file_id);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc3545',
                cursor: 'pointer',
                padding: '4px',
                'border-radius': '4px',
                opacity: '0.7'

              }}
              title="Delete file"
            >
              🗑️
            </button>
          </Show>
        </div>
      </div>

      {/* Content */}
      <A href={`/viewer/${props.file.file_id}`} style={{ 'text-decoration': 'none', color: 'inherit' }}>
        <div style={{ padding: '15px 20px' }}>
          {/* Quick Stats */}
          <div style={{
            display: 'grid',
            'grid-template-columns': '1fr 1fr',
            gap: '10px',
            'margin-bottom': '15px'
          }}>
            <div style={{ 'text-align': 'center' }}>
              <div style={{ 'font-size': '20px', 'font-weight': 'bold', color: '#667eea' }}>
                {formatPointCount(props.file.metadata.point_count)}
              </div>
              <div style={{ 'font-size': '12px', color: '#888' }}>Points</div>
            </div>
            <div style={{ 'text-align': 'center' }}>
              <div style={{ 'font-size': '16px', 'font-weight': 'bold', color: '#555' }}>
                {formatFileSize(props.file.metadata.file_size)}
              </div>
              <div style={{ 'font-size': '12px', color: '#888' }}>File Size</div>
            </div>
          </div>

          {/* Content Signature */}
          <div style={{
            background: '#f8f9fa',
            padding: '12px',
            'border-radius': '6px',
            'margin-bottom': '15px'
          }}>
            <div style={{ 'font-weight': 'bold', 'font-size': '12px', color: '#555', 'margin-bottom': '8px' }}>
              Content Signature
            </div>
            <div style={{ 'font-size': '11px', 'line-height': '1.4', 'font-family': 'monospace' }}>
              <div>📍 LAS {signature().version} • {signature().format}</div>
              <div>📏 {signature().elevation}</div>
              <div>🎯 {signature().center}</div>
              <div>📊 {signature().density}</div>
            </div>
          </div>

          {/* Features */}
          <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
            <Show when={props.file.metadata.has_colors}>
              <span style={{
                background: '#e3f2fd',
                color: '#1976d2',
                padding: '2px 6px',
                'border-radius': '12px',
                'font-size': '10px',
                'font-weight': 'bold'
              }}>
                🎨 COLORS
              </span>
            </Show>
            
            <Show when={props.file.metadata.has_intensity}>
              <span style={{
                background: '#f3e5f5',
                color: '#7b1fa2',
                padding: '2px 6px',
                'border-radius': '12px',
                'font-size': '10px',
                'font-weight': 'bold'
              }}>
                💡 INTENSITY
              </span>
            </Show>
            
            <Show when={props.file.filename.toLowerCase().endsWith('.laz')}>
              <span style={{
                background: '#e8f5e8',
                color: '#388e3c',
                padding: '2px 6px',
                'border-radius': '12px',
                'font-size': '10px',
                'font-weight': 'bold'
              }}>
                🗜️ COMPRESSED
              </span>
            </Show>
          </div>
        </div>
      </A>

      {/* View Button */}
      <div style={{ padding: '0 20px 20px' }}>
        <A 
          href={`/viewer/${props.file.file_id}`}
          style={{
            display: 'block',
            'text-align': 'center',
            background: '#667eea',
            color: 'white',
            padding: '10px',
            'border-radius': '6px',
            'text-decoration': 'none',
            'font-weight': 'bold',
            transition: 'background 0.2s'

          }}
        >
          👁️ View Point Cloud
        </A>
      </div>
    </div>
  );
}