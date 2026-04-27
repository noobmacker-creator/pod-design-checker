'use client';

import React from 'react';
import type { ViewMode } from '../lib/podCheckerTypes';

type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type ScanResultsPanelProps = {
  file: File | null;
  actionMessage: string;
  downloadMessage: string;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  setActionMessage: React.Dispatch<React.SetStateAction<string>>;
  handleQuickFix: () => void;
  img: HTMLImageElement | null;
  checks: any[];
  printScore: number;
  hasTransparency: boolean | null;
  thinLinePercent: number;
  specks: number;
  imgW: number;
  imgH: number;
  effectiveBounds: Bounds | null;
  coverage: number;
  transform: { scale: number; offsetX: number; offsetY: number };
  previewSize: number;
  inspectZoom: number;
  practicalPrintDpi: number;
  targetCanvasW: number;
  targetCanvasH: number;
};

export default function ScanResultsPanel({
  file,
  actionMessage,
  downloadMessage,
  handleFileChange,
  viewMode,
  setViewMode,
  setActionMessage,
  handleQuickFix,
  img,
  printScore,
  hasTransparency,
  thinLinePercent,
  specks,
  imgW,
  imgH,
  effectiveBounds,
  coverage,
  transform,
  previewSize,
  inspectZoom,
  practicalPrintDpi,
  targetCanvasW,
  targetCanvasH,
}: ScanResultsPanelProps) {
  const exactSize = imgW === targetCanvasW && imgH === targetCanvasH;
  const largerThanTarget = imgW >= targetCanvasW && imgH >= targetCanvasH;
  const slightlySmaller = imgW / targetCanvasW >= 0.85 && imgH / targetCanvasH >= 0.85;

  const riskLabel =
    !img
      ? 'UPLOAD A DESIGN'
      : hasTransparency === false || printScore < 60
      ? 'HIGH RISK'
      : 100 - printScore >= 30
      ? 'MEDIUM RISK'
      : 'READY';

  const riskBg =
    !img
      ? '#1e293b'
      : hasTransparency === false || printScore < 60
      ? '#7f1d1d'
      : 100 - printScore >= 30
      ? '#78350f'
      : '#14532d';

  const mainIssue =
    !img
      ? '—'
      : hasTransparency === false
      ? 'No transparency'
      : thinLinePercent >= 18
      ? 'Too many thin lines'
      : specks > 0
      ? 'Specks detected'
      : exactSize
      ? 'Ready for selected target'
      : largerThanTarget
      ? 'Larger than selected target'
      : slightlySmaller
      ? 'Smaller than selected target'
      : 'Much smaller than selected target';

  const nextStep =
    !img
      ? 'Upload a design to begin.'
      : hasTransparency === false
      ? 'Add transparent background.'
      : thinLinePercent >= 18
      ? 'Thicken thin lines.'
      : specks > 0
      ? 'Clean specks / noise.'
      : slightlySmaller || !exactSize
      ? `Use Auto Fix, then export for ${targetCanvasW} × ${targetCanvasH}.`
      : `Export for ${targetCanvasW} × ${targetCanvasH}.`;

  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 16,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        alignSelf: 'start',
        display: 'grid',
        gap: 14,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div
          style={{
            padding: 12,
            borderRadius: 16,
            background: 'rgba(15,23,42,0.72)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'grid',
            gap: 10,
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
              display: 'grid',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 8,
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
                style={{ opacity: viewMode === 'pod' ? 1 : 0.85 }}
                disabled={!img}
              >
                POD Canvas
              </button>

              <button
                onClick={() => {
                  setViewMode('design');
                  setActionMessage('Design view selected.');
                }}
                style={{ opacity: viewMode === 'design' ? 1 : 0.85 }}
                disabled={!img}
              >
                Design
              </button>
            </div>

            <button
              onClick={handleQuickFix}
              disabled={!img}
              style={{
                background: '#2563eb',
              }}
            >
              Auto Fix
            </button>
          </div>
        </div>

        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Summary</h2>
          <p
            style={{
              marginTop: 6,
              marginBottom: 0,
              color: '#cbd5e1',
              lineHeight: 1.5,
              fontSize: 14,
            }}
          >
            Upload your design, review the result, then fix issues before export.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <label
          htmlFor="design-upload"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: 12,
            borderRadius: 12,
            background: '#2563eb',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          Upload design
        </label>

        <input
          id="design-upload"
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {!file ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(15,23,42,0.62)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#cbd5e1',
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            Upload a PNG to check size, placement, transparency, and print safety.
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          {file ? (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 12,
                background: 'rgba(15,23,42,0.82)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fdba74',
                fontSize: 12,
                fontWeight: 700,
                width: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
              title={file.name}
            >
              {file.name}
            </div>
          ) : null}

          <div
            style={{
              padding: '6px 10px',
              borderRadius: 12,
              background: 'rgba(15,23,42,0.82)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#cbd5e1',
              fontSize: 12,
              fontWeight: 700,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            Status: {actionMessage}
          </div>

          {downloadMessage ? (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 12,
                background: 'rgba(8,47,73,0.72)',
                border: '1px solid rgba(56,189,248,0.25)',
                color: '#7dd3fc',
                fontSize: 12,
                fontWeight: 700,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {downloadMessage}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Scan Report</h2>
      <div
        style={{
          padding: 14,
          borderRadius: 16,
          background: 'rgba(2,6,23,0.92)',
          border: '1px solid rgba(56,189,248,0.28)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 13, color: '#ffffff', fontWeight: 800, letterSpacing: 0.4 }}>
            PRINT READINESS
          </div>

          <div
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              background: riskBg,
            }}
          >
            {riskLabel}
          </div>
        </div>

        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            color:
              printScore >= 80 ? '#22c55e' : printScore >= 50 ? '#f59e0b' : '#ef4444',
            lineHeight: 1,
            marginBottom: 10,
          }}
        >
          {printScore}%
        </div>

        <div
          style={{
            width: '100%',
            height: 14,
            borderRadius: 999,
            background: 'rgba(15,23,42,0.85)',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: `${printScore}%`,
              height: '100%',
              borderRadius: 999,
              background:
                printScore >= 80 ? '#22c55e' : printScore >= 50 ? '#f59e0b' : '#ef4444',
              transition: 'width 0.5s ease',
            }}
          />
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(15,23,42,0.68)',
              border: '1px solid rgba(255,255,255,0.10)',
              fontSize: 14,
              lineHeight: 1.45,
            }}
          >
            <span style={{ fontWeight: 800 }}>Main Issue:</span> {mainIssue}
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(15,23,42,0.68)',
              border: '1px solid rgba(255,255,255,0.10)',
              fontSize: 14,
              lineHeight: 1.45,
            }}
          >
            <span style={{ fontWeight: 800 }}>Next Step:</span> {nextStep}
          </div>
        </div>
      </div>
      </div>

      {img && effectiveBounds ? (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            background: 'rgba(15,23,42,0.75)',
            border: '1px solid rgba(34,197,94,0.22)',
            display: 'grid',
            gap: 6,
            fontSize: 13,
            lineHeight: 1.45,
            color: '#e5e7eb',
          }}
        >
          <div style={{ fontWeight: 800, color: '#86efac' }}>Artwork Info</div>
          <div>
            Width fill: <strong>{((effectiveBounds.w / 4200) * 100).toFixed(1)}%</strong>
          </div>
          <div>
            Height fill: <strong>{((effectiveBounds.h / 4800) * 100).toFixed(1)}%</strong>
          </div>
          <div>
            Coverage: <strong>{coverage.toFixed(1)}%</strong>
          </div>
          <div>
            Scale: <strong>{(transform.scale * 100).toFixed(1)}%</strong>
          </div>
          <div>
            Preview: <strong>{Math.round(previewSize * 100)}%</strong>
          </div>
          <div>
            Inspect Zoom: <strong>{inspectZoom * 100}%</strong>
          </div>
          <div>
            Practical DPI: <strong>{practicalPrintDpi || '-'}</strong>
          </div>
        </div>
      ) : null}

      <div
        style={{
          padding: '10px 12px',
          borderRadius: 12,
          background: 'rgba(15,23,42,0.45)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#94a3b8',
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        V1 focuses on shirt-size print checks. More POD sizes coming soon.
      </div>
    </div>
  );
}