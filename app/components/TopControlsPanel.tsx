'use client';

import React from 'react';
import type { ViewMode } from '../lib/podCheckerTypes';

type TopControlsPanelProps = {
  file: File | null;
  img: HTMLImageElement | null;
  originalBounds: { x: number; y: number; w: number; h: number } | null;
  showMoreFixes: boolean;
  setShowMoreFixes: React.Dispatch<React.SetStateAction<boolean>>;
  viewMode: ViewMode;
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
  file,
  img,
  originalBounds,
  showMoreFixes,
  setShowMoreFixes,
  viewMode,
  setViewMode,
  setPreviewSize,
  mockupOffsetX,
  mockupOffsetY,
  mockupScale,
  setMockupOffsetX,
  setMockupOffsetY,
  setMockupScale,
  actionMessage,
  downloadMessage,
  handleFileChange,
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
        borderRadius: 20,
        padding: 24,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        marginBottom: 20,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800 }}>POD Design Checker™</h1>
      <p style={{ marginTop: 10, color: '#cbd5e1', lineHeight: 1.6 }}>
        Upload your design to instantly see if it's ready for print.
      </p>

      <div
        style={{
          marginTop: 18,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        

        <button onClick={handleQuickFix} disabled={!img || !originalBounds}>Quick Fix (Auto)</button>
        <button onClick={resetToOriginalView} disabled={!img}>Reset Position</button>
        <button onClick={handleDownloadFixedPng} disabled={!img}>Download Print-Ready PNG (4200×4800)</button>

        <button onClick={() => setShowMoreFixes((v) => !v)} disabled={!img}>
          {showMoreFixes ? 'Hide Tools' : 'More Tools'}
        </button>

        {showMoreFixes && (
          <>
            <button onClick={handleFixCanvas} disabled={!img}>Fit to Canvas</button>
            <button onClick={handleCenterArtwork} disabled={!img}>Center Design</button>
            <button onClick={handleAutoFixSafetyBorder} disabled={!img || !originalBounds}>Fix Safety Border</button>
            <button onClick={handleAutoFixTooSmall} disabled={!img || !originalBounds}>Scale Design Up</button>
          </>
        )}
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 800, color: '#bae6fd' }}>Canvas Zoom</span>

        <button onClick={() => { setViewMode('pod'); setActionMessage('POD Canvas view selected.'); }} disabled={!img}>POD Canvas</button>
        <button onClick={() => { setViewMode('design'); setActionMessage('Design & Zoom view selected.'); }} disabled={!img}>
          Design & Zoom
        </button>
        

        
      </div>

      

     
    </div>
  );
}