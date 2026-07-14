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

export default function FileInfoGuidePanel() {
  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, boxSizing: 'border-box' }}>
      <div style={sectionStyle}>
        <div style={{ fontWeight: 900, fontSize: 14, color: '#f8fafc' }}>FILE INFO GUIDE</div>

        <div style={noteStyle}>PNG is best when you need transparency.</div>
        <div style={noteStyle}>JPG cannot have transparent backgrounds.</div>
        <div style={noteStyle}>Pixel width and height decide how large a file can print.</div>
        <div style={noteStyle}>DPI metadata can be missing or misleading.</div>
        <div style={noteStyle}>Use Single Design when you want a print-readiness check.</div>
        <div style={noteStyle}>Use Converter when you need to create a new PNG size.</div>

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
          This tool does not change your file.
        </div>
      </div>
    </div>
  );
}
