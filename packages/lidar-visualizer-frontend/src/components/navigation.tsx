// Navigation component for LiDAR Visualizer

import { A, useLocation } from '@solidjs/router';

export default function Navigation() {
  const location = useLocation();
  
  const navStyle = {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'space-between',
    padding: '15px 30px',
    background: 'rgba(255, 255, 255, 0.95)',
    'backdrop-filter': 'blur(10px)',
    'box-shadow': '0 2px 10px rgba(0,0,0,0.1)',
    'border-bottom': '1px solid rgba(255,255,255,0.2)',
    position: 'sticky' as const,
    top: '0',
    'z-index': '1000'
  };

  const logoStyle = {
    'font-size': '1.5rem',
    'font-weight': 'bold',
    color: '#333',
    'text-decoration': 'none'
  };

  const navLinksStyle = {
    display: 'flex',
    gap: '25px',
    'align-items': 'center'
  };

  const linkStyle = (isActive: boolean) => ({
    'text-decoration': 'none',
    color: isActive ? '#667eea' : '#666',
    'font-weight': isActive ? 'bold' : 'normal',
    padding: '8px 16px',
    'border-radius': '6px',
    background: isActive ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
    transition: 'all 0.2s ease'
  });

  const statusStyle = {
    'font-size': '0.8rem',
    color: '#999',
    'font-family': 'monospace'
  };

  return (
    <nav style={navStyle}>
      <A href="/" style={logoStyle}>
        📊 LiDAR Visualizer
      </A>
      
      <div style={navLinksStyle}>
        <A 
          href="/" 
          style={linkStyle(location.pathname === '/')}
          end
        >
          🏠 Home
        </A>
        
        <A 
          href="/upload" 
          style={linkStyle(location.pathname === '/upload')}
        >
          📁 Upload
        </A>
        
        <div style={statusStyle}>
          solid-three + router
        </div>
      </div>
    </nav>
  );
}