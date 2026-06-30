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
  const [exportZipMessage, setExportZipMessage] = useState('');
  const [exportZipBusy, setExportZipBusy] = useState(false);
  const [moreDownloadOpen, setMoreDownloadOpen] = useState(false);
  const [exportPackOpen, setExportPackOpen] = useState(false);
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
    setMoreDownloadOpen(true);
    setExportPackOpen(true);
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

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const printAreaSelectStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: 'rgba(15, 23, 42, 0.75)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const fixedSelectDisplayStyle: React.CSSProperties = {
    ...printAreaSelectStyle,
    color: '#e2e8f0',
    cursor: 'default',
  };

  type ExportBoxOptions = {
    hidePresetSelector?: boolean;
    compact?: boolean;
    embedded?: boolean;
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

  const modeCards: { id: UploadTarget; title: string; description: string }[] = [
    { id: 'standard', title: 'Standard POD', description: 'General apparel export' },
    { id: 'redbubble', title: 'Redbubble', description: 'Platform apparel presets' },
    { id: 'printful', title: 'Printful', description: 'DTG and DTF presets' },
    { id: 'teepublic', title: 'TeePublic', description: 'All-products export' },
    { id: 'custom', title: 'Custom Size', description: 'Enter exact dimensions' },
    { id: 'presets', title: 'Product Presets', description: 'Ready-made product sizes' },
  ];

  const modeSectionStyle: React.CSSProperties = {
    borderRadius: 18,
    padding: 14,
    background: 'rgba(15, 23, 42, 0.65)',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    display: 'grid',
    gap: 10,
  };

  const embeddedBoxStyle: React.CSSProperties = {
    display: 'grid',
    gap: 8,
  };

  const getModeCardStyle = (selected: boolean): React.CSSProperties => ({
    borderRadius: 14,
    padding: 12,
    minHeight: 90,
    textAlign: 'left',
    width: '100%',
    border: selected
      ? '1px solid rgba(96, 165, 250, 0.85)'
      : '1px solid rgba(148, 163, 184, 0.22)',
    background: selected ? 'rgba(37, 99, 235, 0.18)' : 'rgba(15, 23, 42, 0.75)',
    cursor: 'pointer',
    display: 'grid',
    gap: 4,
    alignContent: 'start',
  });

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

  const renderStandardExportBox = (opts?: ExportBoxOptions) => (
    <div key="standard" style={opts?.embedded ? embeddedBoxStyle : getBoxStyle('standard')}>
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>
        Standard Apparel Export
      </div>
      {uploadTarget === 'standard' && !opts?.compact && !opts?.embedded && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      {!opts?.compact && (
        <>
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
            Best for: general POD shirt uploads.
          </div>
        </>
      )}
      <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
        {standardTargetLine}
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

  const renderRedbubbleExportBox = (opts?: ExportBoxOptions) => (
    <div key="redbubble" style={opts?.embedded ? embeddedBoxStyle : getBoxStyle('redbubble')}>
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>
        Redbubble Export
      </div>
      {uploadTarget === 'redbubble' && !opts?.compact && !opts?.embedded && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      {!opts?.compact && (
        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
          Best for: Redbubble apparel presets.
        </div>
      )}
      {!opts?.hidePresetSelector && (
        <>
          <div style={stepLabelStyle}>
            {opts?.embedded ? 'Export size' : 'Step 1: Choose export size'}
          </div>
          <select
            value={selectedRedbubblePreset}
            onChange={(e) => {
              setSelectedRedbubblePreset(e.target.value as RedbubblePresetId);
              setActivePresetSystem('redbubble');
            }}
            style={printAreaSelectStyle}
          >
            {redbubblePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} — {preset.width} × {preset.height}
              </option>
            ))}
          </select>
        </>
      )}
      <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
        {redbubbleTargetLine}
      </div>
      <div style={stepLabelStyle}>
        {opts?.hidePresetSelector ? 'Download PNG' : 'Step 2: Download PNG'}
      </div>
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

  const renderPrintfulExportBox = (opts?: ExportBoxOptions) => (
    <div key="printful" style={opts?.embedded ? embeddedBoxStyle : getBoxStyle('printful')}>
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>
        Printful Export
      </div>
      {uploadTarget === 'printful' && !opts?.compact && !opts?.embedded && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      {!opts?.compact && (
        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
          Best for: Printful DTG/DTF apparel.
        </div>
      )}
      {uploadTarget === 'printful' && renderPrintfulPreflightCard()}
      {!opts?.hidePresetSelector && (
        <>
          <div style={stepLabelStyle}>
            {opts?.embedded ? 'Export size' : 'Step 1: Choose export size'}
          </div>
          <select
            value={selectedPrintfulPreset}
            onChange={(e) => {
              setSelectedPrintfulPreset(e.target.value as PrintfulPresetId);
              setActivePresetSystem('printful');
            }}
            style={selectStyle}
          >
            {printfulPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} — {preset.width} × {preset.height}
              </option>
            ))}
          </select>
        </>
      )}
      <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
        {printfulTargetLine}
      </div>
      <div style={stepLabelStyle}>
        {opts?.hidePresetSelector ? 'Download PNG' : 'Step 2: Download PNG'}
      </div>
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

  const renderTeePublicExportBox = (opts?: ExportBoxOptions) => (
    <div key="teepublic" style={opts?.embedded ? embeddedBoxStyle : getBoxStyle('teepublic')}>
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>
        TeePublic Export
      </div>
      {uploadTarget === 'teepublic' && !opts?.compact && !opts?.embedded && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      {!opts?.compact && (
        <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
          Best for: TeePublic all-products upload.
        </div>
      )}
      <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
        {teePublicTargetLine}
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
    setExportZipMessage('');
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

  const renderExportPackZipPanel = () => (
    <div id="export-pack-zip" style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 800 }}>
        Multi-Size Export Pack
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

  const renderProductPresetsPanel = (opts?: ExportBoxOptions) => (
    <div
      id="product-presets-export"
      ref={productPresetsRef}
      style={opts?.embedded ? embeddedBoxStyle : getExtraPanelStyle('presets')}
    >
      <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 800 }}>
        Product Export Presets
      </div>
      {uploadTarget === 'presets' && !opts?.compact && !opts?.embedded && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      {!opts?.compact && (
        <>
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
            Generic POD presets — not official platform sizes.
          </div>
          <select
            value={selectedProductPresetId}
            onChange={(e) => setSelectedProductPresetId(e.target.value)}
            style={selectStyle}
          >
            {V5_PRODUCT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} — {preset.width} × {preset.height}
              </option>
            ))}
          </select>
        </>
      )}
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

  const renderCustomSizeInputs = () => (
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
  );

  const renderCustomSizeExportBox = (opts?: ExportBoxOptions) => (
    <div
      id="custom-size-export"
      ref={customSizeRef}
      style={opts?.embedded ? embeddedBoxStyle : getExtraPanelStyle('custom')}
    >
      <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>Custom Size Export</div>
      {uploadTarget === 'custom' && !opts?.compact && !opts?.embedded && (
        <div style={recommendedLineStyle}>Recommended for your selected platform</div>
      )}
      {!opts?.compact && renderCustomSizeInputs()}
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
    (opts?: ExportBoxOptions) => React.JSX.Element
  > = {
    standard: renderStandardExportBox,
    redbubble: renderRedbubbleExportBox,
    printful: renderPrintfulExportBox,
    teepublic: renderTeePublicExportBox,
  };

  const selectedExportBoxOptions: ExportBoxOptions = {
    hidePresetSelector: false,
    embedded: true,
    compact:
      uploadTarget === 'standard' ||
      uploadTarget === 'redbubble' ||
      uploadTarget === 'printful' ||
      uploadTarget === 'teepublic',
  };

  const exportDownloadSectionStyle: React.CSSProperties = {
    borderRadius: 18,
    padding: 14,
    background: 'rgba(15, 23, 42, 0.65)',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    display: 'grid',
    gap: 10,
  };

  const platformExportTargets: Exclude<UploadTarget, 'custom' | 'presets'>[] = [
    'standard',
    'redbubble',
    'printful',
    'teepublic',
  ];

  const isPlatformTarget = (
    target: UploadTarget
  ): target is Exclude<UploadTarget, 'custom' | 'presets'> =>
    target === 'standard' ||
    target === 'redbubble' ||
    target === 'printful' ||
    target === 'teepublic';

  const moreDownloadTargets = platformExportTargets.filter(
    (id) => !isPlatformTarget(uploadTarget) || id !== uploadTarget
  );

  const directChildStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  };

  return (
    <div
      data-tour="export"
      style={{
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
      }}
    >
      <div style={directChildStyle}>
        <div style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Export & Download</div>
        <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 13, lineHeight: 1.4 }}>
          Choose a platform preset or download the standard apparel PNG.
        </div>
      </div>
      <div
        style={{
          ...directChildStyle,
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
      <div style={{ ...directChildStyle, display: 'grid', gap: 10 }}>
        <div style={modeSectionStyle}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>1. PREPARE FOR PRINT</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.35 }}>
              Choose your POD platform or custom setup.
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {modeCards.map((mode) => {
              const selected = uploadTarget === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setUploadTarget(mode.id)}
                  style={getModeCardStyle(selected)}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: selected ? '#93c5fd' : '#f1f5f9',
                    }}
                  >
                    {mode.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: selected ? '#bfdbfe' : '#94a3b8',
                      lineHeight: 1.35,
                    }}
                  >
                    {mode.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      <div style={{ ...directChildStyle, display: 'grid', gap: 10 }} data-tour="download">
        <div style={exportDownloadSectionStyle}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>2. EXPORT & DOWNLOAD</div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.35 }}>
              {uploadTargetHelper[uploadTarget]}
            </div>
          </div>
          {uploadTarget === 'presets' && renderProductPresetsPanel(selectedExportBoxOptions)}
          {uploadTarget === 'custom' && renderCustomSizeExportBox(selectedExportBoxOptions)}
          {isPlatformTarget(uploadTarget) &&
            exportBoxRenderers[uploadTarget](selectedExportBoxOptions)}
        </div>
        <details
          open={moreDownloadOpen}
          onToggle={(e) => setMoreDownloadOpen(e.currentTarget.open)}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 800,
              color: '#cbd5e1',
              padding: '6px 0',
              listStyle: 'none',
            }}
          >
            More Download Options
          </summary>
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {moreDownloadTargets.map((target) => exportBoxRenderers[target]())}
            <div ref={exportPackZipRef}>
              <details
                open={exportPackOpen}
                onToggle={(e) => setExportPackOpen(e.currentTarget.open)}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#93c5fd',
                    padding: '4px 0',
                    listStyle: 'none',
                  }}
                >
                  Create Multi-Size Export Pack
                </summary>
                <div style={{ marginTop: 8, ...baseBoxStyle }}>{renderExportPackZipPanel()}</div>
              </details>
            </div>
          </div>
        </details>
      </div>

    </div>
  );
}
