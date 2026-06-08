'use client';

import React, { useState } from 'react';

export type PreviewBackground = 'checker' | 'white' | 'black' | 'navy' | 'dark-grey' | 'red' | 'pink' | 'custom';

export const PREVIEW_BACKGROUND_COLORS: Record<Exclude<PreviewBackground, 'checker' | 'custom'>, string> = {
  white: '#ffffff',
  black: '#000000',
  navy: '#1e3a8a',
  'dark-grey': '#4b5563',
  red: '#dc2626',
  pink: '#f472b6',
};

function getPreviewBackgroundStyle(
  previewBg: PreviewBackground,
  customColor?: string,
): React.CSSProperties {
  if (previewBg === 'checker') {
    return {
      backgroundColor: '#1f1f1f',
      backgroundImage: `
        linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
        linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
        linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
      `,
      backgroundSize: '36px 36px',
      backgroundPosition: '0 0, 0 18px, 18px -18px, -18px 0px',
    };
  }

  if (previewBg === 'custom') {
    return {
      backgroundColor: customColor || '#808080',
    };
  }

  return {
    backgroundColor: PREVIEW_BACKGROUND_COLORS[previewBg],
  };
}

const PREVIEW_BACKGROUND_OPTIONS: { id: PreviewBackground; label: string }[] = [
  { id: 'checker', label: 'Transparent' },
  { id: 'white', label: 'White' },
  { id: 'black', label: 'Black' },
  { id: 'navy', label: 'Navy' },
  { id: 'dark-grey', label: 'Dark Grey' },
  { id: 'red', label: 'Red' },
  { id: 'pink', label: 'Pink' },
];

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
  previewBackground: PreviewBackground;
  setPreviewBackground: React.Dispatch<React.SetStateAction<PreviewBackground>>;
  setPreviewSize: React.Dispatch<React.SetStateAction<number>>;
  setInspectZoom: React.Dispatch<React.SetStateAction<number>>;
  setActionMessage: React.Dispatch<React.SetStateAction<string>>;
  autoFixApplied?: boolean;
  autoFixPreviewMode?: 'fixed' | 'original';
  setAutoFixPreviewMode?: React.Dispatch<React.SetStateAction<'fixed' | 'original'>>;
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
  previewBackground,
  setPreviewBackground,
  setPreviewSize,
  setInspectZoom,
  setActionMessage,
  autoFixApplied = false,
  autoFixPreviewMode = 'fixed',
  setAutoFixPreviewMode,
}: DesignPreviewPanelProps) {
  const [customPreviewColor, setCustomPreviewColor] = useState('#808080');

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
      <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Design Preview</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#bae6fd', fontSize: 13 }}>Preview Size:</span>
            <button onClick={() => { setPreviewSize(0.1); setActionMessage('Preview Size set to 10%.'); }}>10%</button>
            <button onClick={() => { setPreviewSize(0.25); setActionMessage('Preview Size set to 25%.'); }}>25%</button>
            <button onClick={() => { setPreviewSize(0.5); setActionMessage('Preview Size set to 50%.'); }}>50%</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#bae6fd', fontSize: 13 }}>Detail Zoom:</span>
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

        {autoFixApplied && setAutoFixPreviewMode ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#bae6fd', fontSize: 13 }}>Preview:</span>
            <button
              onClick={() => {
                setAutoFixPreviewMode('original');
                setActionMessage('Showing original upload preview.');
              }}
              style={{
                fontWeight: autoFixPreviewMode === 'original' ? 800 : 600,
                outline: autoFixPreviewMode === 'original' ? '2px solid #38bdf8' : undefined,
              }}
            >
              Original
            </button>
            <button
              onClick={() => {
                setAutoFixPreviewMode('fixed');
                setActionMessage('Showing Auto Fix preview.');
              }}
              style={{
                fontWeight: autoFixPreviewMode === 'fixed' ? 800 : 600,
                outline: autoFixPreviewMode === 'fixed' ? '2px solid #38bdf8' : undefined,
              }}
            >
              Fixed
            </button>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#bae6fd', fontSize: 13 }}>Preview Background:</span>
          {PREVIEW_BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setPreviewBackground(option.id);
                setActionMessage(`Preview background set to ${option.label}.`);
              }}
              style={{
                fontWeight: previewBackground === option.id ? 800 : 600,
                outline: previewBackground === option.id ? '2px solid #38bdf8' : undefined,
              }}
            >
              {option.label}
            </button>
          ))}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: previewBackground === 'custom' ? 800 : 600,
              outline: previewBackground === 'custom' ? '2px solid #38bdf8' : undefined,
              borderRadius: 6,
              padding: '2px 4px',
              cursor: 'pointer',
            }}
          >
            <span style={{ color: '#bae6fd' }}>Custom colour</span>
            <input
              type="color"
              value={customPreviewColor}
              onChange={(e) => {
                setCustomPreviewColor(e.target.value);
                setPreviewBackground('custom');
                setActionMessage(`Preview background set to custom colour ${e.target.value}.`);
              }}
              style={{
                width: 28,
                height: 28,
                padding: 0,
                border: '1px solid rgba(148, 163, 184, 0.4)',
                borderRadius: 6,
                cursor: 'pointer',
                background: 'transparent',
              }}
            />
          </label>
        </div>

        <p
          style={{
            fontSize: 11,
            color: '#94a3b8',
            lineHeight: 1.35,
            marginTop: 4,
            marginBottom: 0,
          }}
        >
          Preview only — downloads stay transparent.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
            fontSize: 12,
            color: '#cbd5e1',
            background: 'rgba(15,23,42,0.85)',
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span>Canvas: <strong>{imgW || '-'} × {imgH || '-'}</strong></span>
          <span style={{ color: 'rgba(148,163,184,0.5)' }}>|</span>
          <span>Preview Size: <strong>{Math.round(previewSize * 100)}%</strong></span>
          <span style={{ color: 'rgba(148,163,184,0.5)' }}>|</span>
          <span>Inspect Zoom: <strong>{inspectZoom * 100}%</strong></span>
          <span style={{ color: 'rgba(148,163,184,0.5)' }}>|</span>
          <span>Practical DPI: <strong>{practicalPrintDpi || '-'}</strong></span>
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
  <div
    style={{
      ...getPreviewBackgroundStyle(previewBackground, customPreviewColor),
      width: `${previewCanvasW * totalScale}px`,
      height: `${previewCanvasH * totalScale}px`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 12px 50px rgba(0,0,0,0.55)',
    }}
  >
    <canvas
      ref={previewCanvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
      }}
    />
  </div>
</div>
      </div>
    </div>
  );
}