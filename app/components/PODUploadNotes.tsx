'use client';

import React, { useState } from 'react';

type UploadTarget =
  | 'standard'
  | 'redbubble'
  | 'printful'
  | 'teepublic'
  | 'spring'
  | 'zazzle'
  | 'gelato'
  | 'custom'
  | 'presets';

export type PODUploadNotesProps = {
  file: File | null;
  img: HTMLImageElement | null;
  imgW: number;
  imgH: number;
  uploadTarget: UploadTarget;
  targetCanvasW: number;
  targetCanvasH: number;
  hasTransparency: boolean | null;
  practicalPrintDpi: number;
  autoFixApplied: boolean;
  downloadMessage: string;
  displayScore: number;
  scanStatus: string;
};

function getExportTargetLabel(
  uploadTarget: UploadTarget,
  targetCanvasW: number,
  targetCanvasH: number,
): string {
  switch (uploadTarget) {
    case 'standard':
      return `Standard Apparel — ${targetCanvasW} × ${targetCanvasH}`;
    case 'redbubble':
      return `Redbubble — ${targetCanvasW} × ${targetCanvasH}`;
    case 'printful':
      return `Printful — ${targetCanvasW} × ${targetCanvasH}`;
    case 'teepublic':
      return `TeePublic — ${targetCanvasW} × ${targetCanvasH}`;
    case 'custom':
      return `Custom Size — ${targetCanvasW} × ${targetCanvasH}`;
    case 'presets':
      return `Product Preset — ${targetCanvasW} × ${targetCanvasH}`;
    default:
      return `${targetCanvasW} × ${targetCanvasH}`;
  }
}

function formatFileType(file: File | null): string {
  if (!file) return '—';
  const ext = file.name.split('.').pop()?.toUpperCase();
  if (ext) return ext;
  if (file.type.includes('png')) return 'PNG';
  if (file.type.includes('jpeg') || file.type.includes('jpg')) return 'JPEG';
  if (file.type.includes('webp')) return 'WebP';
  return file.type || 'Unknown';
}

function buildUploadNotes(props: PODUploadNotesProps): string {
  const {
    file,
    imgW,
    imgH,
    uploadTarget,
    targetCanvasW,
    targetCanvasH,
    hasTransparency,
    practicalPrintDpi,
    autoFixApplied,
    downloadMessage,
    displayScore,
    scanStatus,
  } = props;

  const lines = [
    'POD Design Checker — Upload Notes',
    '',
    `File name: ${file?.name ?? '—'}`,
    `Original image size: ${imgW} × ${imgH}`,
    `Selected export target: ${getExportTargetLabel(uploadTarget, targetCanvasW, targetCanvasH)}`,
    `File type: ${formatFileType(file)}`,
    `Transparency: ${hasTransparency === null ? 'Unknown' : hasTransparency ? 'Yes' : 'No'}`,
    `Practical DPI estimate: ${Math.round(practicalPrintDpi)}`,
    `Auto Fix applied: ${autoFixApplied ? 'Yes' : 'No'}`,
    `Print readiness score: ${displayScore}%`,
    `Scan status: ${scanStatus}`,
    downloadMessage ? `Download status: ${downloadMessage}` : 'Download status: Not downloaded yet',
    '',
    'Reminder: Review the exported PNG before uploading. Platform requirements can vary by product.',
  ];

  return lines.join('\n');
}

const compactButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 10,
  fontSize: 11,
  fontWeight: 800,
  cursor: 'pointer',
};

export default function PODUploadNotes(props: PODUploadNotesProps) {
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const handleGenerate = () => {
    if (!props.img) {
      setMessage('Upload a design before generating upload notes.');
      return;
    }
    setMessage('');
    setNotes(buildUploadNotes(props));
  };

  const handleCopy = async () => {
    if (!notes) {
      setMessage('Generate notes before copying.');
      return;
    }
    try {
      await navigator.clipboard.writeText(notes);
      setMessage('Upload notes copied.');
    } catch {
      setMessage('Could not copy notes. Select the text and copy manually.');
    }
  };

  const handleDownloadTxt = () => {
    if (!notes) {
      setMessage('Generate notes before downloading.');
      return;
    }
    const blob = new Blob([notes], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pod-upload-notes.txt';
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Upload notes downloaded. Check your Downloads folder.');
  };

  const messageColor =
    message.includes('copied') || message.includes('downloaded')
      ? '#86efac'
      : '#fbbf24';

  return (
    <div
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 14,
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(147, 197, 253, 0.25)',
        display: 'grid',
        gap: 6,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>Upload Notes</div>
      <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.4 }}>
        Generate copy-ready notes for this checked design.
      </div>
      {message && (
        <div style={{ fontSize: 11, color: messageColor, lineHeight: 1.35 }}>{message}</div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleGenerate}
          style={{
            ...compactButtonStyle,
            background: 'rgba(37, 99, 235, 0.35)',
            color: '#ffffff',
            border: '1px solid rgba(147, 197, 253, 0.45)',
          }}
        >
          Generate Notes
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          style={{
            ...compactButtonStyle,
            background: notes ? 'rgba(37, 99, 235, 0.22)' : 'rgba(51, 65, 85, 0.5)',
            color: notes ? '#bfdbfe' : '#94a3b8',
            border: '1px solid rgba(147, 197, 253, 0.35)',
            cursor: notes ? 'pointer' : 'pointer',
          }}
        >
          Copy
        </button>
        <button
          type="button"
          onClick={handleDownloadTxt}
          style={{
            ...compactButtonStyle,
            background: notes ? 'rgba(37, 99, 235, 0.22)' : 'rgba(51, 65, 85, 0.5)',
            color: notes ? '#bfdbfe' : '#94a3b8',
            border: '1px solid rgba(147, 197, 253, 0.35)',
            cursor: 'pointer',
          }}
        >
          Download .txt
        </button>
      </div>
      <textarea
        readOnly
        value={notes}
        placeholder="Click Generate Notes to fill this area."
        rows={5}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: 8,
          borderRadius: 10,
          background: 'rgba(2, 6, 23, 0.55)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          color: '#e2e8f0',
          fontSize: 11,
          lineHeight: 1.4,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          resize: 'vertical',
          minHeight: 88,
          maxHeight: 180,
          overflowY: 'auto',
        }}
      />
    </div>
  );
}
