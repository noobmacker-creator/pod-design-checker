'use client';

import React, { useRef, useState } from 'react';
import {
  BATCH_MULTI_EXPORT_SIZE_OPTIONS,
  type BatchExportSizeSelection,
} from '../lib/batchExportSizeOptions';

type BatchExportItem = {
  id: string;
  file: File;
  fileName: string;
  width: number | null;
  height: number | null;
  fileType: string;
  hasTransparency: boolean | null;
  quickStatus: 'Ready' | 'Review';
  selected: boolean;
  loadError: boolean;
};

type BatchFilter =
  | 'all'
  | 'ready'
  | 'review'
  | 'png'
  | 'jpg'
  | 'no-transparency'
  | 'small-canvas';

const BATCH_FILTERS: { id: BatchFilter; label: string }[] = [
  { id: 'all', label: 'Show All' },
  { id: 'ready', label: 'Ready Only' },
  { id: 'review', label: 'Review Only' },
  { id: 'png', label: 'PNG Only' },
  { id: 'jpg', label: 'JPG Only' },
  { id: 'no-transparency', label: 'No Transparency' },
  { id: 'small-canvas', label: 'Small Canvas' },
];

function matchesBatchFilter(item: BatchExportItem, filter: BatchFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'ready') return item.quickStatus === 'Ready';
  if (filter === 'review') return item.quickStatus === 'Review';
  if (filter === 'png') return item.fileType === 'PNG';
  if (filter === 'jpg') return item.fileType === 'JPEG';
  if (filter === 'no-transparency') return item.hasTransparency === false;
  if (filter === 'small-canvas') {
    return (
      item.width !== null &&
      item.height !== null &&
      (item.width < 2000 || item.height < 2000)
    );
  }
  return true;
}

export type BatchExportSizeOption = {
  id: string;
  label: string;
  width: number;
  height: number;
};

type BatchExportQueueProps = {
  onDownloadBatchZip: (
    files: File[],
    sizes: BatchExportSizeSelection[],
    onProgress: (message: string) => void,
  ) => Promise<void>;
  aboveFileControls?: React.ReactNode;
};

function getFileTypeLabel(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png' || file.type === 'image/png') return 'PNG';
  if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') return 'JPEG';
  return ext ? ext.toUpperCase() : 'Unknown';
}

async function loadBatchExportItem(file: File): Promise<Omit<BatchExportItem, 'id' | 'file' | 'selected'>> {
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
        hasTransparency,
        quickStatus,
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
        hasTransparency: null,
        quickStatus: 'Review',
        loadError: true,
      });
    };

    image.src = url;
  });
}

