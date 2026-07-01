'use client';

import React, { useMemo, useState } from 'react';
import type { CheckItem } from '../lib/podCheckerTypes';
export type PreviewBackground = 'checker' | 'white' | 'black' | 'navy' | 'dark-grey' | 'red' | 'pink' | 'custom';

export const PREVIEW_BACKGROUND_COLORS: Record<Exclude<PreviewBackground, 'checker' | 'custom'>, string> = {
  white: '#ffffff',
  black: '#000000',
  navy: '#1e3a8a',
  'dark-grey': '#4b5563',
  red: '#dc2626',
  pink: '#f472b6',
};

function getPreviewBackgroundStyle(
  previewBg: PreviewBackground,
  customColor?: string,
): React.CSSProperties {
  if (previewBg === 'checker') {
    return {
      backgroundColor: '#1f1f1f',
      backgroundImage: `
        linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
        linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
        linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
      `,
      backgroundSize: '36px 36px',
      backgroundPosition: '0 0, 0 18px, 18px -18px, -18px 0px',
    };
  }

  if (previewBg === 'custom') {
    return {
      backgroundColor: customColor || '#808080',
    };
  }

  return {
    backgroundColor: PREVIEW_BACKGROUND_COLORS[previewBg],
  };
}

const PREVIEW_BACKGROUND_OPTIONS: { id: PreviewBackground; label: string }[] = [
  { id: 'checker', label: 'Transparent' },
  { id: 'white', label: 'White' },
  { id: 'black', label: 'Black' },
  { id: 'navy', label: 'Navy' },
  { id: 'dark-grey', label: 'Dark Grey' },
  { id: 'red', label: 'Red' },
  { id: 'pink', label: 'Pink' },
];

type DesignPreviewPanelProps = {
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  previewCanvasW: number;
  previewCanvasH: number;
  totalScale: number;
  previewBackground: PreviewBackground;
  setPreviewBackground: React.Dispatch<React.SetStateAction<PreviewBackground>>;
  setActionMessage: React.Dispatch<React.SetStateAction<string>>;
  autoFixApplied?: boolean;
  autoFixPreviewMode?: 'fixed' | 'original';
  setAutoFixPreviewMode?: React.Dispatch<React.SetStateAction<'fixed' | 'original'>>;
  isScanning?: boolean;
  img?: HTMLImageElement | null;
  checks?: CheckItem[];
};

function shirtNameFromLabel(label: string) {
  return label.replace(/^Shirt Fit:\s*/, '');
}

function groupShirtFitChecks(checks: CheckItem[]) {
  const shirtItems = checks.filter((item) => item.label.startsWith('Shirt Fit:'));
  if (shirtItems.length === 0) return null;

  const strongest = shirtItems.filter((i) => i.status === 'pass').map((i) => shirtNameFromLabel(i.label));
  const checkFirst = shirtItems
    .filter((i) => i.status === 'warn' || i.status === 'info')
    .map((i) => shirtNameFromLabel(i.label));
  const mayBlend = shirtItems.filter((i) => i.status === 'fail').map((i) => shirtNameFromLabel(i.label));

  return { strongest, checkFirst, mayBlend };
}

