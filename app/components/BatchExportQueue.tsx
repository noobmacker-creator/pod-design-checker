'use client';

import React, { useRef, useState } from 'react';

type BatchExportItem = {
  id: string;
  file: File;
  fileName: string;
  width: number | null;
  height: number | null;
  fileType: string;
  selected: boolean;
  loadError: boolean;
};

export type BatchExportSizeOption = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export const BATCH_EXPORT_SIZE_OPTIONS: BatchExportSizeOption[] = [
  { id: 'standard', label: 'Standard 4200 × 4800', width: 4200, height: 4800 },
  { id: 'square', label: 'Square 4500 × 4500', width: 4500, height: 4500 },
  { id: 'sticker', label: 'Sticker 3000 × 3000', width: 3000, height: 3000 },
  { id: 'poster', label: 'Poster 5400 × 7200', width: 5400, height: 7200 },
  { id: 'mug', label: 'Mug 2700 × 1200', width: 2700, height: 1200 },
  { id: 'tote-bag', label: 'Tote Bag 4500 × 5400', width: 4500, height: 5400 },
  { id: 'phone-case', label: 'Phone Case 2400 × 3600', width: 2400, height: 3600 },
];

type BatchExportQueueProps = {
  onDownloadBatchZip: (
    files: File[],
    exportLabel: string,
    width: number,
    height: number,
    onProgress: (message: string) => void,
  ) => Promise<void>;
};

function getFileTypeLabel(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png' || file.type === 'image/png') return 'PNG';
  if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') return 'JPEG';
  return ext ? ext.toUpperCase() : 'Unknown';
}

async function loadBatchExportItem(file: File): Promise<Omit<BatchExportItem, 'id' | 'file' | 'selected'>> {
  const fileType = getFileTypeLabel(file);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        fileName: file.name,
        width: image.naturalWidth,
        height: image.naturalHeight,
        fileType,
        loadError: false,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        fileName: file.name,
        width: null,
        height: null,
        fileType,
        loadError: true,
      });
    };

    image.src = url;
  });
}

export default function BatchExportQueue({ onDownloadBatchZip }: BatchExportQueueProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BatchExportItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedSizeId, setSelectedSizeId] = useState(BATCH_EXPORT_SIZE_OPTIONS[0].id);
  const [message, setMessage] = useState('');
  const [progressMessage, setProgressMessage] = useState('');

  const selectedSize =
    BATCH_EXPORT_SIZE_OPTIONS.find((option) => option.id === selectedSizeId) ??
    BATCH_EXPORT_SIZE_OPTIONS[0];

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setBusy(true);
    setMessage('');
    const selectedFiles = Array.from(fileList);
    const analyzed = await Promise.all(
      selectedFiles.map(async (file) => {
        const result = await loadBatchExportItem(file);
        return {
          id: `${file.name}-${file.size}-${file.lastModified}`,
          file,
          selected: true,
          ...result,
        };
      }),
    );

    setItems(analyzed);
    setBusy(false);
    e.target.value = '';
  }

  function toggleItem(id: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    );
  }

  async function handleDownloadClick() {
    if (items.length === 0) {
      setMessage('Add designs before building a batch export.');
      return;
    }

    const selectedFiles = items.filter((item) => item.selected && !item.loadError).map((item) => item.file);
    if (selectedFiles.length === 0) {
      setMessage('Select at least one design.');
      return;
    }

    setMessage('');
    setProgressMessage('');
    setBusy(true);
    try {
      await onDownloadBatchZip(
        selectedFiles,
        selectedSize.label,
        selectedSize.width,
        selectedSize.height,
        setProgressMessage,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="batch-export-queue"
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
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 800 }}>Batch Export Queue</div>
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
        Add multiple designs, choose an export size, then download one ZIP with ready PNG files.
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
        {busy && items.length === 0 ? 'Loading files...' : 'Add PNG / JPG designs'}
      </button>
      <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800 }}>Export size:</div>
      <select
        value={selectedSizeId}
        onChange={(e) => setSelectedSizeId(e.target.value)}
        disabled={busy}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      >
        {BATCH_EXPORT_SIZE_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {items.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {items.map((item) => (
            <label
              key={item.id}
              style={{
                display: 'grid',
                gap: 4,
                padding: 8,
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.22)',
                cursor: item.loadError ? 'not-allowed' : 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={item.selected}
                  disabled={item.loadError || busy}
                  onChange={() => toggleItem(item.id)}
                  style={{ width: 14, height: 14, flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#e2e8f0',
                    wordBreak: 'break-all',
                  }}
                >
                  {item.fileName}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45, paddingLeft: 22 }}>
                {item.loadError
                  ? 'Could not load image — skipped from export'
                  : `${item.width} × ${item.height} px · ${item.fileType}`}
              </div>
            </label>
          ))}
        </div>
      )}
      {message && (
        <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.4 }}>{message}</div>
      )}
      {progressMessage && (
        <div
          style={{
            fontSize: 12,
            color: progressMessage.includes('ready') ? '#86efac' : '#cbd5e1',
            lineHeight: 1.4,
            fontWeight: progressMessage.includes('ready') ? 700 : 400,
          }}
        >
          {progressMessage}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          void handleDownloadClick();
        }}
        disabled={busy}
        style={{
          padding: '10px 14px',
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 800,
          background: '#2563eb',
          color: '#ffffff',
          border: 'none',
          cursor: busy ? 'not-allowed' : 'pointer',
          width: '100%',
          opacity: busy ? 0.65 : 1,
        }}
      >
        {busy && items.length > 0 ? 'Building batch export...' : 'Download Batch ZIP'}
      </button>
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
        ZIP file name: pod-checker-batch-export.zip
      </div>
    </div>
  );
}
