'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  uploadTarget: 'standard' | 'redbubble' | 'printful' | 'teepublic' | 'custom' | 'presets';
  setUploadTarget: React.Dispatch<
    React.SetStateAction<'standard' | 'redbubble' | 'printful' | 'teepublic' | 'custom' | 'presets'>
  >;
  handleDownloadApparelPng: () => void;
  handleDownloadRedbubblePng: () => void;
  handleDownloadPrintfulPng: () => void;
  handleDownloadTeePublicPng: () => void;
  handleDownloadCustomPng: (width: number, height: number, presetName?: string) => void;
  handleBuildExportPack: (
    items: { label: string; width: number; height: number; filenameSlug: string }[]
  ) => void | Promise<void>;
  handleDownloadExportPackZip: (
    items: { label: string; width: number; height: number; filenameSlug: string }[]
  ) => void | Promise<void>;
  customSizeFocusToken?: number;
  productPresetsFocusToken?: number;
  exportPackZipFocusToken?: number;
};

const PRINTFUL_MAX_BYTES = 200 * 1024 * 1024;
const CUSTOM_EXPORT_MIN = 500;
const CUSTOM_EXPORT_MAX = 12000;
const STANDARD_EXPORT_W = 4200;
const STANDARD_EXPORT_H = 4800;
const TEEPUBLIC_EXPORT_W = 5000;
const TEEPUBLIC_EXPORT_H = 5500;

type ExportPackOptionId =
  | 'standard'
  | 'redbubble'
  | 'printful'
  | 'teepublic'
  | 'square'
  | 'sticker'
  | 'poster'
  | 'mug'
  | 'tote-bag'
  | 'phone-case';

type V5ProductPreset = {
  id: string;
  name: string;
  width: number;
  height: number;
  note: string;
};

const V5_PRODUCT_PRESETS: V5ProductPreset[] = [
  {
    id: 'square',
    name: 'Square',
    width: 4500,
    height: 4500,
    note: 'Generic square preset for logos, icons, and square POD products.',
  },
  {
    id: 'sticker',
    name: 'Sticker',
    width: 3000,
    height: 3000,
    note: 'Generic square preset for sticker-style POD products.',
  },
  {
    id: 'poster',
    name: 'Poster',
    width: 5400,
    height: 7200,
    note: 'Generic tall preset for poster-style POD products.',
  },
  {
    id: 'mug',
    name: 'Mug',
    width: 2700,
    height: 1200,
    note: 'Generic wraparound preset for mug-style POD products.',
  },
  {
    id: 'tote-bag',
    name: 'Tote Bag',
    width: 4500,
    height: 5400,
    note: 'Generic tall preset for tote bag-style POD products.',
  },
  {
    id: 'phone-case',
    name: 'Phone Case',
    width: 2400,
    height: 3600,
    note: 'Generic tall preset for phone case-style POD products.',
  },
];

function parseCustomExportSize(
  widthStr: string,
  heightStr: string
): { valid: true; width: number; height: number } | { valid: false; error: string } {
  const width = Number.parseInt(widthStr, 10);
  const height = Number.parseInt(heightStr, 10);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < CUSTOM_EXPORT_MIN ||
    width > CUSTOM_EXPORT_MAX ||
    height < CUSTOM_EXPORT_MIN ||
    height > CUSTOM_EXPORT_MAX
  ) {
    return {
      valid: false,
      error: 'Enter a width and height between 500 and 12000 px.',
    };
  }
  return { valid: true, width, height };
}

