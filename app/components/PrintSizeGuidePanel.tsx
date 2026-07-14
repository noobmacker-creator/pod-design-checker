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

export default function PrintSizeGuidePanel() {
  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, boxSizing: 'border-box' }}>
      <div style={sectionStyle}>
        <div style={{ fontWeight: 900, fontSize: 14, color: '#f8fafc' }}>PRINT SIZE GUIDE</div>

        <div style={noteStyle}>
          <strong style={{ color: '#93c5fd' }}>300 PPI:</strong> sharp detail for smaller prints
        </div>
        <div style={noteStyle}>
          <strong style={{ color: '#93c5fd' }}>200 PPI:</strong> common for many product prints
        </div>
        <div style={noteStyle}>
          <strong style={{ color: '#93c5fd' }}>150 PPI:</strong> larger prints or simple artwork
        </div>

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
          This calculator does not resize your file.
          <br />
          Use Converter when you need to create a new PNG size.
        </div>

        <div style={{ fontSize: 11, lineHeight: 1.4, color: '#64748b' }}>
          Higher PPI usually gives sharper print detail. Exact results depend on the product, printer
          and artwork.
        </div>
      </div>
    </div>
  );
}
