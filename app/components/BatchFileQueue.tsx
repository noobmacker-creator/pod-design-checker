'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type BatchQueueItem,
  type BatchScanResult,
  type BatchScanStatus,
  buildBatchIntakeMessage,
  formatBatchFileSize,
  intakeBatchFiles,
} from '../lib/batchQueueUtils';
import {
  getBatchStatusColors,
  getBatchStatusLabel,
  resolvePostAutoFixScanResult,
  scanBatchFile,
} from '../lib/batchScanner';
import { createBatchFixedPngBlob, describeFixesFromScanResult } from '../lib/batchAutoFix';

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

/** After Auto Fix, map recheck status to the item's current final status. */
function resolvePostAutoFixStatus(
  recheckStatus: BatchScanStatus,
  postFixScanResult: BatchScanResult,
  preFixResult: BatchScanResult | null,
): BatchScanStatus {
  if (recheckStatus === 'ready' || recheckStatus === 'failed') {
    return recheckStatus;
  }
  if (recheckStatus === 'needs-review') {
    return 'needs-review';
  }
  // Still safe-auto-fix after a fix: only keep that status if progress was made.
  if (preFixResult && postFixScanResult.mainIssue !== preFixResult.mainIssue) {
    return 'safe-auto-fix';
  }
  return 'needs-review';
}

function applyStatusConfidenceCap(
  scanResult: BatchScanResult,
  status: BatchScanStatus,
): BatchScanResult {
  if (scanResult.printConfidence === null) return scanResult;
  if (status === 'needs-review') {
    return { ...scanResult, printConfidence: Math.min(scanResult.printConfidence, 89) };
  }
  if (status === 'safe-auto-fix') {
    return { ...scanResult, printConfidence: Math.min(scanResult.printConfidence, 85) };
  }
  return scanResult;
}

const checkerboardStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  backgroundImage: `
    linear-gradient(45deg, #334155 25%, transparent 25%),
    linear-gradient(-45deg, #334155 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #334155 75%),
    linear-gradient(-45deg, transparent 75%, #334155 75%)
  `,
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
};

function getPreviewSource(item: BatchQueueItem): Blob | File {
  if (item.fixedBlob) return item.fixedBlob;
  return item.file;
}

type BatchNeedsReviewModalProps = {
  items: BatchQueueItem[];
  startIndex: number;
  onClose: () => void;
};

