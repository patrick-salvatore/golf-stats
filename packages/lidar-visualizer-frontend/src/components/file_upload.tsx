// File upload component with drag and drop

import { createSignal } from 'solid-js';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  acceptedTypes?: string;
}

export default function FileUpload(props: FileUploadProps) {
  const [isDragOver, setIsDragOver] = createSignal(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.las') && !fileName.endsWith('.laz')) {
      alert('Please select a .las or .laz file');
      return;
    }

    props.onFileSelect(file);
  };

  return (
    <div
      style={{
        border: `2px dashed ${isDragOver() ? '#007bff' : '#ccc'}`,
        'border-radius': '8px',
        padding: '40px 20px',
        'text-align': 'center',
        background: isDragOver() ? '#f8f9ff' : '#fafafa',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        const input = document.getElementById('file-input') as HTMLInputElement;
        input?.click();
      }}
    >
      <input
        id="file-input"
        type="file"
        accept={props.acceptedTypes || '.las,.laz'}
        onChange={handleFileInput}
        style={{ display: 'none' }}
        disabled={props.isUploading}
      />

      {props.isUploading ? (
        <div>
          <div style={{ 'font-size': '18px', color: '#666', 'margin-bottom': '10px' }}>
            ⏳ Uploading...
          </div>
          <div style={{ color: '#999' }}>
            Processing your LiDAR file
          </div>
        </div>
      ) : (
        <div>
          <div style={{ 'font-size': '24px', color: '#666', 'margin-bottom': '10px' }}>
            📁 Drop LiDAR file here
          </div>
          <div style={{ color: '#999', 'margin-bottom': '15px' }}>
            or click to browse
          </div>
          <div style={{ 
            color: '#666', 
            'font-size': '14px',
            background: 'white',
            padding: '8px 16px',
            'border-radius': '20px',
            display: 'inline-block',
            border: '1px solid #ddd'
          }}>
            Supports .las and .laz files
          </div>
        </div>
      )}
    </div>
  );
}