function ShirtColourGuidancePanel({ checks }: { checks: CheckItem[] }) {
  const groups = useMemo(() => groupShirtFitChecks(checks), [checks]);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  if (!groups) return null;

  const expanded = pinnedOpen || hovered || focused;
  const compactBest =
    groups.strongest.length > 0 ? groups.strongest.join(', ') : 'No strong matches yet';

  return (
    <div
      role="region"
      aria-label="Shirt Colour Guidance"
      aria-expanded={expanded}
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={() => setPinnedOpen((open) => !open)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setPinnedOpen((open) => !open);
        }
      }}
      style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        maxWidth: 300,
        zIndex: 8,
        padding: '10px 12px',
        borderRadius: 12,
        background: expanded ? 'rgba(2, 6, 23, 0.97)' : 'rgba(2, 6, 23, 0.62)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        backdropFilter: 'blur(8px)',
        opacity: expanded ? 0.98 : 0.64,
        transition: 'opacity 0.2s ease, background 0.2s ease',
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 12, color: '#f8fafc', marginBottom: expanded ? 8 : 4 }}>
        Shirt Colour Guidance
      </div>

      {!expanded ? (
        <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.4 }}>
          Best on: {compactBest}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8, fontSize: 11, lineHeight: 1.45, color: '#e2e8f0' }}>
          {groups.strongest.length > 0 ? (
            <div>
              <div style={{ fontWeight: 800, color: '#86efac', marginBottom: 2 }}>Looks strongest on</div>
              <div>{groups.strongest.join(', ')}</div>
            </div>
          ) : null}
          {groups.checkFirst.length > 0 ? (
            <div>
              <div style={{ fontWeight: 800, color: '#fde68a', marginBottom: 2 }}>Check first</div>
              <div>{groups.checkFirst.join(', ')}</div>
            </div>
          ) : null}
          {groups.mayBlend.length > 0 ? (
            <div>
              <div style={{ fontWeight: 800, color: '#fca5a5', marginBottom: 2 }}>May blend</div>
              <div>{groups.mayBlend.join(', ')}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function DesignPreviewPanel({
  previewCanvasRef,
  previewCanvasW,
  previewCanvasH,
  totalScale,
  previewBackground,
  setPreviewBackground,
  setActionMessage,
  autoFixApplied = false,
  autoFixPreviewMode = 'fixed',
  setAutoFixPreviewMode,
  isScanning = false,
  img = null,
  checks = [],
}: DesignPreviewPanelProps) {
  const [customPreviewColor, setCustomPreviewColor] = useState('#808080');

  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 20,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: '0 25px 70px rgba(0,0,0,0.35)',
        minWidth: 0,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {autoFixApplied && setAutoFixPreviewMode ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, color: '#bae6fd', fontSize: 13 }}>View:</span>
          <button
            onClick={() => {
              setAutoFixPreviewMode('original');
              setActionMessage('Showing original upload preview.');
            }}
            style={{
              fontWeight: autoFixPreviewMode === 'original' ? 800 : 600,
              outline: autoFixPreviewMode === 'original' ? '2px solid #38bdf8' : undefined,
            }}
          >
            Original
          </button>
          <button
            onClick={() => {
              setAutoFixPreviewMode('fixed');
              setActionMessage('Showing Auto Fix preview.');
            }}
            style={{
              fontWeight: autoFixPreviewMode === 'fixed' ? 800 : 600,
              outline: autoFixPreviewMode === 'fixed' ? '2px solid #38bdf8' : undefined,
            }}
          >
            Fixed
          </button>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gap: 4,
          marginBottom: 8,
          flexShrink: 0,
        }}
        data-tour="shirt-colour-preview"
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#bae6fd', fontSize: 13 }}>Shirt Colour Preview:</span>
          {PREVIEW_BACKGROUND_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setPreviewBackground(option.id);
                setActionMessage(`Preview background set to ${option.label}.`);
              }}
              style={{
                fontWeight: previewBackground === option.id ? 800 : 600,
                outline: previewBackground === option.id ? '2px solid #38bdf8' : undefined,
              }}
            >
              {option.label}
            </button>
          ))}
          <label
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: previewBackground === 'custom' ? 800 : 600,
              borderRadius: 999,
              padding: '5px 10px 5px 12px',
              cursor: 'pointer',
              background: 'rgba(15, 23, 42, 0.72)',
              border:
                previewBackground === 'custom'
                  ? '1px solid rgba(56, 189, 248, 0.55)'
                  : '1px solid rgba(148, 163, 184, 0.35)',
              boxShadow:
                previewBackground === 'custom'
                  ? '0 0 0 1px rgba(56, 189, 248, 0.15)'
                  : 'none',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: 18,
                height: 18,
                borderRadius: 4,
                flexShrink: 0,
                border: '1px solid rgba(148, 163, 184, 0.45)',
                background:
                  'conic-gradient(red, orange, yellow, green, cyan, blue, purple, red)',
              }}
            />
            <span style={{ color: '#bae6fd', whiteSpace: 'nowrap' }}>Custom Colour</span>
            <input
              type="color"
              value={customPreviewColor}
              onChange={(e) => {
                setCustomPreviewColor(e.target.value);
                setPreviewBackground('custom');
                setActionMessage(`Preview background set to custom colour ${e.target.value}.`);
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                padding: 0,
                margin: 0,
                border: 'none',
                cursor: 'pointer',
                opacity: 0,
              }}
            />
          </label>
        </div>
      </div>

      <style>{`
        @keyframes scanOverlayPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 22px rgba(56, 189, 248, 0.28); }
          50% { opacity: 0.82; box-shadow: 0 0 32px rgba(56, 189, 248, 0.45); }
        }
      `}</style>

      <div
        style={{
          position: 'relative',
          width: '100%',
          flex: 1,
          minHeight: 0,
          height: 'auto',
          overflow: 'auto',
          borderRadius: 18,
          border: '2px solid #38bdf8',
          boxShadow: '0 0 0 1px rgba(56,189,248,0.25)',
          ...getPreviewBackgroundStyle(previewBackground, customPreviewColor),
          padding: 12,
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        {img && checks.length > 0 ? <ShirtColourGuidancePanel checks={checks} /> : null}

        {isScanning && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(2, 6, 23, 0.45)',
              backdropFilter: 'blur(2px)',
              borderRadius: 16,
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 14,
                background: 'rgba(15, 23, 42, 0.88)',
                border: '1px solid rgba(125, 211, 252, 0.45)',
                boxShadow: '0 0 22px rgba(56, 189, 248, 0.28)',
                textAlign: 'center',
                animation: 'scanOverlayPulse 1.6s ease-in-out infinite',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16, color: '#e0f2fe', marginBottom: 6 }}>
                Scanning design...
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.45 }}>
                Checking transparency, sizing, edges, and print safety.
              </div>
            </div>
          </div>
        )}
        <div
          style={{
            width: '100%',
            minWidth: '100%',
            minHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: `${previewCanvasW * totalScale}px`,
              height: `${previewCanvasH * totalScale}px`,
              flexShrink: 0,
              borderRadius: 12,
              overflow: 'hidden',
              background: 'transparent',
              border: 'none',
              outline: 'none',
            }}
          >
            <canvas
              ref={previewCanvasRef}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}