'use client';

import React, { useRef } from 'react';
import type { ColorCheckEntry } from '../lib/colorCheckUtils';
import { drawCheckerboard, drawDesignCentredInRect } from '../lib/colorCheckUtils';

type ColorCheckWorkspaceProps = {
  file: File | null;
  img: HTMLImageElement | null;
  activeColours: ColorCheckEntry[];
  showCheckerboard: boolean;
  onAddDesign: (file: File) => void;
  onClear: () => void;
  uploadInputKey: number;
};

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'grid',
  gridTemplateRows: '1fr auto',
  minHeight: 180,
};

function PreviewCard({
  entry,
  img,
  isCheckerboard,
}: {
  entry: ColorCheckEntry;
  img: HTMLImageElement;
  isCheckerboard?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (isCheckerboard) {
      drawCheckerboard(ctx, 0, 0, w, h, 10);
    } else {
      ctx.fillStyle = entry.hex;
      ctx.fillRect(0, 0, w, h);
    }

    drawDesignCentredInRect(ctx, img, 0, 0, w, h);
  }, [entry.hex, img, isCheckerboard]);

  return (
    <div style={cardStyle}>
      <canvas
        ref={canvasRef}
        width={280}
        height={200}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-label={`Design preview on ${entry.label}`}
      />
      <div
        style={{
          padding: '8px 10px',
          fontSize: 12,
          fontWeight: 700,
          color: '#e2e8f0',
          textAlign: 'center',
          background: 'rgba(2, 6, 23, 0.65)',
        }}
      >
        {entry.label}
      </div>
    </div>
  );
}

export default function ColorCheckWorkspace({
  file,
  img,
  activeColours,
  showCheckerboard,
  onAddDesign,
  onClear,
  uploadInputKey,
}: ColorCheckWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) onAddDesign(selected);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onAddDesign(dropped);
  };

  if (!img || !file) {
    return (
      <div
        style={{
          height: '100%',
          minHeight: 0,
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          gap: 12,
          padding: 12,
          boxSizing: 'border-box',
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#f8fafc', marginBottom: 4 }}>
            COLOR CHECK
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.45 }}>
            See how your design looks on light, dark and custom colours.
          </div>
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          style={{
            border: '2px dashed rgba(56, 189, 248, 0.45)',
            borderRadius: 16,
            background: 'rgba(8, 47, 73, 0.25)',
            display: 'grid',
            placeItems: 'center',
            alignContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, color: '#bae6fd' }}>Drag a design here</div>
          <input
            ref={fileInputRef}
            key={uploadInputKey}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Add Design
          </button>
          <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45 }}>
            PNG, JPG or WEBP
          </div>
          <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.4, maxWidth: 360 }}>
            Colour previews are screen references only. Printed colours may vary.
          </div>
        </div>
      </div>
    );
  }

  const checkerEntry: ColorCheckEntry = {
    id: 'checkerboard',
    label: 'Transparency',
    hex: 'checkerboard',
  };

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr',
        gap: 10,
        padding: 12,
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#f8fafc', marginBottom: 4 }}>
            COLOR CHECK
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.4 }}>
            {file.name} · {img.naturalWidth} × {img.naturalHeight}px
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            key={uploadInputKey}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Replace Design
          </button>
          <button type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>

      <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.35 }}>
        Colour previews are screen references only. Printed colours may vary.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
          alignContent: 'start',
        }}
      >
        {activeColours.map((entry) => (
          <PreviewCard key={entry.id} entry={entry} img={img} />
        ))}
        {showCheckerboard ? (
          <PreviewCard entry={checkerEntry} img={img} isCheckerboard />
        ) : null}
      </div>
    </div>
  );
}
