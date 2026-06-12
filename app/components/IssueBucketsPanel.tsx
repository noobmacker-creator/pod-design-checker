'use client';

import React from 'react';
import type { CheckItem } from '../lib/podCheckerTypes';
import type { ColourProfileStatus } from '../lib/podCheckerUtils';
import type { RedbubblePresetId } from '../lib/redbubblePresets';
import { redbubblePresets } from '../lib/redbubblePresets';
import type { PrintfulPresetId } from '../lib/printfulPresets';
import { printfulPresets } from '../lib/printfulPresets';

type PreflightMark = 'pass' | 'warn' | 'fail' | 'info';

type PreflightItem = {
  label: string;
  mark: PreflightMark;
  detail?: string;
};

type PrintfulOverallStatus = 'NOT READY' | 'REVIEW FIRST' | 'PRINTFUL READY';

type IssueBucketsPanelProps = {
  isScanning: boolean;
  img: HTMLImageElement | null;
  checks?: CheckItem[];
  downloadMessage?: string;
  file: File | null;
  fileSize: number;
  colourProfileStatus: ColourProfileStatus;
  hasTransparency: boolean | null;
  practicalPrintDpi: number;
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
  uploadTarget: 'standard' | 'redbubble' | 'printful' | 'teepublic';
  setUploadTarget: React.Dispatch<
    React.SetStateAction<'standard' | 'redbubble' | 'printful' | 'teepublic'>
  >;
  handleDownloadApparelPng: () => void;
  handleDownloadRedbubblePng: () => void;
  handleDownloadPrintfulPng: () => void;
  handleDownloadTeePublicPng: () => void;
};

const PRINTFUL_MAX_BYTES = 200 * 1024 * 1024;

function getPrintfulPreflight(
  img: HTMLImageElement | null,
  checks: CheckItem[] | undefined,
  file: File | null,
  fileSize: number,
  colourProfileStatus: ColourProfileStatus,
  hasTransparency: boolean | null,
  practicalPrintDpi: number,
  uploadTarget: 'standard' | 'redbubble' | 'printful' | 'teepublic'
): { overall: PrintfulOverallStatus; items: PreflightItem[] } {
  const findCheck = (label: string) => checks?.find((c) => c.label === label);

  const whiteBg = findCheck('White Background Risk');
  const solidBg = findCheck('Solid Background Box Risk');
  const fakeBg = findCheck('Fake Transparency Background');

  const isActiveIssue = (check: CheckItem | undefined) =>
    check?.status === 'fail' || check?.status === 'warn';

  const strongBackgroundIssue =
    whiteBg?.status === 'fail' ||
    solidBg?.status === 'fail' ||
    fakeBg?.status === 'fail';

  const backgroundNeedsReview =
    isActiveIssue(whiteBg) || isActiveIssue(solidBg) || isActiveIssue(fakeBg);

  const isPng = file?.type.includes('png') ?? false;
  const isJpeg =
    (file?.type.includes('jpeg') || file?.type.includes('jpg')) ?? false;
  const isWebp = file?.type.includes('webp') ?? false;

  let fileTypeMark: PreflightMark = 'warn';
  let fileTypeDetail =
    'PNG preferred for transparency. JPEG can work if no transparency is needed.';
  if (isPng || isJpeg) {
    fileTypeMark = 'pass';
    fileTypeDetail = isPng
      ? 'PNG detected — good for transparent DTG artwork.'
      : 'JPEG detected — fine if transparency is not needed.';
  } else if (isWebp) {
    fileTypeMark = 'warn';
    fileTypeDetail =
      'WebP detected. PNG preferred for transparency. JPEG can work if no transparency is needed.';
  } else if (!file) {
    fileTypeMark = 'warn';
    fileTypeDetail =
      'PNG preferred for transparency. JPEG can work if no transparency is needed.';
  }

  const transparencyPass =
    hasTransparency === true && !backgroundNeedsReview;
  const transparencyMark: PreflightMark = transparencyPass
    ? 'pass'
    : img
    ? 'warn'
    : 'fail';
  const transparencyDetail = backgroundNeedsReview
    ? 'Background boxes may print as rectangles on DTG products.'
    : hasTransparency === false
    ? 'No transparency detected — background may print as a solid area.'
    : hasTransparency === true
    ? 'Transparent PNG with no obvious background box issues.'
    : 'Background boxes may print as rectangles on DTG products.';

  const dpiMark: PreflightMark =
    practicalPrintDpi >= 150 ? 'pass' : img ? 'warn' : 'fail';
  const dpiDetail = '150–300 DPI is the usual Printful target range.';

  const fileSizeMark: PreflightMark =
    fileSize > 0 && fileSize < PRINTFUL_MAX_BYTES
      ? 'pass'
      : fileSize >= PRINTFUL_MAX_BYTES
      ? 'warn'
      : img
      ? 'pass'
      : 'fail';
  const fileSizeDetail = 'Printful upload max is 200 MB.';

  let colourProfileMark: PreflightMark = 'info';
  let colourProfileDetail =
    'sRGB not detected in file metadata. Use sRGB for best Printful colour matching.';
  if (colourProfileStatus === 'srgb') {
    colourProfileMark = 'pass';
    colourProfileDetail = 'sRGB detected';
  } else if (colourProfileStatus === 'non-srgb') {
    colourProfileMark = 'warn';
    colourProfileDetail =
      'Non-sRGB profile detected. Printful recommends sRGB for digital printing.';
  }

  const items: PreflightItem[] = [
    {
      label: 'Design uploaded',
      mark: img ? 'pass' : 'fail',
    },
    {
      label: 'Printful export selected',
      mark: uploadTarget === 'printful' ? 'pass' : 'info',
    },
    {
      label: 'File type',
      mark: fileTypeMark,
      detail: fileTypeDetail,
    },
    {
      label: 'Transparency / background',
      mark: transparencyMark,
      detail: transparencyDetail,
    },
    {
      label: 'Practical DPI',
      mark: dpiMark,
      detail: dpiDetail,
    },
    {
      label: 'File size',
      mark: fileSizeMark,
      detail: fileSizeDetail,
    },
    {
      label: 'Colour Profile',
      mark: colourProfileMark,
      detail: colourProfileDetail,
    },
  ];

  let overall: PrintfulOverallStatus = 'PRINTFUL READY';
  if (!img || strongBackgroundIssue) {
    overall = 'NOT READY';
  } else if (
    practicalPrintDpi < 150 ||
    fileTypeMark === 'warn' ||
    transparencyMark === 'warn' ||
    fileSizeMark === 'warn'
  ) {
    overall = 'REVIEW FIRST';
  }

  return { overall, items };
}

