'use client';

import React from 'react';
import type { CheckItem } from '../lib/podCheckerTypes';
import type { RedbubblePresetId } from '../lib/redbubblePresets';
import { redbubblePresets } from '../lib/redbubblePresets';
import type { PrintfulPresetId } from '../lib/printfulPresets';
import { printfulPresets } from '../lib/printfulPresets';

type IssueBucketsPanelProps = {
  isScanning: boolean;
  img: HTMLImageElement | null;
  checks?: CheckItem[];
  downloadMessage?: string;
  standardTargetLine: string;
  redbubbleTargetLine: string;
  printfulTargetLine: string;
  teePublicTargetLine: string;
  selectedRedbubbleDownloadLabel: string;
  selectedPrintfulDownloadLabel: string;
  teePublicDownloadLabel: string;
  selectedRedbubblePreset: RedbubblePresetId;
  setSelectedRedbubblePreset: React.Dispatch<React.SetStateAction<RedbubblePresetId>>;
  selectedPrintfulPreset: PrintfulPresetId;
  setSelectedPrintfulPreset: React.Dispatch<React.SetStateAction<PrintfulPresetId>>;
  setActivePresetSystem: React.Dispatch<
    React.SetStateAction<'redbubble' | 'printful' | 'teepublic'>
  >;
  handleDownloadApparelPng: () => void;
  handleDownloadRedbubblePng: () => void;
  handleDownloadPrintfulPng: () => void;
  handleDownloadTeePublicPng: () => void;
};

