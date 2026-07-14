'use client';

import React from 'react';

const sectionStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(147, 197, 253, 0.25)',
  display: 'grid',
  gap: 10,
};

const noteStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  color: '#cbd5e1',
};

export default function ListingImageGuidePanel() {
  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, boxSizing: 'border-box' }}>
      <div style={sectionStyle}>
        <div style={{ fontWeight: 900, fontSize: 14, color: '#f8fafc' }}>LISTING IMAGE GUIDE</div>

        <div style={noteStyle}>Use clear images that still read as small thumbnails.</div>
        <div style={noteStyle}>Keep the product centred.</div>
        <div style={noteStyle}>Avoid important details too close to the edge.</div>
        <div style={noteStyle}>Check square and mobile-style crops.</div>
        <div style={noteStyle}>
          Use Crop View to see what may be cut off. Use Fit View to see the full image.
        </div>
        <div style={noteStyle}>This checker is a visual guide, not a marketplace guarantee.</div>

        <div
          style={{
            marginTop: 4,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(37, 99, 235, 0.10)',
            border: '1px solid rgba(147, 197, 253, 0.22)',
            fontSize: 11,
            lineHeight: 1.45,
            color: '#94a3b8',
          }}
        >
          This tool does not change your listing image or print artwork.
        </div>
      </div>
    </div>
  );
}