function getPrintfulPreflight(
  img: HTMLImageElement | null,
  checks: CheckItem[] | undefined,
  file: File | null,
  fileSize: number,
  colourProfileStatus: ColourProfileStatus,
  hasTransparency: boolean | null,
  practicalPrintDpi: number,
  uploadTarget: 'standard' | 'redbubble' | 'printful' | 'teepublic' | 'custom' | 'presets'
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
  handleDownloadCustomPng,
  handleBuildExportPack,
  handleDownloadExportPackZip,
  customSizeFocusToken = 0,
  productPresetsFocusToken = 0,
  exportPackZipFocusToken = 0,
}: IssueBucketsPanelProps) {
  const [customWidth, setCustomWidth] = useState('3000');
  const [customHeight, setCustomHeight] = useState('3000');
  const [customSizeError, setCustomSizeError] = useState('');
  const [exportPackSelected, setExportPackSelected] = useState<Record<ExportPackOptionId, boolean>>({
    standard: false,
    redbubble: false,
    printful: false,
    teepublic: false,
    square: false,
    sticker: false,
    poster: false,
    mug: false,
    'tote-bag': false,
    'phone-case': false,
  });
  const [exportPackMessage, setExportPackMessage] = useState('');
  const [exportPackBusy, setExportPackBusy] = useState(false);
  const [exportZipMessage, setExportZipMessage] = useState('');
  const [exportZipBusy, setExportZipBusy] = useState(false);
  const [selectedProductPresetId, setSelectedProductPresetId] = useState('square');
  const customSizeRef = useRef<HTMLDivElement>(null);
  const customWidthInputRef = useRef<HTMLInputElement>(null);
  const productPresetsRef = useRef<HTMLDivElement>(null);
  const exportPackZipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (customSizeFocusToken === 0) return;
    window.setTimeout(() => {
      customSizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        customWidthInputRef.current?.focus();
      }, 250);
    }, 100);
  }, [customSizeFocusToken]);

  useEffect(() => {
    if (productPresetsFocusToken === 0) return;
    window.setTimeout(() => {
      productPresetsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [productPresetsFocusToken]);

  useEffect(() => {
    if (exportPackZipFocusToken === 0) return;
    window.setTimeout(() => {
      exportPackZipRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [exportPackZipFocusToken]);
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

  type UploadTarget = 'standard' | 'redbubble' | 'printful' | 'teepublic' | 'custom' | 'presets';

  const uploadTargetOptions: { id: UploadTarget; label: string }[] = [
    { id: 'standard', label: 'Standard POD' },
    { id: 'redbubble', label: 'Redbubble' },
    { id: 'printful', label: 'Printful' },
    { id: 'teepublic', label: 'TeePublic' },
    { id: 'custom', label: 'Custom Size' },
    { id: 'presets', label: 'Product Presets' },
  ];

  const uploadTargetHelper: Record<UploadTarget, string> = {
    standard: 'Use this export for most general POD shirt uploads.',
    redbubble: 'Use this export when uploading apparel designs to Redbubble.',
    printful: 'Use this export when uploading DTG/DTF apparel designs to Printful.',
    teepublic: 'Use this export for TeePublic all-products upload.',
    custom: 'Enter a custom width and height for mugs, stickers, posters, and other POD products.',
    presets: 'Choose a quick generic POD export size for common product shapes.',
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

  const getBoxStyle = (target: Exclude<UploadTarget, 'custom' | 'presets'>): React.CSSProperties =>
    uploadTarget === target ? { ...baseBoxStyle, ...selectedBoxStyle } : baseBoxStyle;

  const getExtraPanelStyle = (target: 'custom' | 'presets'): React.CSSProperties => ({
    ...baseBoxStyle,
    ...(uploadTarget === target ? selectedBoxStyle : {}),
  });

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

  const customSizeParsed = parseCustomExportSize(customWidth, customHeight);
  const customFileName =
    customSizeParsed.valid
      ? `pod-checker-custom-${customSizeParsed.width}x${customSizeParsed.height}.png`
      : 'pod-checker-custom-[width]x[height].png';

  const presetDownloadButtonStyle: React.CSSProperties = {
    width: '100%',
    background: '#2563eb',
    color: '#ffffff',
    fontWeight: 800,
    borderRadius: 12,
    padding: '10px 14px',
    opacity: img ? 1 : 0.55,
    boxShadow: img ? '0 10px 20px rgba(37, 99, 235, 0.30)' : 'none',
    cursor: img ? 'pointer' : 'not-allowed',
    fontSize: 13,
  };

  const exportPackOptions: {
    id: ExportPackOptionId;
    checkboxLabel: string;
    label: string;
    width: number;
    height: number;
    filenameSlug: string;
  }[] = [
    {
      id: 'standard',
      checkboxLabel: `Standard ${STANDARD_EXPORT_W} × ${STANDARD_EXPORT_H}`,
      label: 'Standard',
      width: STANDARD_EXPORT_W,
      height: STANDARD_EXPORT_H,
      filenameSlug: 'pod-checker-standard-apparel',
    },
    {
      id: 'redbubble',
      checkboxLabel: `Redbubble ${selectedRedbubblePresetData.width} × ${selectedRedbubblePresetData.height}`,
      label: 'Redbubble',
      width: selectedRedbubblePresetData.width,
      height: selectedRedbubblePresetData.height,
      filenameSlug: toSafeSlug(selectedRedbubblePresetData.label) || 'pod-checker-redbubble',
    },
    {
      id: 'printful',
      checkboxLabel: `Printful ${selectedPrintfulPresetData.width} × ${selectedPrintfulPresetData.height}`,
      label: 'Printful',
      width: selectedPrintfulPresetData.width,
      height: selectedPrintfulPresetData.height,
      filenameSlug: toSafeSlug(selectedPrintfulPresetData.label) || 'pod-checker-printful',
    },
    {
      id: 'teepublic',
      checkboxLabel: `TeePublic ${TEEPUBLIC_EXPORT_W} × ${TEEPUBLIC_EXPORT_H}`,
      label: 'TeePublic All Products',
      width: TEEPUBLIC_EXPORT_W,
      height: TEEPUBLIC_EXPORT_H,
      filenameSlug: 'teepublic',
    },
    ...V5_PRODUCT_PRESETS.map((preset) => ({
      id: preset.id as ExportPackOptionId,
      checkboxLabel: `${preset.name} ${preset.width} × ${preset.height}`,
      label: preset.name,
      width: preset.width,
      height: preset.height,
      filenameSlug: `pod-checker-${toSafeSlug(preset.name)}`,
    })),
  ];

  const toggleExportPackOption = (id: ExportPackOptionId) => {
    setExportPackSelected((prev) => ({ ...prev, [id]: !prev[id] }));
    setExportPackMessage('');
  };

  const handleBuildExportPackClick = async () => {
    if (!img) {
      setExportPackMessage('Upload a design before building an export pack.');
      return;
    }

    const selectedItems = exportPackOptions
      .filter((option) => exportPackSelected[option.id])
      .map(({ label, width, height, filenameSlug }) => ({
        label,
        width,
        height,
        filenameSlug,
      }));

    if (selectedItems.length === 0) {
      setExportPackMessage('Choose at least one export size.');
      return;
    }

    setExportPackMessage('');
    setExportPackBusy(true);
    try {
      await handleBuildExportPack(selectedItems);
    } finally {
      setExportPackBusy(false);
    }
  };

  const handleDownloadExportPackZipClick = async () => {
    if (!img) {
      setExportZipMessage('Upload a design before building an export pack.');
      return;
    }

    const selectedItems = exportPackOptions
      .filter((option) => exportPackSelected[option.id])
      .map(({ label, width, height, filenameSlug }) => ({
        label,
        width,
        height,
        filenameSlug,
      }));

    if (selectedItems.length === 0) {
      setExportZipMessage('Choose at least one export size.');
      return;
    }

    setExportZipMessage('');
    setExportZipBusy(true);
    try {
      await handleDownloadExportPackZip(selectedItems);
    } finally {
      setExportZipBusy(false);
    }
  };

  const renderExportPackPanel = () => (
    <div style={baseBoxStyle}>
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 800 }}>
        One-Click POD Export Pack
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
        Choose the POD sizes you need, then export multiple transparent PNG files from one fixed
        design.
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {exportPackOptions.map((option) => (
          <label
            key={option.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#e2e8f0',
              cursor: 'pointer',
              lineHeight: 1.4,
            }}
          >
            <input
              type="checkbox"
              checked={exportPackSelected[option.id]}
              onChange={() => toggleExportPackOption(option.id)}
              style={{ width: 14, height: 14, flexShrink: 0 }}
            />
            <span>{option.checkboxLabel}</span>
          </label>
        ))}
      </div>
      {exportPackMessage && (
        <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.4 }}>{exportPackMessage}</div>
      )}
      {downloadMessage &&
        (downloadMessage.startsWith('Exporting ') || downloadMessage.includes('Export pack complete')) && (
          <div style={{ fontSize: 12, color: '#86efac', lineHeight: 1.4, fontWeight: 700 }}>
            {downloadMessage}
          </div>
        )}
      <button
        type="button"
        onClick={() => {
          void handleBuildExportPackClick();
        }}
        aria-disabled={!img || exportPackBusy}
        style={{
          ...presetDownloadButtonStyle,
          opacity: img && !exportPackBusy ? 1 : 0.55,
          cursor: img && !exportPackBusy ? 'pointer' : 'not-allowed',
        }}
      >
        {exportPackBusy ? 'Building export pack...' : 'Build POD Export Pack'}
      </button>
    </div>
  );

  const renderExportPackZipPanel = () => (
    <div id="export-pack-zip" ref={exportPackZipRef} style={baseBoxStyle}>
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 800 }}>
        POD Export Pack ZIP
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
        Choose export sizes and download one ZIP file with ready-to-upload transparent PNGs.
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {exportPackOptions.map((option) => (
          <label
            key={`zip-${option.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#e2e8f0',
              cursor: 'pointer',
              lineHeight: 1.4,
            }}
          >
            <input
              type="checkbox"
              checked={exportPackSelected[option.id]}
              onChange={() => toggleExportPackOption(option.id)}
              style={{ width: 14, height: 14, flexShrink: 0 }}
            />
            <span>{option.checkboxLabel}</span>
          </label>
        ))}
      </div>
      {exportZipMessage && (
        <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.4 }}>{exportZipMessage}</div>
      )}
      {downloadMessage &&
        (downloadMessage.startsWith('Building export pack') ||
          downloadMessage.startsWith('Adding ') ||
          downloadMessage.includes('Export pack ready')) && (
          <div style={{ fontSize: 12, color: '#86efac', lineHeight: 1.4, fontWeight: 700 }}>
            {downloadMessage}
          </div>
        )}
      <button
        type="button"
        onClick={() => {
          void handleDownloadExportPackZipClick();
        }}
        aria-disabled={!img || exportZipBusy}
        style={{
          ...presetDownloadButtonStyle,
          opacity: img && !exportZipBusy ? 1 : 0.55,
          cursor: img && !exportZipBusy ? 'pointer' : 'not-allowed',
        }}
      >
        {exportZipBusy ? 'Building export pack...' : 'Download Export Pack ZIP'}
      </button>
      <div style={fileNameLineStyle}>ZIP file name: pod-checker-export-pack.zip</div>
    </div>
  );

  const selectedProductPreset =
    V5_PRODUCT_PRESETS.find((preset) => preset.id === selectedProductPresetId) ??
    V5_PRODUCT_PRESETS[0];
  const selectedProductPresetFileName = `pod-checker-${toSafeSlug(selectedProductPreset.name)}-${selectedProductPreset.width}x${selectedProductPreset.height}.png`;

  const renderProductPresetsPanel = () => (
    <div
      id="product-presets-export"
      ref={productPresetsRef}
      style={getExtraPanelStyle('presets')}
    >
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 800 }}>
        V5 Product Export Presets
      </div>
      {uploadTarget === 'presets' && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
        Choose a quick generic POD export size for common product shapes. These are generic POD
        presets — not official platform sizes.
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800 }}>
        Choose a generic POD preset:
      </div>
      <select
        value={selectedProductPresetId}
        onChange={(e) => setSelectedProductPresetId(e.target.value)}
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
        {V5_PRODUCT_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name} — {preset.width} × {preset.height}
          </option>
        ))}
      </select>
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{selectedProductPreset.note}</div>
      <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
        Target: {selectedProductPreset.width} × {selectedProductPreset.height} px
      </div>
      <button
        type="button"
        onClick={() => {
          if (!img) return;
          handleDownloadCustomPng(
            selectedProductPreset.width,
            selectedProductPreset.height,
            selectedProductPreset.name
          );
        }}
        aria-disabled={!img}
        style={presetDownloadButtonStyle}
      >
        Download Preset PNG
      </button>
      <div style={fileNameLineStyle}>File name: {selectedProductPresetFileName}</div>
    </div>
  );

  const renderCustomSizeExportBox = () => (
    <div
      id="custom-size-export"
      ref={customSizeRef}
      style={getExtraPanelStyle('custom')}
    >
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>Custom Size Export</div>
      {uploadTarget === 'custom' && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
        Choose a custom PNG size for mugs, stickers, posters, square designs, and other POD products.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>Width</span>
          <input
            ref={customWidthInputRef}
            id="custom-size-width"
            type="number"
            min={CUSTOM_EXPORT_MIN}
            max={CUSTOM_EXPORT_MAX}
            value={customWidth}
            onChange={(e) => {
              setCustomWidth(e.target.value);
              setCustomSizeError('');
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd' }}>Height</span>
          <input
            type="number"
            min={CUSTOM_EXPORT_MIN}
            max={CUSTOM_EXPORT_MAX}
            value={customHeight}
            onChange={(e) => {
              setCustomHeight(e.target.value);
              setCustomSizeError('');
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </label>
      </div>
      {customSizeParsed.valid && (
        <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
          Target: {customSizeParsed.width} × {customSizeParsed.height} px
        </div>
      )}
      {customSizeError && (
        <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.4 }}>{customSizeError}</div>
      )}
      <button
        type="button"
        onClick={() => {
          if (!img) return;
          const parsed = parseCustomExportSize(customWidth, customHeight);
          if (!parsed.valid) {
            setCustomSizeError(parsed.error);
            return;
          }
          setCustomSizeError('');
          handleDownloadCustomPng(parsed.width, parsed.height);
        }}
        aria-disabled={!img}
        style={presetDownloadButtonStyle}
      >
        Download Custom PNG
      </button>
      <div style={fileNameLineStyle}>File name: {customFileName}</div>
    </div>
  );

  const exportBoxRenderers: Record<
    Exclude<UploadTarget, 'custom' | 'presets'>,
    () => React.JSX.Element
  > = {
    standard: renderStandardExportBox,
    redbubble: renderRedbubbleExportBox,
    printful: renderPrintfulExportBox,
    teepublic: renderTeePublicExportBox,
  };

  const platformExportTargets: Exclude<UploadTarget, 'custom' | 'presets'>[] = [
    'standard',
    'redbubble',
    'printful',
    'teepublic',
  ];

  const orderedPlatformTargets: Exclude<UploadTarget, 'custom' | 'presets'>[] =
    uploadTarget === 'custom' || uploadTarget === 'presets'
      ? platformExportTargets
      : [
          uploadTarget,
          ...platformExportTargets.filter((id) => id !== uploadTarget),
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
        {uploadTarget === 'presets' && renderProductPresetsPanel()}
        {uploadTarget === 'custom' && renderCustomSizeExportBox()}
        {renderExportPackPanel()}
        {renderExportPackZipPanel()}
        {orderedPlatformTargets.map((target) => exportBoxRenderers[target]())}
      </div>

    </div>
  );
}
