'use client';

import React, { useMemo, useState } from 'react';
import type { BatchQueueItem } from '../lib/batchQueueUtils';
import { formatBatchFileSize } from '../lib/batchQueueUtils';
import { getBatchStatusColors, getBatchStatusLabel } from '../lib/batchScanner';
import {
  BatchNeedsReviewModal,
  useBatchQueueController,
} from './BatchFileQueue';
import BatchDownloadExports from './BatchDownloadExports';
import PODUploadNotes from './PODUploadNotes';
import type { PODUploadNotesProps } from './PODUploadNotes';

type ResultFilter = 'all' | 'ready' | 'review' | 'failed';

type BatchWorkspaceProps = {
  items: BatchQueueItem[];
  onItemsChange: (items: BatchQueueItem[]) => void;
  onOpenInChecker: (file: File) => void;
  uploadNotesProps: PODUploadNotesProps;
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 800,
  background: '#2563eb',
  color: '#ffffff',
  border: 'none',
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
  background: 'rgba(37, 99, 235, 0.22)',
  color: '#bfdbfe',
  border: '1px solid rgba(147, 197, 253, 0.45)',
  cursor: 'pointer',
};

const quietLinkStyle: React.CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: '#94a3b8',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'underline',
};

const INITIAL_FILE_PREVIEW = 4;

function matchesResultFilter(item: BatchQueueItem, filter: ResultFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'ready') return item.status === 'ready';
  if (filter === 'review') return item.status === 'needs-review' || item.status === 'safe-auto-fix';
  if (filter === 'failed') return item.status === 'failed';
  return true;
}

function StatusBadge({ status }: { status: BatchQueueItem['status'] }) {
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
        lineHeight: 1.25,
      }}
    >
      {getBatchStatusLabel(status)}
    </span>
  );
}

