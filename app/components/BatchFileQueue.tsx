'use client';

import React, { useRef, useState } from 'react';
import {
  type BatchQueueItem,
  type BatchScanStatus,
  buildBatchIntakeMessage,
  formatBatchFileSize,
  intakeBatchFiles,
} from '../lib/batchQueueUtils';
import { getBatchStatusColors, getBatchStatusLabel, scanBatchFile } from '../lib/batchScanner';

type BatchFileQueueProps = {
  items: BatchQueueItem[];
  onItemsChange: (items: BatchQueueItem[]) => void;
};

const controlButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
  background: 'rgba(37, 99, 235, 0.22)',
  color: '#bfdbfe',
  border: '1px solid rgba(147, 197, 253, 0.45)',
  cursor: 'pointer',
  flex: '1 1 0',
  minWidth: 0,
  boxSizing: 'border-box',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
  background: 'rgba(148, 163, 184, 0.12)',
  color: '#cbd5e1',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  cursor: 'pointer',
};

function countByStatus(items: BatchQueueItem[], status: BatchScanStatus) {
  return items.filter((item) => item.status === status).length;
}

function StatusBadge({ status }: { status: BatchScanStatus }) {
  const colors = getBatchStatusColors(status);
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        color: colors.color,
        background: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        padding: '3px 7px',
        width: 'fit-content',
        whiteSpace: 'nowrap',
      }}
    >
      {getBatchStatusLabel(status)}
    </span>
  );
}

