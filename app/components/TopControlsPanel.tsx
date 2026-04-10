'use client';

import React from 'react';
import type { ViewMode } from '../lib/podCheckerTypes';

type TopControlsPanelProps = {
  file: File | null;
  img: HTMLImageElement | null;
  originalBounds: { x: number; y: number; w: number; h: number } | null;
  showMoreFixes: boolean;
  setShowMoreFixes: React.Dispatch<React.SetStateAction<boolean>>;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  previewSize: number;
  setPreviewSize: React.Dispatch<React.SetStateAction<number>>;
  mockupOffsetX: number;
  mockupOffsetY: number;
  mockupScale: number;
  setMockupOffsetX: React.Dispatch<React.SetStateAction<number>>;
  setMockupOffsetY: React.Dispatch<React.SetStateAction<number>>;
  setMockupScale: React.Dispatch<React.SetStateAction<number>>;
  actionMessage: string;
  downloadMessage: string;
  isScanning: boolean;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleQuickFix: () => void;
  resetToOriginalView: () => void;
  handleDownloadFixedPng: () => void;
  handleFixCanvas: () => void;
  handleCenterArtwork: () => void;
  handleAutoFixSafetyBorder: () => void;
  handleAutoFixTooSmall: () => void;
  setActionMessage: React.Dispatch<React.SetStateAction<string>>;
};

export default function TopControlsPanel({
  img,
  originalBounds,
  showMoreFixes,
  setShowMoreFixes,
  setViewMode,
  actionMessage,
  isScanning,
  handleQuickFix,
  resetToOriginalView,
  handleDownloadFixedPng,
  handleFixCanvas,
  handleCenterArtwork,
  handleAutoFixSafetyBorder,
  handleAutoFixTooSmall,
  setActionMessage,
}: TopControlsPanelProps) {
  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 10,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>
            POD Design Checker™
          </div>
          <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 13 }}>
            Fast print-readiness actions
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
            width: '100%',
            maxWidth: 332,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'flex-end',
              width: '100%',
            }}
          >
            <button onClick={handleQuickFix} disabled={!img || !originalBounds}>
              Quick Fix
            </button>

            <button onClick={resetToOriginalView} disabled={!img}>
              Reset
            </button>

            <button onClick={handleDownloadFixedPng} disabled={!img}>
              Download PNG
            </button>

            <button onClick={() => setShowMoreFixes((v) => !v)} disabled={!img}>
              {showMoreFixes ? 'Hide Tools' : 'More Tools'}
            </button>
          </div>

          {isScanning && (
            <div
              style={{
                width: '100%',
                maxWidth: 332,
                padding: '8px 12px',
                borderRadius: 14,
                background: 'rgba(59,130,246,0.14)',
                border: '1px solid rgba(59,130,246,0.35)',
                color: '#dbeafe',
                fontWeight: 700,
                fontSize: 13,
                lineHeight: 1.4,
                boxSizing: 'border-box',
              }}
            >
              {actionMessage || 'Scanning design...'}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 8,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 800, color: '#bae6fd', fontSize: 13 }}>
          View
        </span>

        <button
          onClick={() => {
            setViewMode('pod');
            setActionMessage('POD Canvas view selected.');
          }}
          disabled={!img}
        >
          POD Canvas
        </button>

        <button
          onClick={() => {
            setViewMode('design');
            setActionMessage('Design view selected.');
          }}
          disabled={!img}
        >
          Design
        </button>
      </div>

      {showMoreFixes && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <button onClick={handleFixCanvas} disabled={!img}>
            Fit to Canvas
          </button>

          <button onClick={handleCenterArtwork} disabled={!img}>
            Center Design
          </button>

          <button onClick={handleAutoFixSafetyBorder} disabled={!img || !originalBounds}>
            Fix Safety Border
          </button>

          <button onClick={handleAutoFixTooSmall} disabled={!img || !originalBounds}>
            Scale Design Up
          </button>
        </div>
      )}
    </div>
  );
}
