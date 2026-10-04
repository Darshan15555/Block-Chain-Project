import React from 'react';

export default function BlockFundLogo({ size = 36, showText = false, textLight = false, subText = 'Transparent Infrastructure Funding' }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      {/* 3D Isometric Geometric Cube Logo */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.35))', flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="cubeTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="cubeLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="cubeRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="cubeInner" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
        </defs>

        {/* Outer Isometric Hexagon/Cube Outline with Isometric Faces */}
        {/* Top Face */}
        <polygon
          points="24,4 42,14 24,24 6,14"
          fill="url(#cubeTop)"
        />
        {/* Left Face */}
        <polygon
          points="6,14 24,24 24,44 6,34"
          fill="url(#cubeLeft)"
        />
        {/* Right Face */}
        <polygon
          points="24,24 42,14 42,34 24,44"
          fill="url(#cubeRight)"
        />

        {/* Inner Isometric Hexagonal Hollow Cutout (Stylized Blockchain Block) */}
        <polygon
          points="24,11 35,17 24,23 13,17"
          fill="#ffffff"
          fillOpacity="0.85"
        />
        <polygon
          points="13,17 24,23 24,35 13,29"
          fill="#1e293b"
          fillOpacity="0.9"
        />
        <polygon
          points="24,23 35,17 35,29 24,35"
          fill="#3b82f6"
          fillOpacity="0.95"
        />

        {/* Center core glowing dot */}
        <circle cx="24" cy="23" r="2.5" fill="#38bdf8" />
      </svg>

      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span
            style={{
              fontSize: size * 0.58,
              fontWeight: 800,
              fontFamily: 'var(--font-display, inherit)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: textLight ? '#ffffff' : '#0f172a',
            }}
          >
            Block<span style={{ color: '#38bdf8' }}>Fund</span>
          </span>
          {subText && (
            <span
              style={{
                fontSize: Math.max(10, size * 0.26),
                fontWeight: 500,
                letterSpacing: '0.02em',
                lineHeight: 1.2,
                marginTop: 2,
                color: textLight ? 'rgba(255, 255, 255, 0.72)' : '#64748b',
              }}
            >
              {subText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
