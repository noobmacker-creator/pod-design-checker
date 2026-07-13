'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import type { BatchQueueItem } from '../lib/batchQueueUtils';
import { getEligibleBatchExportItems } from '../lib/batchProductExport';
import BatchDownloadExports from './BatchDownloadExports';

type BatchDownloadsPanelProps = {
  queueItems: BatchQueueItem[];
  onReviewResults?: () => void;
  focusToken?: number;
};

const panelShellStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  padding: 12,
  background: 'rgba(255,255,255,0.04)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  display: 'grid',
  gridAutoRows: 'max-content',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  maxWidth: '100%',
  width: '100%',
  height: '100%',
  minHeight: '100%',
  boxSizing: 'border-box',
  overflowX: 'hidden',
};

const reviewButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 800,
  background: '#ea580c',
  color: '#ffffff',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
};

export default function BatchDownloadsPanel({
  queueItems,
  onReviewResults,
  focusToken = 0,
}: BatchDownloadsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  const hasScanResults = useMemo(
    () =>
      queueItems.some((item) => item.status !== 'waiting' && item.status !== 'scanning'),
    [queueItems],
  );

  const readyCount = useMemo(
    () => getEligibleBatchExportItems(queueItems).length,
    [queueItems],
  );

  useEffect(() => {
    if (focusToken <= 0) return;
    const panel = panelRef.current;
    const heading = headingRef.current;
    if (!panel) return;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      heading?.focus({ preventScroll: true });
    }, 300);
  }, [focusToken]);

  return (
    <div
      ref={panelRef}
      id="batch-downloads-panel"
      tabIndex={-1}
      style={{
        ...panelShellStyle,
        outline: focusToken > 0 ? '2px solid rgba(56, 189, 248, 0.45)' : 'none',
        outlineOffset: 2,
      }}
    >
      <div
        ref={headingRef}
        tabIndex={-1}
        style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f8fafc', outline: 'none' }}
      >
        BATCH DOWNLOADS
      </div>

      {!hasScanResults ? (
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
          Scan designs to see download options.
        </div>
      ) : readyCount === 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>0 designs are ready.</div>
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
            Review or fix the designs marked Need Review before creating exports.
          </div>
          {onReviewResults ? (
            <button type="button" onClick={onReviewResults} style={reviewButtonStyle}>
              Review Results
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#86efac' }}>
            {readyCount} design{readyCount === 1 ? '' : 's'} ready
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: '#93c5fd',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Download type:
          </div>
          <BatchDownloadExports queueItems={queueItems} />
        </div>
      )}
    </div>
  );
}
