'use client';

import React from 'react';

type DesignPreviewPanelProps = {
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  imgW: number;
  imgH: number;
  previewSize: number;
  inspectZoom: number;
  practicalPrintDpi: number;
  previewCanvasW: number;
  previewCanvasH: number;
  totalScale: number;
  setPreviewSize: React.Dispatch<React.SetStateAction<number>>;
  setInspectZoom: React.Dispatch<React.SetStateAction<number>>;
  setActionMessage: React.Dispatch<React.SetStateAction<string>>;
};

export default function DesignPreviewPanel({
  previewCanvasRef,
  imgW,
  imgH,
  previewSize,
  inspectZoom,
  practicalPrintDpi,
  previewCanvasW,
  previewCanvasH,
  totalScale,
  setPreviewSize,
  setInspectZoom,
  setActionMessage,
}: DesignPreviewPanelProps) {
  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 20,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: '0 25px 70px rgba(0,0,0,0.35)',
        minWidth: 0,
        height: 'fit-content',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Design Preview</h2>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#bae6fd' }}>Preview Size</span>
          <button onClick={() => { setPreviewSize(0.1); setActionMessage('Preview Size set to 10%.'); }}>10%</button>
          <button onClick={() => { setPreviewSize(0.25); setActionMessage('Preview Size set to 25%.'); }}>25%</button>
          <button onClick={() => { setPreviewSize(0.5); setActionMessage('Preview Size set to 50%.'); }}>50%</button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#bae6fd' }}>Detail Zoom</span>
          {[1, 2, 4, 8].map((z) => (
            <button
              key={z}
              onClick={() => {
                setInspectZoom(z);
                setActionMessage(`Inspect Zoom set to ${z * 100}%.`);
              }}
            >
              {z * 100}%
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <div style={{ background: 'rgba(15,23,42,0.85)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          Canvas: <strong>{imgW || '-'} × {imgH || '-'}</strong>
        </div>

        <div style={{ background: 'rgba(15,23,42,0.85)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          Preview Size: <strong>{Math.round(previewSize * 100)}%</strong>
        </div>

        <div style={{ background: 'rgba(15,23,42,0.85)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          Inspect Zoom: <strong>{inspectZoom * 100}%</strong>
        </div>

        <div style={{ background: 'rgba(15,23,42,0.85)', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          Practical DPI: <strong>{practicalPrintDpi || '-'}</strong>
        </div>
      </div>

      <div
        style={{
          width: '100%',
          height: '100vh',
          overflow: 'auto',
          borderRadius: 18,
          border: '2px solid #38bdf8',
          boxShadow: '0 0 0 1px rgba(56,189,248,0.25), inset 0 0 30px rgba(8,47,73,0.25)',
          background: '#020617',
          padding: 12,
          minWidth: 0,
        }}
      >
        <div
  style={{
    width: 'fit-content',
    minWidth: '100%',
    minHeight: '100%',
    paddingBottom: 12,
  }}
>
  <canvas
    ref={previewCanvasRef}
    style={{
      display: 'block',
      width: `${previewCanvasW * totalScale}px`,
      height: `${previewCanvasH * totalScale}px`,
      boxShadow: '0 12px 50px rgba(0,0,0,0.55)',
      borderRadius: 12,
    }}
  />
</div>
      </div>
    </div>
  );
}