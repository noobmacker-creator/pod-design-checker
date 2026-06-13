'use client';

import React, { useState } from 'react';

type UploadTarget = 'standard' | 'redbubble' | 'printful' | 'teepublic' | 'custom' | 'presets';

type PODUploadNotesProps = {
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
    downloadMessage ? `Download status: ${downloadMessage}` : 'Download status: Not downloaded yet',
    '',
    'Reminder: Review the exported PNG before uploading. Platform requirements can vary by product.',
  ];

  return lines.join('\n');
}

export default function PODUploadNotes(props: PODUploadNotesProps) {
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    if (!props.img) {
      setMessage('Upload a design before generating upload notes.');
      setNotes('');
      return;
    }
    setMessage('');
    setCopied(false);
    setNotes(buildUploadNotes(props));
  };

  const handleCopy = async () => {
    if (!notes) {
      setMessage('Generate upload notes first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
      setMessage('Notes copied to clipboard.');
    } catch {
      setMessage('Could not copy notes. Select the text and copy manually.');
    }
  };

  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        borderRadius: 14,
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(147, 197, 253, 0.25)',
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 800 }}>POD Upload Notes</div>
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
        Generate a simple copy-ready summary of the checked design and export settings.
      </div>
      {message && (
        <div
          style={{
            fontSize: 12,
            color: message.includes('copied') ? '#86efac' : '#fbbf24',
            lineHeight: 1.4,
          }}
        >
          {message}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={handleGenerate}
          style={{
            padding: '7px 12px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 800,
            background: 'rgba(37, 99, 235, 0.35)',
            color: '#ffffff',
            border: '1px solid rgba(147, 197, 253, 0.45)',
            cursor: 'pointer',
          }}
        >
          Generate Upload Notes
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={!notes}
          style={{
            padding: '7px 12px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 800,
            background: notes ? 'rgba(37, 99, 235, 0.22)' : 'rgba(51, 65, 85, 0.5)',
            color: notes ? '#bfdbfe' : '#94a3b8',
            border: '1px solid rgba(147, 197, 253, 0.35)',
            cursor: notes ? 'pointer' : 'not-allowed',
          }}
        >
          {copied ? 'Copied!' : 'Copy Notes'}
        </button>
      </div>
      {notes && (
        <textarea
          readOnly
          value={notes}
          rows={12}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 10,
            borderRadius: 10,
            background: 'rgba(2, 6, 23, 0.55)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            color: '#e2e8f0',
            fontSize: 11,
            lineHeight: 1.45,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            resize: 'vertical',
          }}
        />
      )}
    </div>
  );
}