export default function BatchWorkspace({
  items,
  onItemsChange,
  onOpenInChecker,
  uploadNotesProps,
}: BatchWorkspaceProps) {
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [dragActive, setDragActive] = useState(false);

  const {
    filesInputRef,
    folderInputRef,
    message,
    isScanning,
    isFixing,
    scanProgress,
    fixSummary,
    reviewOpen,
    setReviewOpen,
    reviewStartIndex,
    needsReviewItems,
    needsReviewCount,
    safeAutoFixCount,
    totalSize,
    hasScanResults,
    scanningItem,
    openReviewAt,
    openReviewAll,
    handleFilesSelected,
    applyIntake,
    removeItem,
    clearQueue,
    handleScanBatch,
    handleAutoFixSafeFiles,
    countReady,
    countNeedReview,
    countFailed,
  } = useBatchQueueController(items, onItemsChange);

  const visibleFileItems = showAllFiles ? items : items.slice(0, INITIAL_FILE_PREVIEW);
  const hasMoreFiles = items.length > INITIAL_FILE_PREVIEW;

  const filteredResults = useMemo(
    () => items.filter((item) => hasScanResults && matchesResultFilter(item, resultFilter)),
    [items, hasScanResults, resultFilter],
  );

  const filterButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    background: active ? 'rgba(37, 99, 235, 0.28)' : 'rgba(148, 163, 184, 0.10)',
    color: active ? '#bfdbfe' : '#94a3b8',
    border: active
      ? '1px solid rgba(147, 197, 253, 0.45)'
      : '1px solid rgba(148, 163, 184, 0.22)',
    cursor: 'pointer',
  });

  const scanPercent =
    scanProgress.total > 0 ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0;

  const workspaceCardStyle: React.CSSProperties = {
    border: '1px solid rgba(56, 189, 248, 0.35)',
    background: 'rgba(8, 47, 73, 0.18)',
    borderRadius: 16,
    padding: 16,
    display: 'grid',
    gap: 12,
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div
      id="batch-workspace"
      style={{
        display: 'grid',
        gap: 12,
        minWidth: 0,
        maxWidth: '100%',
        height: '100%',
        alignContent: 'start',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <input
        ref={filesInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        multiple
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        multiple
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />

      {/* STATE 1 — EMPTY */}
      {items.length === 0 ? (
        <div style={workspaceCardStyle}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', letterSpacing: '0.02em' }}>
            BATCH DESIGN CHECK
          </div>
          <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.5 }}>
            Check up to 100 designs in one scan.
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const dropped = Array.from(e.dataTransfer.files);
              if (dropped.length > 0) applyIntake(dropped);
            }}
            style={{
              padding: 20,
              borderRadius: 14,
              border: dragActive
                ? '2px dashed rgba(56, 189, 248, 0.75)'
                : '2px dashed rgba(147, 197, 253, 0.35)',
              background: dragActive
                ? 'rgba(37, 99, 235, 0.12)'
                : 'rgba(15, 23, 42, 0.45)',
              display: 'grid',
              gap: 12,
              justifyItems: 'center',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>
              Drag designs or a folder here
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => filesInputRef.current?.click()}
                style={secondaryButtonStyle}
              >
                Add Files
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                style={secondaryButtonStyle}
              >
                Add Folder
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
              PNG, JPG and WEBP
              <br />
              Maximum 100 files · Maximum 50 MB per file · Maximum 500 MB combined
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Add designs to begin.</div>
        </div>
      ) : null}

      {/* STATE 2 — FILES ADDED (not scanning, no results yet) */}
      {items.length > 0 && !isScanning && !hasScanResults ? (
        <div style={workspaceCardStyle}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>
            {items.length} design{items.length === 1 ? '' : 's'} ready to scan
          </div>
          <div style={{ fontSize: 13, color: '#cbd5e1' }}>{formatBatchFileSize(totalSize)} combined</div>
          <button
            type="button"
            onClick={() => void handleScanBatch()}
            disabled={isFixing}
            style={{
              ...primaryButtonStyle,
              width: 'fit-content',
              opacity: isFixing ? 0.55 : 1,
              cursor: isFixing ? 'not-allowed' : 'pointer',
            }}
          >
            Scan {items.length} Design{items.length === 1 ? '' : 's'}
          </button>
          <button type="button" onClick={clearQueue} style={quietLinkStyle}>
            Clear all
          </button>
          {renderFileList(visibleFileItems, hasMoreFiles, showAllFiles, setShowAllFiles, items.length, removeItem, isFixing)}
          {message ? <div style={{ fontSize: 12, color: '#cbd5e1' }}>{message}</div> : null}
        </div>
      ) : null}

      {/* STATE 3 — SCANNING */}
      {isScanning ? (
        <div style={workspaceCardStyle}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc' }}>SCANNING DESIGNS</div>
          <div style={{ fontSize: 14, color: '#bfdbfe', fontWeight: 700 }}>
            Checking {scanProgress.current} of {scanProgress.total}…
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: 'rgba(148, 163, 184, 0.22)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${scanPercent}%`,
                background: '#38bdf8',
                borderRadius: 999,
                transition: 'width 0.2s ease',
              }}
            />
          </div>
          {scanningItem ? (
            <div style={{ fontSize: 12, color: '#94a3b8', wordBreak: 'break-all' }}>
              {scanningItem.filename}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* STATE 4 — RESULTS */}
      {hasScanResults && !isScanning ? (
        <div style={workspaceCardStyle}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc' }}>BATCH RESULTS</div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              fontSize: 15,
              fontWeight: 800,
            }}
          >
            <span style={{ color: '#86efac' }}>{countReady} Ready</span>
            <span style={{ color: '#fdba74' }}>{countNeedReview} Need Review</span>
            <span style={{ color: '#fca5a5' }}>{countFailed} Failed</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {needsReviewCount > 0 ? (
              <button
                type="button"
                onClick={openReviewAll}
                style={{ ...secondaryButtonStyle, background: '#ea580c', color: '#fff', border: 'none' }}
              >
                Review Results
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowExport(true)}
              style={secondaryButtonStyle}
            >
              Download Exports
            </button>
            {safeAutoFixCount > 0 ? (
              <button
                type="button"
                onClick={() => void handleAutoFixSafeFiles()}
                disabled={isFixing}
                style={{
                  ...secondaryButtonStyle,
                  background: '#ca8a04',
                  color: '#ffffff',
                  border: 'none',
                  opacity: isFixing ? 0.55 : 1,
                  cursor: isFixing ? 'not-allowed' : 'pointer',
                }}
              >
                Fix {safeAutoFixCount} Safe Design{safeAutoFixCount === 1 ? '' : 's'}
              </button>
            ) : null}
          </div>

          {safeAutoFixCount > 0 ? (
            <div style={{ fontSize: 12, color: '#fde68a' }}>
              {safeAutoFixCount} design{safeAutoFixCount === 1 ? '' : 's'} can be safely fixed
            </div>
          ) : null}

          {fixSummary ? (
            <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
              Fixed {fixSummary.fixed} · {fixSummary.becameReady} became Ready ·{' '}
              {fixSummary.stillReview} still need review · {fixSummary.failed} failed
            </div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['all', 'ready', 'review', 'failed'] as ResultFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setResultFilter(filter)}
                style={filterButtonStyle(resultFilter === filter)}
              >
                {filter === 'all'
                  ? 'All'
                  : filter === 'ready'
                  ? 'Ready'
                  : filter === 'review'
                  ? 'Review'
                  : 'Failed'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {filteredResults.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>No files match this filter.</div>
            ) : (
              filteredResults.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(15, 23, 42, 0.55)',
                    border: '1px solid rgba(148, 163, 184, 0.22)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#e2e8f0',
                        wordBreak: 'break-all',
                      }}
                    >
                      {item.filename}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4 }}>
                      <StatusBadge status={item.status} />
                      {item.scanResult ? (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {item.scanResult.mainIssue}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {item.status === 'needs-review' ? (
                      <button
                        type="button"
                        onClick={() => openReviewAt(item.id)}
                        style={{ ...secondaryButtonStyle, padding: '6px 10px', fontSize: 11 }}
                      >
                        Review
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onOpenInChecker(item.file)}
                      style={{ ...primaryButtonStyle, padding: '6px 12px', fontSize: 11 }}
                    >
                      Open in Checker
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button type="button" onClick={clearQueue} style={quietLinkStyle}>
            Clear all
          </button>
          {message ? <div style={{ fontSize: 12, color: '#cbd5e1' }}>{message}</div> : null}
        </div>
      ) : null}

      {/* FILES ADDED while has results — allow adding more */}
      {items.length > 0 && hasScanResults && !isScanning ? (
        <div style={{ ...workspaceCardStyle, padding: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#93c5fd' }}>Add more designs</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" onClick={() => filesInputRef.current?.click()} style={secondaryButtonStyle}>
              Add Files
            </button>
            <button type="button" onClick={() => folderInputRef.current?.click()} style={secondaryButtonStyle}>
              Add Folder
            </button>
            <button
              type="button"
              onClick={() => void handleScanBatch()}
              disabled={isFixing}
              style={{
                ...secondaryButtonStyle,
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                opacity: isFixing ? 0.55 : 1,
              }}
            >
              Scan {items.length} Design{items.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      ) : null}

      {/* EXPORT FLOW */}
      {showExport && hasScanResults ? (
        <div style={workspaceCardStyle}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#f8fafc' }}>DOWNLOAD EXPORTS</div>
          <BatchDownloadExports queueItems={items} />
        </div>
      ) : null}

      {/* MORE BATCH TOOLS */}
      <details
        style={{
          padding: 12,
          borderRadius: 14,
          background: 'rgba(15, 23, 42, 0.55)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 800,
            color: '#93c5fd',
            listStyle: 'none',
          }}
        >
          More Batch Tools
        </summary>
        <div style={{ marginTop: 10 }}>
          <PODUploadNotes {...uploadNotesProps} />
        </div>
      </details>

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

function renderFileList(
  visibleItems: BatchQueueItem[],
  hasMore: boolean,
  showAll: boolean,
  setShowAll: (v: boolean) => void,
  totalCount: number,
  removeItem: (id: string) => void,
  isFixing: boolean,
) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 0,
        borderRadius: 10,
        border: '1px solid rgba(148, 163, 184, 0.22)',
        background: 'rgba(15, 23, 42, 0.55)',
        overflow: 'hidden',
      }}
    >
      {visibleItems.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '8px 10px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', wordBreak: 'break-all' }}>
              {item.filename}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatBatchFileSize(item.size)}</div>
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            disabled={isFixing}
            style={{
              padding: '5px 8px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 800,
              background: 'rgba(148, 163, 184, 0.12)',
              color: '#cbd5e1',
              border: '1px solid rgba(148, 163, 184, 0.28)',
              cursor: isFixing ? 'not-allowed' : 'pointer',
              opacity: isFixing ? 0.55 : 1,
              flexShrink: 0,
            }}
          >
            Remove
          </button>
        </div>
      ))}
      {hasMore ? (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          style={{
            ...quietLinkStyle,
            padding: '8px 10px',
            textAlign: 'left',
            textDecoration: 'none',
          }}
        >
          {showAll ? 'Show fewer' : `View all ${totalCount} designs`}
        </button>
      ) : null}
    </div>
  );
}