export default function BatchExportQueue({ onDownloadBatchZip, aboveFileControls }: BatchExportQueueProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BatchExportItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedSizeIds, setSelectedSizeIds] = useState<Record<string, boolean>>({
    standard: true,
    redbubble: false,
    printful: false,
    teepublic: false,
    square: false,
    sticker: false,
    poster: false,
    mug: false,
    'tote-bag': false,
    'phone-case': false,
  });
  const [message, setMessage] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [filter, setFilter] = useState<BatchFilter>('all');

  const selectedSizes = BATCH_MULTI_EXPORT_SIZE_OPTIONS.filter(
    (option) => selectedSizeIds[option.id],
  );
  const selectedDesignCount = items.filter((item) => item.selected && !item.loadError).length;
  const totalOutputCount = selectedDesignCount * selectedSizes.length;

  const toggleSizeOption = (id: string) => {
    setSelectedSizeIds((prev) => {
      const currentlySelected = Object.entries(prev).filter(([, on]) => on).length;
      if (prev[id] && currentlySelected <= 1) return prev;
      return { ...prev, [id]: !prev[id] };
    });
    setMessage('');
  };

  const filteredItems = items.filter((item) => matchesBatchFilter(item, filter));

  const filterButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    background: active ? 'rgba(37, 99, 235, 0.28)' : 'rgba(148, 163, 184, 0.10)',
    color: active ? '#bfdbfe' : '#94a3b8',
    border: active
      ? '1px solid rgba(147, 197, 253, 0.45)'
      : '1px solid rgba(148, 163, 184, 0.22)',
    cursor: 'pointer',
  });

  const removeButtonStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 800,
    background: 'rgba(148, 163, 184, 0.12)',
    color: '#cbd5e1',
    border: '1px solid rgba(148, 163, 184, 0.28)',
    cursor: 'pointer',
    flexShrink: 0,
  };

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

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function removeSelected() {
    setItems((prev) => prev.filter((item) => !item.selected));
  }

  function clearAll() {
    setItems([]);
    setMessage('');
    setProgressMessage('');
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

    if (selectedSizes.length === 0) {
      setMessage('Choose at least one export size.');
      return;
    }

    setMessage('');
    setProgressMessage('');
    setBusy(true);
    try {
      await onDownloadBatchZip(
        selectedFiles,
        selectedSizes.map(({ label, width, height, folderSlug }) => ({
          label,
          width,
          height,
          folderSlug,
        })),
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
        Add multiple designs, choose export sizes, then download one ZIP with ready PNG files.
      </div>
      {aboveFileControls}
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
      <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800 }}>Choose Export Sizes</div>
      <div
        style={{
          maxHeight: 160,
          overflowY: 'auto',
          padding: 8,
          borderRadius: 10,
          background: 'rgba(15, 23, 42, 0.55)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          display: 'grid',
          gap: 6,
        }}
      >
        {BATCH_MULTI_EXPORT_SIZE_OPTIONS.map((option) => (
          <label
            key={option.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 11,
              color: '#e2e8f0',
              cursor: busy ? 'not-allowed' : 'pointer',
              lineHeight: 1.4,
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(selectedSizeIds[option.id])}
              disabled={busy}
              onChange={() => toggleSizeOption(option.id)}
              style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }}
            />
            <span>{option.checkboxLabel}</span>
          </label>
        ))}
      </div>
      {selectedDesignCount > 0 && selectedSizes.length > 0 ? (
        <div style={{ fontSize: 11, color: '#93c5fd', lineHeight: 1.4, fontWeight: 700 }}>
          {selectedDesignCount} design{selectedDesignCount === 1 ? '' : 's'} × {selectedSizes.length}{' '}
          size{selectedSizes.length === 1 ? '' : 's'} = {totalOutputCount} PNG file
          {totalOutputCount === 1 ? '' : 's'}
        </div>
      ) : null}
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
          No batch files added yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>Quick filter:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {BATCH_FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  style={filterButtonStyle(filter === option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              onClick={removeSelected}
              disabled={busy || !items.some((item) => item.selected)}
              style={{
                ...removeButtonStyle,
                opacity: busy || !items.some((item) => item.selected) ? 0.55 : 1,
                cursor: busy || !items.some((item) => item.selected) ? 'not-allowed' : 'pointer',
              }}
            >
              Remove selected
            </button>
            <button type="button" onClick={clearAll} disabled={busy} style={removeButtonStyle}>
              Clear All
            </button>
          </div>
          {filteredItems.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
              No files match this filter.
            </div>
          ) : (
            filteredItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gap: 4,
                padding: 8,
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.22)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                    minWidth: 0,
                    cursor: item.loadError ? 'not-allowed' : 'pointer',
                  }}
                >
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
                </label>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={busy}
                  style={removeButtonStyle}
                >
                  Remove
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45, paddingLeft: 22 }}>
                {item.loadError
                  ? 'Could not load image — skipped from export'
                  : `${item.width} × ${item.height} px · ${item.fileType}`}
              </div>
            </div>
            ))
          )}
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
        {busy && items.length > 0 ? 'Building batch export...' : 'Download Batch Export ZIP'}
      </button>
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
        ZIP file name: pod-checker-batch-export.zip
      </div>
    </div>
  );
}