export default function BatchFileQueue({ items, onItemsChange }: BatchFileQueueProps) {
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const cancelScanRef = useRef(false);
  const [message, setMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

  const totalSize = items.reduce((sum, item) => sum + item.size, 0);
  const scannedCount = items.filter(
    (item) => item.status !== 'waiting' && item.status !== 'scanning',
  ).length;
  const hasScanResults = scannedCount > 0;

  function applyIntake(files: File[]) {
    const previousCount = items.length;
    const result = intakeBatchFiles(files, items);
    onItemsChange(result.accepted);
    const intakeMessage = buildBatchIntakeMessage(result, previousCount);
    setMessage(intakeMessage || (files.length > 0 ? 'No new files were added.' : ''));
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    applyIntake(Array.from(fileList));
    e.target.value = '';
  }

  function removeItem(id: string) {
    onItemsChange(items.filter((item) => item.id !== id));
    setMessage('');
  }

  function clearQueue() {
    cancelScanRef.current = true;
    onItemsChange([]);
    setMessage('');
    setIsScanning(false);
    setScanProgress({ current: 0, total: 0 });
    if (filesInputRef.current) filesInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }

  async function handleScanBatch() {
    if (items.length === 0 || isScanning) return;

    cancelScanRef.current = false;
    setIsScanning(true);
    setMessage('');
    setScanProgress({ current: 0, total: items.length });

    let workingItems: BatchQueueItem[] = items.map((item) => ({
      ...item,
      status: 'waiting' as BatchScanStatus,
      scanResult: null,
    }));
    onItemsChange(workingItems);

    for (let index = 0; index < workingItems.length; index++) {
      if (cancelScanRef.current) break;

      const item = workingItems[index];
      workingItems = workingItems.map((row, rowIndex) =>
        rowIndex === index ? { ...row, status: 'scanning' as BatchScanStatus } : row,
      );
      onItemsChange([...workingItems]);
      setScanProgress({ current: index + 1, total: workingItems.length });

      try {
        const result = await scanBatchFile(item.file);
        workingItems = workingItems.map((row, rowIndex) =>
          rowIndex === index
            ? { ...row, status: result.status, scanResult: result.scanResult }
            : row,
        );
      } catch {
        workingItems = workingItems.map((row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                status: 'failed' as BatchScanStatus,
                scanResult: {
                  printConfidence: null,
                  mainIssue: 'Scan failed',
                  nextAction: 'Fix or replace this file before upload.',
                  warnings: [],
                  failures: ['Scan failed'],
                  scanTimeMs: null,
                  errorMessage: 'Scan failed',
                },
              }
            : row,
        );
      }

      onItemsChange([...workingItems]);
    }

    setIsScanning(false);
    if (cancelScanRef.current) {
      setMessage('Scan cancelled. Completed results were kept.');
    }
  }

  function handleCancelScan() {
    cancelScanRef.current = true;
  }

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(147, 197, 253, 0.25)',
        display: 'grid',
        gap: 8,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 800 }}>Batch File Queue</div>
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
        Add multiple images or a folder, then scan them for quick traffic-light results.
      </div>

      <input
        ref={filesInputRef}
        id="batch-add-files-input"
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        multiple
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />
      <input
        ref={folderInputRef}
        id="batch-add-folder-input"
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        multiple
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={() => filesInputRef.current?.click()}
          style={controlButtonStyle}
          aria-label="Add multiple image files to the batch queue"
        >
          Add Files
        </button>
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          style={controlButtonStyle}
          aria-label="Add a folder of image files to the batch queue"
        >
          Add Folder
        </button>
        <button
          type="button"
          onClick={clearQueue}
          disabled={items.length === 0 || isScanning}
          style={{
            ...secondaryButtonStyle,
            opacity: items.length === 0 || isScanning ? 0.55 : 1,
            cursor: items.length === 0 || isScanning ? 'not-allowed' : 'pointer',
          }}
          aria-label="Clear the batch file queue"
        >
          Clear Queue
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={handleScanBatch}
          disabled={items.length === 0 || isScanning}
          style={{
            ...controlButtonStyle,
            background: '#2563eb',
            color: '#ffffff',
            opacity: items.length === 0 || isScanning ? 0.55 : 1,
            cursor: items.length === 0 || isScanning ? 'not-allowed' : 'pointer',
          }}
          aria-label="Scan all queued batch files"
        >
          Scan Batch
        </button>
        {isScanning ? (
          <button
            type="button"
            onClick={handleCancelScan}
            style={secondaryButtonStyle}
            aria-label="Cancel batch scan after the current file"
          >
            Cancel Scan
          </button>
        ) : null}
      </div>

      {isScanning ? (
        <div style={{ fontSize: 12, color: '#bfdbfe', fontWeight: 700 }} role="status">
          Scanning {scanProgress.current} of {scanProgress.total}
        </div>
      ) : null}

      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
        {items.length} file{items.length === 1 ? '' : 's'} · {formatBatchFileSize(totalSize)} total · PNG,
        JPG, JPEG, WEBP accepted · max 100 files · 50 MB per file · 500 MB combined
      </div>

      {hasScanResults ? (
        <div
          style={{
            fontSize: 12,
            color: '#cbd5e1',
            lineHeight: 1.5,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(15, 23, 42, 0.55)',
            border: '1px solid rgba(148, 163, 184, 0.18)',
          }}
          role="status"
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            Scanned {scannedCount} of {items.length} files
          </div>
          <div>🟢 Ready: {countByStatus(items, 'ready')}</div>
          <div>🟡 Safe Auto Fix: {countByStatus(items, 'safe-auto-fix')}</div>
          <div>🟠 Needs Review: {countByStatus(items, 'needs-review')}</div>
          <div>🔴 Failed: {countByStatus(items, 'failed')}</div>
        </div>
      ) : null}

      {message ? (
        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }} role="status">
          {message}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>No batch files added yet.</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 0,
            maxHeight: 320,
            overflowY: 'auto',
            borderRadius: 10,
            border: '1px solid rgba(148, 163, 184, 0.22)',
            background: 'rgba(15, 23, 42, 0.55)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 64px 88px 64px',
              gap: 8,
              padding: '8px 10px',
              fontSize: 10,
              fontWeight: 900,
              color: '#93c5fd',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
              position: 'sticky',
              top: 0,
              background: 'rgba(15, 23, 42, 0.92)',
              zIndex: 1,
            }}
          >
            <span>File</span>
            <span>Size</span>
            <span>Status</span>
            <span>Remove</span>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 64px 88px 64px',
                gap: 8,
                padding: '8px 10px',
                alignItems: 'start',
                borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                minWidth: 0,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#e2e8f0',
                    wordBreak: 'break-all',
                    lineHeight: 1.35,
                  }}
                >
                  {item.filename}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.35, marginTop: 2 }}>
                  {item.type}
                  {item.relativePath && item.relativePath !== item.filename
                    ? ` · ${item.relativePath}`
                    : ''}
                </div>
                {item.scanResult ? (
                  <div style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.4, marginTop: 4 }}>
                    {item.scanResult.printConfidence !== null
                      ? `Print Confidence: ${item.scanResult.printConfidence}%`
                      : null}
                    {item.scanResult.printConfidence !== null ? ' · ' : ''}
                    Main Issue: {item.scanResult.mainIssue}
                  </div>
                ) : null}
              </div>
              <div style={{ fontSize: 11, color: '#cbd5e1' }}>{formatBatchFileSize(item.size)}</div>
              <StatusBadge status={item.status} />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={isScanning && item.status === 'scanning'}
                style={{
                  ...secondaryButtonStyle,
                  padding: '5px 8px',
                  fontSize: 10,
                  opacity: isScanning && item.status === 'scanning' ? 0.55 : 1,
                  cursor: isScanning && item.status === 'scanning' ? 'not-allowed' : 'pointer',
                }}
                aria-label={`Remove ${item.filename} from batch queue`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
