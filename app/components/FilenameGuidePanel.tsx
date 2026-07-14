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

export default function FilenameGuidePanel() {
  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, boxSizing: 'border-box' }}>
      <div style={sectionStyle}>
        <div style={{ fontWeight: 900, fontSize: 14, color: '#f8fafc' }}>FILENAME GUIDE</div>

        <div style={noteStyle}>Clean filenames are easier to organise.</div>
        <div style={noteStyle}>Use simple words separated by hyphens.</div>
        <div style={noteStyle}>Avoid very long random download names.</div>
        <div style={noteStyle}>Keep useful words such as colour, product or size.</div>
        <div style={noteStyle}>This tool renames copies only. Your original files are not changed.</div>

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
          Downloads are ZIP copies with cleaned names. Image pixels stay unchanged.
        </div>
      </div>
    </div>
  );
}
