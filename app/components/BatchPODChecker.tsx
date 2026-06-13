'use client';

import React, { useRef, useState } from 'react';

type BatchItem = {
  id: string;
  file: File;
  fileName: string;
  width: number | null;
  height: number | null;
  fileType: string;
  fileSize: number;
  hasTransparency: boolean | null;
  loadError: boolean;
  quickStatus: 'Ready' | 'Review';
};

type BatchPODCheckerProps = {
  onOpenInChecker: (file: File) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png' || file.type === 'image/png') return 'PNG';
  if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') return 'JPEG';
  return ext ? ext.toUpperCase() : 'Unknown';
}

async function analyzeBatchFile(file: File): Promise<Omit<BatchItem, 'id' | 'file'>> {
  const fileType = getFileTypeLabel(file);
  const isPng = fileType === 'PNG';

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      let hasTransparency = false;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            hasTransparency = true;
            break;
          }
        }
      }

      URL.revokeObjectURL(url);

      const verySmall = image.naturalWidth < 2000 || image.naturalHeight < 2000;
      const quickStatus: 'Ready' | 'Review' =
        isPng && hasTransparency && !verySmall ? 'Ready' : 'Review';

      resolve({
        fileName: file.name,
        width: image.naturalWidth,
        height: image.naturalHeight,
        fileType,
        fileSize: file.size,
        hasTransparency,
        loadError: false,
        quickStatus,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        fileName: file.name,
        width: null,
        height: null,
        fileType,
        fileSize: file.size,
        hasTransparency: null,
        loadError: true,
        quickStatus: 'Review',
      });
    };

    image.src = url;
  });
}

export default function BatchPODChecker({ onOpenInChecker }: BatchPODCheckerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setBusy(true);
    const selectedFiles = Array.from(fileList);
    const analyzed = await Promise.all(
      selectedFiles.map(async (file) => {
        const result = await analyzeBatchFile(file);
        return {
          id: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          ...result,
        };
      }),
    );

    setItems(analyzed);
    setBusy(false);
    e.target.value = '';
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function clearAll() {
    setItems([]);
  }

  const removeButtonStyle: React.CSSProperties = {
    padding: '7px 12px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    background: 'rgba(148, 163, 184, 0.12)',
    color: '#cbd5e1',
    border: '1px solid rgba(148, 163, 184, 0.28)',
    cursor: 'pointer',
    width: 'fit-content',
  };

  return (
    <div
      id="batch-pod-checker"
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 14,
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(147, 197, 253, 0.25)',
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 800 }}>Batch POD Checker</div>
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
        Quickly scan multiple POD designs and open any file in the main checker.
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        multiple
        onChange={(e) => {
          void handleFilesSelected(e);
        }}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          fontSize: 12,
          fontWeight: 800,
          background: 'rgba(37, 99, 235, 0.22)',
          color: '#bfdbfe',
          border: '1px solid rgba(147, 197, 253, 0.45)',
          cursor: busy ? 'not-allowed' : 'pointer',
          width: 'fit-content',
          opacity: busy ? 0.65 : 1,
        }}
      >
        {busy ? 'Scanning files...' : 'Choose PNG / JPG files'}
      </button>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
          No batch files added yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" onClick={clearAll} style={removeButtonStyle}>
              Clear All
            </button>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: 10,
                borderRadius: 12,
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.22)',
                display: 'grid',
                gap: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#e2e8f0',
                    wordBreak: 'break-all',
                  }}
                >
                  {item.fileName}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: item.quickStatus === 'Ready' ? '#86efac' : '#fbbf24',
                    background:
                      item.quickStatus === 'Ready'
                        ? 'rgba(22, 163, 74, 0.18)'
                        : 'rgba(250, 204, 21, 0.12)',
                    border:
                      item.quickStatus === 'Ready'
                        ? '1px solid rgba(134, 239, 172, 0.30)'
                        : '1px solid rgba(250, 204, 21, 0.25)',
                    borderRadius: 999,
                    padding: '3px 8px',
                  }}
                >
                  {item.quickStatus}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                {item.loadError
                  ? 'Could not load image'
                  : `${item.width} × ${item.height} px`}
                {' · '}
                {item.fileType}
                {' · '}
                {formatFileSize(item.fileSize)}
                {' · '}
                Transparency:{' '}
                {item.hasTransparency === null
                  ? 'unknown'
                  : item.hasTransparency
                    ? 'yes'
                    : 'no'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => onOpenInChecker(item.file)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 800,
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    width: 'fit-content',
                  }}
                >
                  Open in Checker
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  style={removeButtonStyle}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
