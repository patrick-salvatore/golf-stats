// Visualization controls component

import { createSignal } from 'solid-js';

interface ControlsProps {
  onColorSchemeChange: (scheme: 'height' | 'intensity' | 'original') => void;
  onMaxPointsChange: (maxPoints: number) => void;
  onDownsampleChange: (downsample: number) => void;
  colorScheme: string;
  maxPoints: number;
  downsample: number;
  hasIntensity: boolean;
  hasColors: boolean;
}

export default function Controls(props: ControlsProps) {
  return (
    <div style={{
      background: 'white',
      padding: '20px',
      'border-radius': '8px',
      'box-shadow': '0 2px 8px rgba(0,0,0,0.1)',
      'margin-bottom': '20px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Visualization Controls</h3>
      
      {/* Color Scheme */}
      <div style={{ 'margin-bottom': '15px' }}>
        <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold', color: '#555' }}>
          Color Scheme:
        </label>
        <select
          value={props.colorScheme}
          onChange={(e) => props.onColorSchemeChange(e.target.value as any)}
          style={{
            padding: '8px 12px',
            'border-radius': '4px',
            border: '1px solid #ddd',
            'font-size': '14px',
            width: '200px'
          }}
        >
          <option value="height">Height-based Colors</option>
          {props.hasIntensity && <option value="intensity">Intensity Values</option>}
          {props.hasColors && <option value="original">Original Colors</option>}
        </select>
      </div>

      {/* Max Points */}
      <div style={{ 'margin-bottom': '15px' }}>
        <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold', color: '#555' }}>
          Max Points: {props.maxPoints.toLocaleString()}
        </label>
        <input
          type="range"
          min="1000"
          max="200000"
          step="5000"
          value={props.maxPoints}
          onChange={(e) => props.onMaxPointsChange(parseInt(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ 
          display: 'flex', 
          'justify-content': 'space-between', 
          'font-size': '12px', 
          color: '#999',
          'margin-top': '4px'
        }}>
          <span>1K</span>
          <span>100K</span>
          <span>200K</span>
        </div>
      </div>

      {/* Downsample */}
      <div style={{ 'margin-bottom': '15px' }}>
        <label style={{ display: 'block', 'margin-bottom': '5px', 'font-weight': 'bold', color: '#555' }}>
          Downsample: {Math.round(props.downsample * 100)}%
        </label>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          value={props.downsample}
          onChange={(e) => props.onDownsampleChange(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ 
          display: 'flex', 
          'justify-content': 'space-between', 
          'font-size': '12px', 
          color: '#999',
          'margin-top': '4px'
        }}>
          <span>10%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
      
      <div style={{ 
        'font-size': '12px', 
        color: '#666',
        'padding-top': '10px',
        'border-top': '1px solid #eee'
      }}>
        💡 Tip: Reduce max points or downsample for better performance
      </div>
    </div>
  );
}