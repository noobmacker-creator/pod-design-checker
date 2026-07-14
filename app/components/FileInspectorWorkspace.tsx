'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeTransparency,
  buildQuickNotes,
  detectPossibleSolidBackground,
  formatFileSizeLabel,
  getDpiMetadataInfo,
  getFileTypeLabel,
  getOrientation,
  simplifyAspectRatio,
  type TransparencyAnalysis,
} from '../lib/fileInspectorUtils';

type FileInspectorWorkspaceProps = {
  file: File | null;
  img: HTMLImageElement | null;
  dpiMetadata: number | null;
  onAddDesign: (file: File) => void;
  onClear: () => void;
  uploadInputKey: number;
};

const cardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: 'rgba(15, 23, 42, 0.55)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  display: 'grid',
  gap: 8,
};

const factRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px minmax(0, 1fr)',
  gap: 8,
  fontSize: 13,
  lineHeight: 1.45,
};

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={factRowStyle}>
      <div style={{ color: '#93c5fd', fontWeight: 700 }}>{label}</div>
      <div style={{ color: '#e2e8f0', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function readImageData(img: HTMLImageElement): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  try {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

export default function FileInspectorWorkspace({
  file,
  img,
  dpiMetadata,
  onAddDesign,
  onClear,
  uploadInputKey,
}: FileInspectorWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);

  useEffect(() => {
    if (!img) {
      setImageData(null);
      return;
    }
    setImageData(readImageData(img));
  }, [img]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) onAddDesign(selected);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onAddDesign(dropped);
  };

  const fileTypeLabel = file ? getFileTypeLabel(file) : '';
  const widthPx = img?.naturalWidth ?? 0;
  const heightPx = img?.naturalHeight ?? 0;

  const transparency = useMemo<TransparencyAnalysis>(() => {
    if (!file) {
      return {
        title: 'TRANSPARENCY',
        detail: 'Upload a file to inspect transparency.',
        notSupported: false,
        hasTransparentAreas: false,
        hasSemiTransparent: false,
        isFullyOpaque: false,
      };
    }
    return analyzeTransparency(imageData, file.type);
  }, [file, imageData]);

  const solidBackgroundHint = useMemo(
    () => detectPossibleSolidBackground(imageData, transparency),
    [imageData, transparency],
  );

  const dpiInfo = useMemo(() => getDpiMetadataInfo(dpiMetadata), [dpiMetadata]);

  const quickNotes = useMemo(
    () =>
      file
        ? buildQuickNotes({
            fileTypeLabel,
            widthPx,
            heightPx,
            transparency,
            solidBackgroundHint,
            dpiInfo,
          })
        : [],
    [file, fileTypeLabel, widthPx, heightPx, transparency, solidBackgroundHint, dpiInfo],
  );

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
            FILE INSPECTOR
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.45 }}>
            Check the basic facts about your design file.
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
          <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45 }}>PNG, JPG or WEBP</div>
          <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.4, maxWidth: 360 }}>
            This tool does not change your file.
          </div>
        </div>
      </div>
    );
  }

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
        overflow: 'auto',
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
            FILE INSPECTOR
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45, wordBreak: 'break-word' }}>
            {file.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Replace Design
          </button>
          <button type="button" onClick={onClear}>
            Clear
          </button>
          <input
            ref={fileInputRef}
            key={uploadInputKey}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <div
            style={{
              ...cardStyle,
              padding: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 180,
              background: 'repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%) 50% / 16px 16px',
            }}
          >
            <img
              src={img.src}
              alt={`Preview of ${file.name}`}
              style={{
                maxWidth: '100%',
                maxHeight: 220,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.35, textAlign: 'center' }}>
            Preview background only
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#e2e8f0' }}>FILE FACTS</div>
          <FactRow label="Filename" value={file.name} />
          <FactRow label="File type" value={fileTypeLabel} />
          <FactRow label="File size" value={formatFileSizeLabel(file.size)} />
          <FactRow label="Image size" value={`${widthPx} × ${heightPx} px`} />
          <FactRow label="Aspect ratio" value={simplifyAspectRatio(widthPx, heightPx)} />
          <FactRow label="Orientation" value={getOrientation(widthPx, heightPx)} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#e2e8f0' }}>TRANSPARENCY</div>
          <div style={{ color: '#93c5fd', fontWeight: 800, fontSize: 12, letterSpacing: '0.03em' }}>
            {transparency.title}
          </div>
          <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-line' }}>
            {transparency.detail}
          </div>
          {solidBackgroundHint ? (
            <div
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                background: 'rgba(250, 204, 21, 0.10)',
                border: '1px solid rgba(250, 204, 21, 0.25)',
                color: '#fde68a',
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              Possible solid background detected. This file may have a solid background instead of
              real transparency.
            </div>
          ) : null}
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#e2e8f0' }}>DPI METADATA</div>
          <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.45 }}>{dpiInfo.label}</div>
          <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45 }}>{dpiInfo.detail}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#e2e8f0' }}>QUICK NOTES</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            {quickNotes.map((note) => (
              <li key={note} style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.45 }}>
                {note}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