export default function IssueBucketsPanel({
  isScanning,
  img,
  checks = [],
  downloadMessage = '',
  standardTargetLine,
  redbubbleTargetLine,
  printfulTargetLine,
  teePublicTargetLine,
  selectedRedbubbleDownloadLabel,
  selectedPrintfulDownloadLabel,
  teePublicDownloadLabel,
  selectedRedbubblePreset,
  setSelectedRedbubblePreset,
  selectedPrintfulPreset,
  setSelectedPrintfulPreset,
  setActivePresetSystem,
  handleDownloadApparelPng,
  handleDownloadRedbubblePng,
  handleDownloadPrintfulPng,
  handleDownloadTeePublicPng,
}: IssueBucketsPanelProps) {
  const toSafeSlug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const selectedRedbubblePresetData =
    redbubblePresets.find((preset) => preset.id === selectedRedbubblePreset) ?? redbubblePresets[0];
  const selectedPrintfulPresetData =
    printfulPresets.find((preset) => preset.id === selectedPrintfulPreset) ?? printfulPresets[0];

  const standardFileName = 'pod-checker-standard-apparel-4200x4800.png';
  const redbubbleFileName = `${toSafeSlug(selectedRedbubblePresetData.label) || 'pod-checker-export'}-${selectedRedbubblePresetData.width}x${selectedRedbubblePresetData.height}.png`;
  const printfulFileName = `${toSafeSlug(selectedPrintfulPresetData.label) || 'pod-checker-export'}-${selectedPrintfulPresetData.width}x${selectedPrintfulPresetData.height}.png`;
  const teePublicFileName = 'teepublic-5000x5500.png';

  const fileNameLineStyle: React.CSSProperties = {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 1.4,
    wordBreak: 'break-all',
  };

  const stepLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 900,
    color: '#93c5fd',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  type UploadTarget = 'standard' | 'redbubble' | 'printful' | 'teepublic';
  const [uploadTarget, setUploadTarget] = React.useState<UploadTarget>('standard');

  const uploadTargetOptions: { id: UploadTarget; label: string }[] = [
    { id: 'standard', label: 'Standard POD' },
    { id: 'redbubble', label: 'Redbubble' },
    { id: 'printful', label: 'Printful' },
    { id: 'teepublic', label: 'TeePublic' },
  ];

  const uploadTargetGuidance: Record<UploadTarget, { title: string; message: string }> = {
    standard: {
      title: 'Standard POD Focus',
      message:
        'Best general export for most POD shirt uploads. Use this when you are not sure which platform preset you need.',
    },
    redbubble: {
      title: 'Redbubble Focus',
      message: 'Use the Redbubble export when uploading apparel designs to Redbubble.',
    },
    printful: {
      title: 'Printful Focus',
      message: 'Use the Printful DTG/DTF export when uploading apparel designs to Printful.',
    },
    teepublic: {
      title: 'TeePublic Focus',
      message: 'Use the TeePublic export for TeePublic all-products upload.',
    },
  };

  const preUploadCheckConfig: Record<
    UploadTarget,
    { title: string; downloadKey: string; specificItem: string; downloadItem: string }
  > = {
    standard: {
      title: 'Standard POD Pre-Upload Check',
      downloadKey: 'Standard',
      specificItem: 'Use 4200 × 4800 apparel PNG',
      downloadItem: 'Download Standard Apparel PNG before upload',
    },
    redbubble: {
      title: 'Redbubble Pre-Upload Check',
      downloadKey: 'Redbubble',
      specificItem: 'Correct Redbubble preset selected',
      downloadItem: 'Download Redbubble PNG before upload',
    },
    printful: {
      title: 'Printful Pre-Upload Check',
      downloadKey: 'Printful',
      specificItem: 'Correct Printful DTG/DTF preset selected',
      downloadItem: 'Download Printful PNG before upload',
    },
    teepublic: {
      title: 'TeePublic Pre-Upload Check',
      downloadKey: 'TeePublic',
      specificItem: 'TeePublic all-products PNG ready',
      downloadItem: 'Download TeePublic PNG before upload',
    },
  };

  const exportSelectedLabel: Record<UploadTarget, string> = {
    standard: 'Standard apparel export available',
    redbubble: 'Redbubble export selected',
    printful: 'Printful export selected',
    teepublic: 'TeePublic export selected',
  };

  const hasActiveWarnings = checks.some(
    (check) => check.status === 'fail' || check.status === 'warn'
  );
  const currentConfig = preUploadCheckConfig[uploadTarget];
  const platformDownloaded =
    !!img &&
    downloadMessage.toLowerCase().includes('download ready') &&
    downloadMessage.toLowerCase().includes(currentConfig.downloadKey.toLowerCase());

  type ItemStatus = 'pass' | 'warn' | 'fail';
  const preUploadItems: { label: string; status: ItemStatus }[] = [
    { label: 'Design uploaded', status: img ? 'pass' : 'fail' },
    { label: exportSelectedLabel[uploadTarget], status: img ? 'pass' : 'warn' },
    { label: currentConfig.specificItem, status: img ? 'pass' : 'warn' },
    { label: 'Review remaining warnings', status: hasActiveWarnings ? 'warn' : 'pass' },
    {
      label: currentConfig.downloadItem,
      status: platformDownloaded ? 'pass' : img ? 'warn' : 'fail',
    },
  ];

  let preUploadStatus: 'READY TO UPLOAD' | 'REVIEW FIRST' | 'NOT READY';
  if (!img) {
    preUploadStatus = 'NOT READY';
  } else if (hasActiveWarnings || !platformDownloaded) {
    preUploadStatus = 'REVIEW FIRST';
  } else {
    preUploadStatus = 'READY TO UPLOAD';
  }

  const preUploadStatusColors: Record<
    typeof preUploadStatus,
    { color: string; background: string; border: string }
  > = {
    'READY TO UPLOAD': {
      color: '#86efac',
      background: 'rgba(22, 163, 74, 0.15)',
      border: '1px solid rgba(134, 239, 172, 0.30)',
    },
    'REVIEW FIRST': {
      color: '#facc15',
      background: 'rgba(250, 204, 21, 0.12)',
      border: '1px solid rgba(250, 204, 21, 0.30)',
    },
    'NOT READY': {
      color: '#f87171',
      background: 'rgba(248, 113, 113, 0.12)',
      border: '1px solid rgba(248, 113, 113, 0.30)',
    },
  };

  const itemMark: Record<ItemStatus, { mark: string; color: string }> = {
    pass: { mark: '✓', color: '#86efac' },
    warn: { mark: '⚠', color: '#facc15' },
    fail: { mark: '✕', color: '#f87171' },
  };

  const baseBoxStyle: React.CSSProperties = {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: 14,
    padding: 12,
    background: 'rgba(15, 23, 42, 0.55)',
    display: 'grid',
    gap: 8,
  };

  const selectedBoxStyle: React.CSSProperties = {
    border: '1px solid rgba(96, 165, 250, 0.75)',
    boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.20)',
    background: 'rgba(37, 99, 235, 0.10)',
  };

  const getBoxStyle = (target: UploadTarget): React.CSSProperties =>
    uploadTarget === target ? { ...baseBoxStyle, ...selectedBoxStyle } : baseBoxStyle;

  const recommendedLineStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 900,
    color: '#bfdbfe',
  };

  const renderStandardExportBox = () => (
    <div key="standard" style={getBoxStyle('standard')}>
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>
        Standard Apparel Export
      </div>
      {uploadTarget === 'standard' && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      <div>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 900,
            color: '#bbf7d0',
            background: 'rgba(22, 163, 74, 0.18)',
            border: '1px solid rgba(134, 239, 172, 0.30)',
            borderRadius: 999,
            padding: '4px 8px',
          }}
        >
          Recommended first
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
        Best starting point for most POD shirt uploads.
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
        Best for: general POD shirt uploads.
      </div>
      <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
        {standardTargetLine}
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1' }}>
        Generic 4200 × 4800 apparel PNG, not tied to one company.
      </div>
      <div style={stepLabelStyle}>Download PNG</div>
      <button
        onClick={() => {
          if (!img) return;
          handleDownloadApparelPng();
        }}
        aria-disabled={!img}
        style={{
          width: '100%',
          background: '#2563eb',
          color: '#ffffff',
          fontWeight: 800,
          borderRadius: 12,
          padding: '12px 16px',
          opacity: img ? 1 : 0.55,
          boxShadow: img ? '0 10px 20px rgba(37, 99, 235, 0.30)' : 'none',
          cursor: img ? 'pointer' : 'not-allowed',
        }}
      >
        Download Standard Apparel PNG — 4200 × 4800
      </button>
      <div style={fileNameLineStyle}>File name: {standardFileName}</div>
    </div>
  );

  const renderRedbubbleExportBox = () => (
    <div key="redbubble" style={getBoxStyle('redbubble')}>
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>
        Redbubble Export
      </div>
      {uploadTarget === 'redbubble' && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
        Best for: Redbubble apparel presets.
      </div>
      <div style={stepLabelStyle}>Step 1: Choose export size</div>
      <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800 }}>
        Export Size
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        Choose size, then press the blue download button.
      </div>
      <select
        value={selectedRedbubblePreset}
        onChange={(e) => {
          setSelectedRedbubblePreset(e.target.value as RedbubblePresetId);
          setActivePresetSystem('redbubble');
        }}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      >
        {redbubblePresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label} — {preset.width} × {preset.height}
          </option>
        ))}
      </select>
      <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
        {redbubbleTargetLine}
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1' }}>
        Resized for the selected Redbubble preset.
      </div>
      <div style={stepLabelStyle}>Step 2: Download PNG</div>
      <button
        onClick={() => {
          if (!img) return;
          handleDownloadRedbubblePng();
        }}
        aria-disabled={!img}
        style={{
          width: '100%',
          background: '#3b82f6',
          color: '#ffffff',
          fontWeight: 900,
          borderRadius: 12,
          padding: '12px 16px',
          boxShadow: '0 0 0 1px rgba(147, 197, 253, 0.35), 0 10px 22px rgba(59, 130, 246, 0.35)',
          opacity: img ? 1 : 0.65,
          cursor: img ? 'pointer' : 'not-allowed',
        }}
      >
        {selectedRedbubbleDownloadLabel}
      </button>
      <div style={fileNameLineStyle}>File name: {redbubbleFileName}</div>
    </div>
  );

  const renderPrintfulExportBox = () => (
    <div key="printful" style={getBoxStyle('printful')}>
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>
        Printful Export
      </div>
      {uploadTarget === 'printful' && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
        Best for: Printful DTG/DTF apparel.
      </div>
      <div style={stepLabelStyle}>Step 1: Choose export size</div>
      <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800 }}>
        Export Size
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        Choose size, then press the blue download button.
      </div>
      <select
        value={selectedPrintfulPreset}
        onChange={(e) => {
          setSelectedPrintfulPreset(e.target.value as PrintfulPresetId);
          setActivePresetSystem('printful');
        }}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      >
        {printfulPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label} — {preset.width} × {preset.height}
          </option>
        ))}
      </select>
      <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
        {printfulTargetLine}
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1' }}>
        Resized for the selected Printful preset.
      </div>
      <div style={stepLabelStyle}>Step 2: Download PNG</div>
      <button
        onClick={() => {
          if (!img) return;
          handleDownloadPrintfulPng();
        }}
        aria-disabled={!img}
        style={{
          width: '100%',
          background: '#3b82f6',
          color: '#ffffff',
          fontWeight: 900,
          borderRadius: 12,
          padding: '12px 16px',
          boxShadow: '0 0 0 1px rgba(147, 197, 253, 0.35), 0 10px 22px rgba(59, 130, 246, 0.35)',
          opacity: img ? 1 : 0.65,
          cursor: img ? 'pointer' : 'not-allowed',
        }}
      >
        {selectedPrintfulDownloadLabel}
      </button>
      <div style={fileNameLineStyle}>File name: {printfulFileName}</div>
    </div>
  );

  const renderTeePublicExportBox = () => (
    <div key="teepublic" style={getBoxStyle('teepublic')}>
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>
        TeePublic Export
      </div>
      {uploadTarget === 'teepublic' && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
        Best for: TeePublic all-products upload.
      </div>
      <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
        {teePublicTargetLine}
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1' }}>
        Resized for TeePublic all-products export.
      </div>
      <div style={stepLabelStyle}>Download PNG</div>
      <button
        onClick={() => {
          if (!img) return;
          handleDownloadTeePublicPng();
        }}
        aria-disabled={!img}
        style={{
          width: '100%',
          background: '#3b82f6',
          color: '#ffffff',
          fontWeight: 900,
          borderRadius: 12,
          padding: '12px 16px',
          boxShadow: '0 0 0 1px rgba(147, 197, 253, 0.35), 0 10px 22px rgba(59, 130, 246, 0.35)',
          opacity: img ? 1 : 0.65,
          cursor: img ? 'pointer' : 'not-allowed',
        }}
      >
        {teePublicDownloadLabel}
      </button>
      <div style={fileNameLineStyle}>File name: {teePublicFileName}</div>
    </div>
  );

  const exportBoxRenderers: Record<UploadTarget, () => React.JSX.Element> = {
    standard: renderStandardExportBox,
    redbubble: renderRedbubbleExportBox,
    printful: renderPrintfulExportBox,
    teepublic: renderTeePublicExportBox,
  };

  const orderedExportTargets: UploadTarget[] = [
    uploadTarget,
    ...uploadTargetOptions
      .map((option) => option.id)
      .filter((id) => id !== uploadTarget),
  ];

  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 16,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: '0 25px 70px rgba(0,0,0,0.35)',
        minWidth: 0,
        alignSelf: 'start',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Export & Download</div>
        <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 13, lineHeight: 1.4 }}>
          Choose a platform preset or download the standard apparel PNG.
        </div>
      </div>
      <div
        style={{
          marginBottom: 12,
          fontSize: 12,
          color: img ? '#86efac' : '#facc15',
          fontWeight: 800,
          lineHeight: 1.4,
          padding: '8px 10px',
          borderRadius: 10,
          background: img ? 'rgba(22, 163, 74, 0.12)' : 'rgba(250, 204, 21, 0.12)',
          border: img
            ? '1px solid rgba(134, 239, 172, 0.25)'
            : '1px solid rgba(250, 204, 21, 0.25)',
        }}
      >
        {img
          ? 'Ready to export. Choose a size, then press the blue download button.'
          : 'Upload a design to enable downloads.'}
      </div>
      <div
        style={{
          marginBottom: 12,
          padding: 10,
          borderRadius: 12,
          background: 'rgba(37, 99, 235, 0.10)',
          border: '1px solid rgba(147, 197, 253, 0.25)',
          color: '#cbd5e1',
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        <div style={{ fontWeight: 800, color: '#bfdbfe', marginBottom: 4 }}>
          Recommended Export
        </div>
        <div>
          Start with Standard Apparel PNG for most POD shirt uploads. Use
          Redbubble, Printful, or TeePublic exports only when uploading to those
          platforms.
        </div>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Standard Apparel: best general starting point</li>
          <li>Redbubble: use for Redbubble apparel upload</li>
          <li>Printful: use for Printful DTG/DTF apparel</li>
          <li>TeePublic: use for TeePublic all-products upload</li>
        </ul>
      </div>
      <div
        style={{
          marginBottom: 12,
          padding: 10,
          borderRadius: 12,
          background: 'rgba(37, 99, 235, 0.10)',
          border: '1px solid rgba(147, 197, 253, 0.25)',
        }}
      >
        <div style={{ fontWeight: 800, color: '#bfdbfe', fontSize: 12, marginBottom: 6 }}>
          Where are you uploading?
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {uploadTargetOptions.map((option) => {
            const isSelected = uploadTarget === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setUploadTarget(option.id)}
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 999,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  color: isSelected ? '#ffffff' : '#cbd5e1',
                  background: isSelected ? '#2563eb' : 'rgba(255,255,255,0.06)',
                  border: isSelected
                    ? '1px solid rgba(96, 165, 250, 0.75)'
                    : '1px solid rgba(148, 163, 184, 0.25)',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 12,
            background: 'rgba(37, 99, 235, 0.10)',
            border: '1px solid rgba(147, 197, 253, 0.25)',
            color: '#cbd5e1',
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 800, color: '#bfdbfe', marginBottom: 4 }}>
            {uploadTargetGuidance[uploadTarget].title}
          </div>
          <div>{uploadTargetGuidance[uploadTarget].message}</div>
        </div>
      </div>
      <div
        style={{
          marginBottom: 12,
          padding: 12,
          borderRadius: 14,
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(147, 197, 253, 0.25)',
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 800, color: '#e2e8f0', fontSize: 13 }}>
          {currentConfig.title}
        </div>
        <div
          style={{
            display: 'inline-block',
            justifySelf: 'start',
            fontSize: 11,
            fontWeight: 900,
            borderRadius: 999,
            padding: '4px 10px',
            color: preUploadStatusColors[preUploadStatus].color,
            background: preUploadStatusColors[preUploadStatus].background,
            border: preUploadStatusColors[preUploadStatus].border,
          }}
        >
          {preUploadStatus}
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          {preUploadItems.map((item) => (
            <div
              key={item.label}
              style={{
                fontSize: 12,
                color: '#cbd5e1',
                lineHeight: 1.4,
                display: 'flex',
                gap: 8,
              }}
            >
              <span style={{ color: itemMark[item.status].color, fontWeight: 900 }}>
                {itemMark[item.status].mark}
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      {isScanning && (
        <div
          style={{
            marginBottom: 14,
            padding: '8px 12px',
            borderRadius: 14,
            background: 'rgba(59,130,246,0.14)',
            border: '1px solid rgba(59,130,246,0.35)',
            color: '#dbeafe',
            fontWeight: 700,
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          Scanning design...
        </div>
      )}

      <div style={{ marginBottom: 14, display: 'grid', gap: 12 }}>
        {orderedExportTargets.map((target) => exportBoxRenderers[target]())}
      </div>

    </div>
  );
}