function BatchNeedsReviewModal({ items, startIndex, onClose }: BatchNeedsReviewModalProps) {
  const [index, setIndex] = useState(startIndex);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const item = items[index];
  const total = items.length;

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    revokePreviewUrl();
    if (!item) return;
    const source = getPreviewSource(item);
    const url = URL.createObjectURL(source);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    return revokePreviewUrl;
  }, [item, revokePreviewUrl]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    return () => revokePreviewUrl();
  }, [revokePreviewUrl]);

  if (!item) return null;

  const scanResult = item.scanResult;
  const showingFixed = Boolean(item.fixedBlob);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-review-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(2, 6, 23, 0.72)',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(960px, 100%)',
          maxHeight: '90dvh',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gap: 10,
          padding: 14,
          borderRadius: 14,
          background: 'rgba(15, 23, 42, 0.96)',
          border: '1px solid rgba(147, 197, 253, 0.35)',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          <div
            id="batch-review-modal-title"
            style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}
          >
            Review {index + 1} of {total}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#e2e8f0',
              wordBreak: 'break-all',
            }}
          >
            {item.filename}
          </div>
          {showingFixed ? (
            <div style={{ fontSize: 11, color: '#fde68a', fontWeight: 700 }}>
              Auto-Fixed version shown
            </div>
          ) : null}
        </div>

        <div
          style={{
            minHeight: 0,
            display: 'grid',
            gridTemplateRows: 'minmax(0, 1fr) auto',
            gap: 10,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              ...checkerboardStyle,
              minHeight: 'min(58dvh, 520px)',
              borderRadius: 12,
              border: '1px solid rgba(148, 163, 184, 0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={item.filename}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <StatusBadge status="needs-review" />
              {scanResult?.printConfidence !== null && scanResult?.printConfidence !== undefined ? (
                <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                  Print Confidence: {scanResult.printConfidence}%
                </span>
              ) : null}
            </div>

            {scanResult ? (
              <>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', marginBottom: 2 }}>
                    Main Issue
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.45 }}>
                    {scanResult.mainIssue}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', marginBottom: 2 }}>
                    Next Action
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.45 }}>
                    {scanResult.nextAction}
                  </div>
                </div>
              </>
            ) : null}

            <details style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 800, color: '#93c5fd' }}>
                Why this needs review
              </summary>
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                {scanResult?.warnings.length ? (
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>Warnings</div>
                    {scanResult.warnings.map((warning) => (
                      <div key={warning}>· {warning}</div>
                    ))}
                  </div>
                ) : null}
                {scanResult?.failures.length ? (
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>Failures</div>
                    {scanResult.failures.map((failure) => (
                      <div key={failure}>· {failure}</div>
                    ))}
                  </div>
                ) : null}
                {item.fixesApplied?.length ? (
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>Fixes applied</div>
                    {item.fixesApplied.map((fix) => (
                      <div key={fix}>· {fix}</div>
                    ))}
                  </div>
                ) : null}
                {item.preFixResult ? (
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>Pre-fix issue</div>
                    <div>· {item.preFixResult.mainIssue}</div>
                    {item.preFixResult.nextAction ? (
                      <div style={{ color: '#94a3b8' }}>· Was: {item.preFixResult.nextAction}</div>
                    ) : null}
                  </div>
                ) : null}
                {item.postFixResult &&
                item.wasAutoFixed &&
                item.postFixResult.mainIssue !== scanResult?.mainIssue ? (
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>Raw post-fix scan</div>
                    <div>· {item.postFixResult.mainIssue}</div>
                  </div>
                ) : null}
                {!scanResult?.warnings.length &&
                !scanResult?.failures.length &&
                !item.fixesApplied?.length &&
                !item.preFixResult &&
                !item.postFixResult ? (
                  <div>No additional details available.</div>
                ) : null}
              </div>
            </details>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
            style={{
              ...secondaryButtonStyle,
              opacity: index === 0 ? 0.55 : 1,
              cursor: index === 0 ? 'not-allowed' : 'pointer',
            }}
            aria-label="Previous needs review design"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setIndex((value) => Math.min(total - 1, value + 1))}
            disabled={index >= total - 1}
            style={{
              ...controlButtonStyle,
              flex: '0 0 auto',
              background: '#2563eb',
              color: '#ffffff',
              opacity: index >= total - 1 ? 0.55 : 1,
              cursor: index >= total - 1 ? 'not-allowed' : 'pointer',
            }}
            aria-label="Next needs review design"
          >
            Next
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ ...secondaryButtonStyle, flex: '0 0 auto' }}
            aria-label="Close review window"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
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
  const cancelFixRef = useRef(false);
  const [message, setMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [fixProgress, setFixProgress] = useState({ current: 0, total: 0 });
  const [fixSummary, setFixSummary] = useState<{
    fixed: number;
    becameReady: number;
    stillReview: number;
    failed: number;
  } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewStartIndex, setReviewStartIndex] = useState(0);

  const needsReviewItems = useMemo(
    () => items.filter((item) => item.status === 'needs-review'),
    [items],
  );
  const needsReviewCount = needsReviewItems.length;

  function openReviewAt(itemId: string) {
    const startIndex = needsReviewItems.findIndex((item) => item.id === itemId);
    setReviewStartIndex(startIndex >= 0 ? startIndex : 0);
    setReviewOpen(true);
  }

  function openReviewAll() {
    setReviewStartIndex(0);
    setReviewOpen(true);
  }

  const totalSize = items.reduce((sum, item) => sum + item.size, 0);
  const scannedCount = items.filter(
    (item) => item.status !== 'waiting' && item.status !== 'scanning',
  ).length;
  const hasScanResults = scannedCount > 0;
  const safeAutoFixCount = items.filter((item) => item.status === 'safe-auto-fix').length;

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
    cancelFixRef.current = true;
    onItemsChange([]);
    setMessage('');
    setIsScanning(false);
    setIsFixing(false);
    setFixSummary(null);
    setScanProgress({ current: 0, total: 0 });
    setFixProgress({ current: 0, total: 0 });
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

  function handleCancelFix() {
    cancelFixRef.current = true;
  }

  async function handleAutoFixSafeFiles() {
    const targetIndexes = items
      .map((item, index) => (item.status === 'safe-auto-fix' ? index : -1))
      .filter((index) => index >= 0);

    if (targetIndexes.length === 0 || isScanning || isFixing) return;

    cancelFixRef.current = false;
    setIsFixing(true);
    setFixSummary(null);
    setMessage('');

    let workingItems: BatchQueueItem[] = [...items];
    let fixedCount = 0;
    let becameReady = 0;
    let stillReview = 0;
    let failedFix = 0;

    for (let step = 0; step < targetIndexes.length; step++) {
      if (cancelFixRef.current) break;

      const index = targetIndexes[step];
      const item = workingItems[index];
      setFixProgress({ current: step + 1, total: targetIndexes.length });

      const fixStart = performance.now();
      const preFixResult = item.scanResult ? { ...item.scanResult } : null;

      try {
        const fixOutput = await createBatchFixedPngBlob(item.file);
        if (!fixOutput) throw new Error('Could not create fixed PNG');

        const fixesApplied = preFixResult
          ? describeFixesFromScanResult(preFixResult)
          : fixOutput.fixesApplied;

        const fixedName = `${item.filename.replace(/\.[^.]+$/, '')}-fixed.png`;
        const fixedFile = new File([fixOutput.blob], fixedName, { type: 'image/png' });
        const recheck = await scanBatchFile(fixedFile);
        const finalStatus = resolvePostAutoFixStatus(
          recheck.status,
          recheck.scanResult,
          preFixResult,
        );
        const finalScanResult = applyStatusConfidenceCap(
          resolvePostAutoFixScanResult(recheck.scanResult, finalStatus),
          finalStatus,
        );

        fixedCount += 1;
        if (finalStatus === 'ready') becameReady += 1;
        else if (finalStatus === 'failed') failedFix += 1;
        else stillReview += 1;

        if (process.env.NODE_ENV === 'development') {
          const elapsed = Math.round(performance.now() - fixStart);
          console.log(
            `[Batch Auto Fix] ${item.filename} — ${elapsed} ms — ${finalStatus}`,
          );
        }

        workingItems = workingItems.map((row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                status: finalStatus,
                scanResult: finalScanResult,
                fixedBlob: fixOutput.blob,
                wasAutoFixed: true,
                fixesApplied,
                preFixResult,
                postFixResult: recheck.scanResult,
              }
            : row,
        );
      } catch {
        failedFix += 1;
        if (process.env.NODE_ENV === 'development') {
          const elapsed = Math.round(performance.now() - fixStart);
          console.log(`[Batch Auto Fix] ${item.filename} — ${elapsed} ms — failed`);
        }

        workingItems = workingItems.map((row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                status: 'failed' as BatchScanStatus,
                scanResult: {
                  printConfidence: null,
                  mainIssue: 'Auto Fix failed',
                  nextAction: 'Fix or replace this file manually.',
                  warnings: [],
                  failures: ['Auto Fix failed'],
                  scanTimeMs: null,
                  errorMessage: 'Auto Fix failed',
                },
                wasAutoFixed: false,
              }
            : row,
        );
      }

      onItemsChange([...workingItems]);
    }

    setIsFixing(false);
    if (fixedCount > 0) {
      setFixSummary({
        fixed: fixedCount,
        becameReady,
        stillReview,
        failed: failedFix,
      });
    }
    if (cancelFixRef.current) {
      setMessage('Auto Fix cancelled. Completed fixes were kept.');
    }
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
          disabled={items.length === 0 || isScanning || isFixing}
          style={{
            ...secondaryButtonStyle,
            opacity: items.length === 0 || isScanning || isFixing ? 0.55 : 1,
            cursor: items.length === 0 || isScanning || isFixing ? 'not-allowed' : 'pointer',
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
          disabled={items.length === 0 || isScanning || isFixing}
          style={{
            ...controlButtonStyle,
            background: '#2563eb',
            color: '#ffffff',
            opacity: items.length === 0 || isScanning || isFixing ? 0.55 : 1,
            cursor: items.length === 0 || isScanning || isFixing ? 'not-allowed' : 'pointer',
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          onClick={handleAutoFixSafeFiles}
          disabled={safeAutoFixCount === 0 || isScanning || isFixing}
          style={{
            ...controlButtonStyle,
            background: '#ca8a04',
            color: '#ffffff',
            opacity: safeAutoFixCount === 0 || isScanning || isFixing ? 0.55 : 1,
            cursor: safeAutoFixCount === 0 || isScanning || isFixing ? 'not-allowed' : 'pointer',
          }}
          aria-label="Auto fix files marked Safe Auto Fix"
        >
          Auto Fix Safe Files
        </button>
        {isFixing ? (
          <button
            type="button"
            onClick={handleCancelFix}
            style={secondaryButtonStyle}
            aria-label="Cancel batch auto fix after the current file"
          >
            Cancel Fix
          </button>
        ) : null}
      </div>

      {isFixing ? (
        <div style={{ fontSize: 12, color: '#fde68a', fontWeight: 700 }} role="status">
          Fixing {fixProgress.current} of {fixProgress.total}
        </div>
      ) : null}

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

      {needsReviewCount > 0 && hasScanResults ? (
        <button
          type="button"
          onClick={openReviewAll}
          style={{
            ...controlButtonStyle,
            background: '#ea580c',
            color: '#ffffff',
            flex: 'none',
            width: '100%',
          }}
          aria-label={`Review ${needsReviewCount} file${needsReviewCount === 1 ? '' : 's'} that need review`}
        >
          Review {needsReviewCount} File{needsReviewCount === 1 ? '' : 's'}
        </button>
      ) : null}

      {fixSummary ? (
        <div
          style={{
            fontSize: 12,
            color: '#cbd5e1',
            lineHeight: 1.5,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(120, 53, 15, 0.22)',
            border: '1px solid rgba(250, 204, 21, 0.28)',
          }}
          role="status"
        >
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            Auto-fixed {fixSummary.fixed} file{fixSummary.fixed === 1 ? '' : 's'}
          </div>
          <div>{fixSummary.becameReady} became Ready</div>
          <div>{fixSummary.stillReview} still need review</div>
          <div>{fixSummary.failed} failed</div>
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
              gridTemplateColumns: 'minmax(0, 1fr) 64px 88px 72px 64px',
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
            <span>Review</span>
            <span>Remove</span>
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 64px 88px 72px 64px',
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
                {item.wasAutoFixed ? (
                  <div style={{ fontSize: 10, color: '#fde68a', lineHeight: 1.4, marginTop: 4 }}>
                    <div style={{ fontWeight: 800 }}>Auto-Fixed</div>
                    {item.fixesApplied?.map((fix) => (
                      <div key={fix}>· {fix}</div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div style={{ fontSize: 11, color: '#cbd5e1' }}>{formatBatchFileSize(item.size)}</div>
              <StatusBadge status={item.status} />
              {item.status === 'needs-review' ? (
                <button
                  type="button"
                  onClick={() => openReviewAt(item.id)}
                  style={{
                    ...secondaryButtonStyle,
                    padding: '5px 8px',
                    fontSize: 10,
                    background: 'rgba(234, 88, 12, 0.18)',
                    color: '#fdba74',
                    border: '1px solid rgba(251, 146, 60, 0.35)',
                  }}
                  aria-label={`Review ${item.filename}`}
                >
                  Review
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={(isScanning && item.status === 'scanning') || isFixing}
                style={{
                  ...secondaryButtonStyle,
                  padding: '5px 8px',
                  fontSize: 10,
                  opacity: (isScanning && item.status === 'scanning') || isFixing ? 0.55 : 1,
                  cursor:
                    (isScanning && item.status === 'scanning') || isFixing
                      ? 'not-allowed'
                      : 'pointer',
                }}
                aria-label={`Remove ${item.filename} from batch queue`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {reviewOpen && needsReviewCount > 0 ? (
        <BatchNeedsReviewModal
          key={reviewStartIndex}
          items={needsReviewItems}
          startIndex={reviewStartIndex}
          onClose={() => setReviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
