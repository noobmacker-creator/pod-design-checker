'use client';

import React, { useState } from 'react';
import type { BatchQueueItem } from '../lib/batchQueueUtils';
import { formatBatchFileSize } from '../lib/batchQueueUtils';

type BatchFilter = 'all' | 'png' | 'jpg' | 'webp';

const BATCH_FILTERS: { id: BatchFilter; label: string }[] = [
  { id: 'all', label: 'Show All' },
  { id: 'png', label: 'PNG Only' },
  { id: 'jpg', label: 'JPG Only' },
  { id: 'webp', label: 'WEBP Only' },
];

function matchesBatchFilter(item: BatchQueueItem, filter: BatchFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'png') return item.type === 'PNG';
  if (filter === 'jpg') return item.type === 'JPEG';
  if (filter === 'webp') return item.type === 'WEBP';
  return true;
}

type BatchPODCheckerProps = {
  queueItems: BatchQueueItem[];
  onOpenInChecker: (file: File) => void;
};

export default function BatchPODChecker({ queueItems, onOpenInChecker }: BatchPODCheckerProps) {
  const [filter, setFilter] = useState<BatchFilter>('all');

  const filteredItems = queueItems.filter((item) => matchesBatchFilter(item, filter));

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

  return (
    <div
      id="batch-pod-checker"
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
        overflowX: 'hidden',
      }}
    >
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 800 }}>Batch Check</div>
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
        Open any queued file in the main checker for a full scan.
      </div>

      {queueItems.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
          Add files to the queue above to begin.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
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
          {filteredItems.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
              No files match this filter.
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid rgba(148, 163, 184, 0.22)',
                  minWidth: 0,
                }}
              >
                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#e2e8f0',
                      wordBreak: 'break-all',
                    }}
                  >
                    {item.filename}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                    {item.type} · {formatBatchFileSize(item.size)}
                  </div>
                </div>
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
                    flexShrink: 0,
                  }}
                >
                  Open in Checker
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