function preflightMarkSymbol(mark: PreflightMark): string {
  if (mark === 'pass') return '✓';
  if (mark === 'warn') return '⚠';
  if (mark === 'fail') return '✕';
  return 'ℹ';
}

function preflightStatusColor(status: PrintfulOverallStatus): string {
  if (status === 'PRINTFUL READY') return '#86efac';
  if (status === 'REVIEW FIRST') return '#fde047';
  return '#fca5a5';
}

export default function IssueBucketsPanel({
  isScanning,
  img,
  checks = [],
  downloadMessage,
  file,
  fileSize,
  colourProfileStatus,
  hasTransparency,
  practicalPrintDpi,
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
  uploadTarget,
  setUploadTarget,
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

  const uploadTargetOptions: { id: UploadTarget; label: string }[] = [
    { id: 'standard', label: 'Standard POD' },
    { id: 'redbubble', label: 'Redbubble' },
    { id: 'printful', label: 'Printful' },
    { id: 'teepublic', label: 'TeePublic' },
  ];

  const uploadTargetHelper: Record<UploadTarget, string> = {
    standard: 'Use this export for most general POD shirt uploads.',
    redbubble: 'Use this export when uploading apparel designs to Redbubble.',
    printful: 'Use this export when uploading DTG/DTF apparel designs to Printful.',
    teepublic: 'Use this export for TeePublic all-products upload.',
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
        type="button"
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
        Download Standard 4200 × 4800 PNG
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

  const renderPrintfulPreflightCard = () => {
    const { overall, items } = getPrintfulPreflight(
      img,
      checks,
      file,
      fileSize,
      colourProfileStatus,
      hasTransparency,
      practicalPrintDpi,
      uploadTarget
    );

    return (
      <div
        style={{
          padding: 12,
          borderRadius: 14,
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(147, 197, 253, 0.25)',
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>Printful Readiness Check</div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              color: preflightStatusColor(overall),
              letterSpacing: '0.04em',
            }}
          >
            {overall}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
          Checks file type, transparency, DPI, file size, colour profile, and background box risk before Printful upload.
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {items.map((item) => (
            <div key={item.label} style={{ display: 'grid', gap: 2 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.4 }}>
                <span style={{ flexShrink: 0, width: 14, fontWeight: 900, color: '#cbd5e1' }}>
                  {preflightMarkSymbol(item.mark)}
                </span>
                <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{item.label}</span>
              </div>
              {item.detail && (
                <div style={{ paddingLeft: 22, fontSize: 11, color: '#94a3b8', lineHeight: 1.35 }}>
                  {item.detail}
                </div>
              )}
            </div>
          ))}
        </div>
        {downloadMessage?.includes('Printful') && (
          <div style={{ fontSize: 11, color: '#86efac', fontWeight: 700 }}>
            Printful export downloaded.
          </div>
        )}
      </div>
    );
  };

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
      {uploadTarget === 'printful' && renderPrintfulPreflightCard()}
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
      data-tour="export"
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
            marginTop: 8,
            fontSize: 12,
            color: '#cbd5e1',
            lineHeight: 1.45,
          }}
        >
          {uploadTargetHelper[uploadTarget]}
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

      <div style={{ marginBottom: 14, display: 'grid', gap: 12 }} data-tour="download">
        {orderedExportTargets.map((target) => exportBoxRenderers[target]())}
      </div>

    </div>
  );
}
