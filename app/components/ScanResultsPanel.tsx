'use client';

import React from 'react';
import type { CheckItem, CheckStatus } from '../lib/podCheckerTypes';
import { statusColor, statusIcon } from '../lib/podCheckerUtils';

type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type ScanResultsPanelProps = {
  img: HTMLImageElement | null;
  checks: CheckItem[];
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
};

export default function ScanResultsPanel({
  img,
  checks,
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
}: ScanResultsPanelProps) {
  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 1,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
        alignSelf: 'start',
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 6, fontSize: 20, fontWeight: 800, letterSpacing: 0.4 }}>
        Scan Results
      </h2>
      <p style={{ marginTop: 0, marginBottom: 20, color: '#cbd5e1', lineHeight: 1.6, fontSize: 15 }}>
        Review critical issues first, then warnings, before exporting your final print file.
      </p>

      <div
        style={{
          marginBottom: 10,
          padding: 12,
          borderRadius: 10,
          background: 'linear-gradient(180deg, #020617 0%, #020617 60%, #020617cc 100%)',
          border: '2px solid rgba(56,189,248,0.6)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 14, color: '#ffffff', fontWeight: 700 }}>
          PRINT READINESS
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            color:
              printScore >= 80
                ? '#22c55e'
                : printScore >= 50
                ? '#f59e0b'
                : '#ef4444',
          }}
        >
          {printScore}%
          <div
            style={{
              marginTop: 12,
              width: '100%',
              height: 18,
              borderRadius: 999,
              background: 'rgba(15,23,42,0.85)',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                width: `${printScore}%`,
                height: '100%',
                borderRadius: 999,
                background:
                  printScore >= 80
                    ? '#22c55e'
                    : printScore >= 50
                    ? '#f59e0b'
                    : '#ef4444',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
          <div style={{ marginTop: 12, fontWeight: 800 }}>
            {hasTransparency === false
              ? 'HIGH RISK'
              : printScore < 60
              ? 'MEDIUM RISK'
              : 'READY FOR PRINT'}
          </div>
          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 12,
              background: '#020617',
              border: '1px solid #334155',
            }}
          >
            <div
              style={{
                marginBottom: 12,
                padding: '10px 14px',
                borderRadius: 8,
                fontWeight: 700,
                textAlign: 'center',
                background:
                  !img
                    ? '#1e293b'
                    : hasTransparency === false || printScore < 60
                    ? '#7f1d1d'
                    : 100 - printScore >= 30
                    ? '#78350f'
                    : '#14532d',
              }}
            >
              {!img
                ? 'UPLOAD A DESIGN TO BEGIN'
                : hasTransparency === false || printScore < 60
                ? '🔴 HIGH RISK'
                : 100 - printScore >= 30
                ? '🟡 MEDIUM RISK'
                : '🟢 LOW RISK'}
            </div>

            <div style={{ fontWeight: 700, marginBottom: hasTransparency === false || printScore < 60 || 100 - printScore >= 30 ? 6 : 2 }}>
              {hasTransparency === false || printScore < 60 || 100 - printScore >= 30 ? 'Scan Summary' : 'Ready'}
            </div>

            <div
              style={{
                height: 1,
                background: '#334155',
                marginBottom: hasTransparency === false || printScore < 60 || 100 - printScore >= 30 ? 10 : 6,
              }}
            />

            <div style={{ marginBottom: hasTransparency === false || printScore < 60 || 100 - printScore >= 30 ? 10 : 6, fontWeight: 600 }}>
              <div style={{ padding: 18, borderRadius: 16, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <span style={{ fontWeight: 800 }}>Main Issue:</span>
                {!img
                  ? '—'
                  : hasTransparency === false
                  ? ' No transparency'
                  : thinLinePercent >= 18
                  ? ' Too many thin lines'
                  : specks > 0
                  ? ' Specks detected'
                  : imgW !== 4200 || imgH !== 4800
                  ? ' Wrong size'
                  : ' No major issues'}
              </div>

              {hasTransparency === false || printScore < 60 || 100 - printScore >= 30 ? (
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 800 }}>Next Step:</span>
                  {!img
                    ? '—'
                    : hasTransparency === false
                    ? 'Add transparent background'
                    : thinLinePercent >= 18
                    ? 'Thicken thin lines'
                    : specks > 0
                    ? 'Clean specks / noise'
                    : imgW !== 4200 || imgH !== 4800
                    ? 'Resize to 4200×4800'
                    : 'Ready to download'}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {!img && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: 'rgba(15,23,42,0.85)',
            color: '#cbd5e1',
          }}
        >
          Upload your design to start scanning.
        </div>
      )}

      {checks.filter((item) => item.status === 'fail').length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              marginBottom: 10,
              padding: '10px 14px',
              borderRadius: 10,
              background: '#7f1d1d',
              color: '#fff',
              fontWeight: 800,
            }}
          >
            Critical Issues
          </div>

          {checks
            .filter((item) => item.status === 'fail')
            .map((item, index) => (
              <div
                key={`${item.label}-fail-${index}`}
                style={{
                  marginBottom: 8,
                  borderRadius: 10,
                  padding: 10,
                  background: 'linear-gradient(180deg, rgba(127,29,29,0.55), rgba(15,23,42,0.92))',
                  border: `1px solid ${statusColor(item.status)}66`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 700,
                    marginBottom: 6,
                    color: statusColor(item.status),
                  }}
                >
                  <span>{statusIcon(item.status)}</span>
                  <span>{item.label}</span>
                </div>
                <div style={{ color: '#e5e7eb', lineHeight: 1.5 }}>
                  {item.message}
                </div>

                <div style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
                  {item.status === 'fail'
                    ? 'Fix: This must be corrected before printing.'
                    : item.status === 'warn'
                    ? 'Fix: Improve this for better print quality.'
                    : ''}
                </div>
              </div>
            ))}
        </div>
      )}

      {checks.filter((item) => item.status === 'warn').length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              marginBottom: 10,
              padding: '10px 14px',
              borderRadius: 10,
              background: '#78350f',
              color: '#fff',
              fontWeight: 800,
            }}
          >
            Warnings
          </div>

          {checks
            .filter((item) => item.status === 'warn')
            .map((item, index) => (
              <div
                key={`${item.label}-warn-${index}`}
                style={{
                  marginBottom: 8,
                  borderRadius: 10,
                  padding: 10,
                  background: 'linear-gradient(180deg, rgba(154,52,18,0.45), rgba(15,23,42,0.92))',
                  border: `1px solid ${statusColor(item.status)}66`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 700,
                    marginBottom: 6,
                    color: statusColor(item.status),
                  }}
                >
                  <span>{statusIcon(item.status)}</span>
                  <span>{item.label}</span>
                </div>
                <div style={{ color: '#e5e7eb', lineHeight: 1.5 }}>{item.message}</div>
              </div>
            ))}
        </div>
      )}

      {checks.filter((item) => item.status === 'pass' || item.status === 'info').length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              marginBottom: 10,
              padding: '10px 14px',
              borderRadius: 10,
              background: '#14532d',
              color: '#fff',
              fontWeight: 800,
            }}
          >
            Passed Checks
          </div>

          {checks
            .filter((item) => item.status === 'pass' || item.status === 'info')
            .map((item, index) => (
              <div
                key={`${item.label}-pass-${index}`}
                style={{
                  marginBottom: 8,
                  borderRadius: 10,
                  padding: 10,
                  background:
                    item.status === 'pass'
                      ? 'linear-gradient(180deg, rgba(20,83,45,0.45), rgba(15,23,42,0.92))'
                      : '#0f172a',
                  border: `1px solid ${statusColor(item.status)}66`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 700,
                    marginBottom: 6,
                    color: statusColor(item.status),
                  }}
                >
                  <span>{statusIcon(item.status)}</span>
                  <span>{item.label}</span>
                </div>
                <div style={{ color: '#e5e7eb', lineHeight: 1.5 }}>{item.message}</div>
              </div>
            ))}
        </div>
      )}

      {img && effectiveBounds && (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 14,
            background: 'rgba(15,23,42,0.75)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(34,197,94,0.35)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#22c55e' }}>
            Artwork Fill Info
          </div>
          <div style={{ color: '#e5e7eb', lineHeight: 1.5 }}>
            Width fill: <strong>{((effectiveBounds.w / 4200) * 100).toFixed(1)}%</strong>
            <br />
            Height fill: <strong>{((effectiveBounds.h / 4800) * 100).toFixed(1)}%</strong>
            <br />
            Coverage sample: <strong>{coverage.toFixed(1)}%</strong>
            <br />
            Current scale: <strong>{(transform.scale * 100).toFixed(1)}%</strong>
            <br />
            Preview size: <strong>{Math.round(previewSize * 100)}%</strong>
            <br />
            Inspect zoom: <strong>{inspectZoom * 100}%</strong>
          </div>
        </div>
      )}

      {img && (
        <div
          style={{
            marginTop: 20,
            borderRadius: 16,
            padding: 16,
            background: 'rgba(2,6,23,0.9)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 12, fontWeight: 800 }}>
            Important POD Notes
          </h3>

          <p style={{ marginTop: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
            Important: <strong>300 DPI metadata by itself does not guarantee the file is correct for POD.</strong>{' '}
            What matters most is the pixel size and whether the art sits properly on the canvas.
          </p>

          <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
            <strong>Print Resolution</strong> is the practical POD check. DPI metadata can be shown for information,
            but printers care mainly about pixel dimensions and layout quality.
          </p>

          <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
            The <span style={{ color: '#ef4444', fontWeight: 700 }}>red dashed overlay</span> shows the safety border,
            the <span style={{ color: '#3b82f6', fontWeight: 700 }}> blue dashed box</span> shows the safe print zone,
            the <span style={{ color: '#22c55e', fontWeight: 700 }}> green box</span> shows detected artwork bounds,
            and the <span style={{ color: '#facc15', fontWeight: 700 }}> yellow center marker</span> shows the artwork center.
          </p>

          <p style={{ marginBottom: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
            Recommended shirt workflow: <strong>4200 × 4800 px</strong>, PNG, transparent background, RGB / sRGB.
          </p>
        </div>
      )}
    </div>
  );
}