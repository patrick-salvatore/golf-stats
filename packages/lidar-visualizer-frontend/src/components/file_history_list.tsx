// File history list component

import { createSignal, createEffect, Show, For, onMount } from 'solid-js';
import FileCard from './file_card';
import { LidarAPI } from '../services/api';
import type { FileInfo } from '../types/lidar';

interface FileHistoryListProps {
  onFileSelect?: (fileId: string) => void;
  maxDisplay?: number;
}

export default function FileHistoryList(props: FileHistoryListProps) {
  const [files, setFiles] = createSignal<FileInfo[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [sortBy, setSortBy] = createSignal<'name' | 'size' | 'points' | 'version'>('name');

  const loadFiles = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const fileList = await LidarAPI.listFiles();
      console.log('Loaded file history:', fileList);
      
      // Add upload timestamps (mock for now - will enhance backend later)
      const filesWithTimestamps = fileList.map((file, index) => ({
        ...file,
        upload_date: new Date(Date.now() - index * 60000).toISOString(), // Mock: each file 1 min apart
        source: 'upload' as const
      }));
      
      setFiles(filesWithTimestamps);
    } catch (err) {
      console.error('Failed to load file history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort files
  const filteredAndSortedFiles = () => {
    let filtered = files();
    
    // Apply search filter
    if (searchQuery().trim()) {
      const query = searchQuery().toLowerCase();
      filtered = filtered.filter(file => 
        file.filename.toLowerCase().includes(query) ||
        file.metadata.las_version.includes(query) ||
        file.metadata.point_data_format.toString().includes(query)
      );
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy()) {
        case 'name':
          return a.filename.localeCompare(b.filename);
        case 'size':
          return b.metadata.file_size - a.metadata.file_size;
        case 'points':
          return b.metadata.point_count - a.metadata.point_count;
        case 'version':
          return a.metadata.las_version.localeCompare(b.metadata.las_version);
        default:
          return 0;
      }
    }).slice(0, props.maxDisplay);
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
      await LidarAPI.deleteFile(fileId);
      // Reload the file list
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  // Load files on component mount
  onMount(() => {
    loadFiles();
  });

  return (
    <div>
      {/* Search and Filter Controls */}
      <div style={{
        background: 'white',
        padding: '20px',
        'border-radius': '8px',
        'box-shadow': '0 2px 8px rgba(0,0,0,0.1)',
        'margin-bottom': '20px'
      }}>
        <div style={{ display: 'flex', gap: '15px', 'align-items': 'center', 'flex-wrap': 'wrap' }}>
          <div style={{ flex: '1', 'min-width': '200px' }}>
            <input
              type="text"
              placeholder="🔍 Search files, versions, formats..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                'border-radius': '6px',
                'font-size': '14px'
              }}
            />
          </div>
          
          <div>
            <label style={{ 'font-size': '14px', color: '#555', 'margin-right': '8px' }}>Sort by:</label>
            <select
              value={sortBy()}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '6px 10px',
                border: '1px solid #ddd',
                'border-radius': '4px',
                'font-size': '14px'
              }}
            >
              <option value="name">Filename</option>
              <option value="size">File Size</option>
              <option value="points">Point Count</option>
              <option value="version">LAS Version</option>
            </select>
          </div>
          
          <button
            onClick={loadFiles}
            style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              'border-radius': '6px',
              cursor: 'pointer',
              'font-size': '14px'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* File Grid */}
      <Show
        when={!isLoading() && !error() && filteredAndSortedFiles().length > 0}
        fallback={
          <div style={{
            background: 'white',
            padding: '40px',
            'border-radius': '8px',
            'text-align': 'center',
            'box-shadow': '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <Show when={isLoading()}>
              <div>
                <div style={{ 'font-size': '24px', 'margin-bottom': '10px' }}>⏳</div>
                <div>Loading file history...</div>
              </div>
            </Show>
            
            <Show when={error()}>
              <div style={{ color: '#d32f2f' }}>
                <div style={{ 'font-size': '24px', 'margin-bottom': '10px' }}>❌</div>
                <div>Error: {error()}</div>
                <button
                  onClick={loadFiles}
                  style={{
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    'border-radius': '6px',
                    cursor: 'pointer',
                    'margin-top': '10px'
                  }}
                >
                  Try Again
                </button>
              </div>
            </Show>
            
            <Show when={!isLoading() && !error() && filteredAndSortedFiles().length === 0}>
              <div>
                <div style={{ 'font-size': '48px', 'margin-bottom': '15px', opacity: '0.5' }}>📁</div>
                <h3>No Files Found</h3>
                <Show 
                  when={searchQuery().trim()}
                  fallback={<p>Upload your first LiDAR file to get started!</p>}
                >
                  <p>No files match your search criteria</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      'border-radius': '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Clear Search
                  </button>
                </Show>
              </div>
            </Show>
          </div>
        }
      >
        {/* Files Grid */}
        <div style={{
          display: 'grid',
          'grid-template-columns': 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          <For each={filteredAndSortedFiles()}>
            {(file) => (
              <FileCard 
                file={file} 
                onDelete={handleDeleteFile}
              />
            )}
          </For>
        </div>
        
        {/* Summary */}
        <div style={{
          'margin-top': '20px',
          'text-align': 'center',
          color: 'rgba(255,255,255,0.8)',
          'font-size': '14px'
        }}>
          Showing {filteredAndSortedFiles().length} of {files().length} files
          {searchQuery().trim() && (
            <span> • Filtered by "{searchQuery()}"</span>
          )}
        </div>
      </Show>
    </div>
  );
}