'use client';

import React, { useState } from 'react';
import type { CheckItem } from '../lib/podCheckerTypes';
import { statusColor, statusIcon } from '../lib/podCheckerUtils';
import { podCheckerV4Notes } from '../content/podCheckerV4Notes';

type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type ScanResultsPanelProps = {
  file: File | null;
  uploadInputKey?: number;
  actionMessage: string;
  downloadMessage: string;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setActionMessage: React.Dispatch<React.SetStateAction<string>>;
  handleQuickFix: () => void;
  handleDownloadFixedPng: () => void;
  handleResetDesign?: () => void;
  autoFixApplied?: boolean;
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
  setInspectZoom: React.Dispatch<React.SetStateAction<number>>;
  practicalPrintDpi: number;
  targetCanvasW: number;
  targetCanvasH: number;
  onOpenTutorial?: () => void;
  onOpenCustomSize?: () => void;
  onOpenProductPresets?: () => void;
  onOpenExportPackZip?: () => void;
  onOpenBatchCheck?: () => void;
  batchCheckOpen?: boolean;
  onLoadFileFromBatch?: (file: File) => void;
  onOpenBatchExport?: () => void;
  batchExportOpen?: boolean;
  onDownloadBatchExportZip?: (
    files: File[],
    sizes: { label: string; width: number; height: number; folderSlug: string }[],
    onProgress: (message: string) => void,
  ) => Promise<void>;
  uploadTarget?:
    | 'standard'
    | 'redbubble'
    | 'printful'
    | 'teepublic'
    | 'spring'
    | 'zazzle'
    | 'gelato'
    | 'custom'
    | 'presets';
  toolsTab?: 'export' | 'batch' | 'converter' | 'colorcheck' | 'printsize' | 'fileinspector';
  onToolsTabChange?: (tab: 'export' | 'batch' | 'converter' | 'colorcheck' | 'printsize' | 'fileinspector') => void;
};

type ToolsTab = 'export' | 'batch' | 'converter' | 'colorcheck' | 'printsize' | 'fileinspector';

function getPostAutoFixDownloadText(): string {
  return 'Download Fixed PNG';
}

function getAutoFixAppliedText(): string {
  return 'Auto Fix applied.';
}

function getAutoFixHelperText(): string {
  return 'Review the preview first.';
}

function getFixedDownloadButtonText(): string {
  return 'Download Fixed PNG';
}

type SectionProps = {
  title: string;
  items: CheckItem[];
  emptyText: string;
  headingColor: string;
};

// Single check card, shared by the Section list and the collapsed Warnings list.
function CheckCard({ item, keyHint }: { item: CheckItem; keyHint: string }) {
  return (
    <div
      key={keyHint}
      style={{
        padding: '11px 13px',
        borderRadius: 10,
        background: 'rgba(15,23,42,0.78)',
        border: `1px solid ${statusColor(item.status)}44`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 5,
          fontWeight: 700,
          color: statusColor(item.status),
          fontSize: 13,
        }}
      >
        <span>{statusIcon(item.status)}</span>
        <span>{item.label}</span>
      </div>

      <div style={{ color: '#e5e7eb', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-line', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{item.message}</div>
    </div>
  );
}

function Section({ title, items, emptyText, headingColor }: SectionProps) {
  return (
    <div style={{ marginBottom: 18, minWidth: 0, maxWidth: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 800, color: headingColor }}>{title}</div>
        <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>{items.length}</div>
      </div>

      {items.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((item, index) => (
            <div
              key={`${title}-${item.label}-${index}`}
              style={{
                padding: '11px 13px',
                borderRadius: 10,
                background: 'rgba(15,23,42,0.78)',
                border: `1px solid ${statusColor(item.status)}44`,
                minWidth: 0,
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 5,
                  fontWeight: 700,
                  color: statusColor(item.status),
                  fontSize: 13,
                }}
              >
                <span>{statusIcon(item.status)}</span>
                <span>{item.label}</span>
              </div>

              <div style={{ color: '#e5e7eb', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-line', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{item.message}</div>
            </div>
          ))}

        </div>
      )}
    </div>
  );
}

export default function ScanResultsPanel({
  file,
  uploadInputKey = 0,
  actionMessage,
  downloadMessage,
  handleFileChange,
  setActionMessage,
  handleQuickFix,
  handleDownloadFixedPng,
  handleResetDesign,
  autoFixApplied: autoFixAppliedProp = false,
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
  setInspectZoom,
  practicalPrintDpi,
  targetCanvasW,
  targetCanvasH,
  onOpenTutorial,
  onOpenCustomSize,
  onOpenProductPresets,
  onOpenExportPackZip,
  onOpenBatchCheck,
  batchCheckOpen = false,
  onLoadFileFromBatch,
  onOpenBatchExport,
  batchExportOpen = false,
  onDownloadBatchExportZip,
  uploadTarget = 'standard',
  toolsTab: toolsTabProp = 'export',
  onToolsTabChange,
}: ScanResultsPanelProps) {
  const [toolsTabInternal, setToolsTabInternal] = useState<ToolsTab>('export');
  const toolsTab = onToolsTabChange ? toolsTabProp : toolsTabInternal;
  const setToolsTab = (tab: ToolsTab) => {
    if (onToolsTabChange) {
      onToolsTabChange(tab);
    } else {
      setToolsTabInternal(tab);
    }
  };
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  const toolsTabButtonStyle = (active: boolean): React.CSSProperties => ({
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    padding: '7px 4px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.01em',
    background: active ? '#2563eb' : 'rgba(37, 99, 235, 0.14)',
    color: active ? '#ffffff' : '#bfdbfe',
    border: active ? '1px solid rgba(96, 165, 250, 0.85)' : '1px solid rgba(147, 197, 253, 0.35)',
    cursor: 'pointer',
    textAlign: 'center',
  });

  const whatsNewLinkStyle: React.CSSProperties = {
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  };

  const secondaryLinkRowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 11,
    color: '#64748b',
  };
  // Auto Fix detection: once Auto Fix has run, the placement/size issues it resolves
  // should disappear from the active scan report AND from the Result Summary, instead
  // of being listed in a separate "Handled by Auto Fix" section.
  const autoFixableIssues = [
    'Design Too Small',
    'Print Safety Border',
    'Off-Center Design',
    'Empty Padding Risk',
    'Uneven Padding Risk',
    'Artwork Near Canvas Edge',
    'Cut-Off Edge Risk',
  ];
  const autoFixApplied = Boolean(img) && autoFixAppliedProp;
  const isAutoFixableLabel = (label: string) => autoFixableIssues.includes(label);
  const isSoftTransparency = (item: CheckItem) => item.label === 'Soft Transparency';
  const isExportSizeNote = (item: CheckItem) => item.label === 'Export Size Note';

  // After Auto Fix, drop the fixable labels from the working set so every downstream
  // list (summary, critical, warnings) treats them as resolved. The original checks
  // array is never changed; this only affects what is displayed.
  const visibleChecks = autoFixApplied
    ? checks.filter((item) => !isAutoFixableLabel(item.label))
    : checks;

  // Soft transparency and export size notes are optional preview notes — never score-blocking.
  const scoringChecks = visibleChecks.filter(
    (item) => !isSoftTransparency(item) && !isExportSizeNote(item),
  );

  // The auto-fixable labels that were actually present in the original scan, so the
  // "Auto Fix handled" confirmation under the Download Fixed PNG area lists real items.
  const autoFixHandledLabels = autoFixableIssues.filter((label) =>
    checks.some((item) => item.label === label),
  );

  const criticalItems = scoringChecks.filter((item) => item.status === 'fail');
  const warningItems = scoringChecks.filter((item) => item.status === 'warn');
  const passedItems = visibleChecks.filter((item) => item.status === 'pass');

  const infoItems = visibleChecks.filter((item) => item.status === 'info');

  const criticalDisplay = criticalItems.filter(
    (item) => !isSoftTransparency(item) && !isExportSizeNote(item),
  );
  const warningDisplay = warningItems.filter(
    (item) => !isSoftTransparency(item) && !isExportSizeNote(item),
  );
  const criticalActive = criticalDisplay;
  const warningActive = warningDisplay;
  const passedDisplay = passedItems.filter((item) => !isSoftTransparency(item));
  const infoDisplay = infoItems.filter((item) => !isSoftTransparency(item));

  // Soft Transparency is optional preview guidance — always shown as an info note.
  const softTransparencyItem = checks.find(isSoftTransparency);
  if (softTransparencyItem && softTransparencyItem.status !== 'pass') {
    const note =
      softTransparencyItem.status === 'warn'
        ? softTransparencyItem.message
        : 'Soft transparent pixels detected. Common in smooth edges, shadows, fades, and vintage artwork.';
    infoDisplay.push({
      label: 'Soft Transparency',
      status: 'info',
      message: `${note}\n\nPreview on dark shirt colours if needed.`,
    });
  }

  // Result Summary Engine: picks the single most important issue from the checks array.
  // Info checks are ignored. Fails always win over warns. Within each group, the issue
  // that sits highest in this priority list is chosen as the Main Issue.
  const issuePriority = [
    'Solid Background Box Risk',
    'White Background Risk',
    'Fake Transparency Background',
    'File Type Risk',
    'Aspect Ratio',
    'Cut-Off Edge Risk',
    'Artwork Near Canvas Edge',
    'Empty Padding Risk',
    'Uneven Padding Risk',
    'Design Too Small',
    'Print Safety Border',
    'White Edge / Halo Risk',
    'Compression Artifact Risk',
    'Low Contrast Risk',
    'Line Thickness',
    'Off-Center Design',
    'Artwork Size',
    'Stray Speck Check',
  ];

  // Match a check label to its priority key. startsWith covers labels that share a prefix.
  const matchPriorityKey = (label: string) =>
    issuePriority.find((key) => label === key || label.startsWith(key));

  const pickMainIssue = (items: CheckItem[]) => {
    let bestKey: string | undefined;
    let bestItem: CheckItem | null = null;
    let bestRank = Infinity;
    for (const item of items) {
      const key = matchPriorityKey(item.label);
      const rank = key ? issuePriority.indexOf(key) : Infinity;
      if (rank < bestRank) {
        bestRank = rank;
        bestKey = key;
        bestItem = item;
      }
    }
    return { key: bestKey, item: bestItem };
  };

  const mainPick = criticalActive.length
    ? pickMainIssue(criticalActive)
    : warningActive.length
    ? pickMainIssue(warningActive)
    : { key: undefined, item: null };

  const riskLabel = !img
    ? 'UPLOAD A DESIGN'
    : criticalActive.length
    ? 'HIGH RISK'
    : warningActive.length
    ? 'NEEDS REVIEW'
    : 'READY';

  const riskBg = !img
    ? '#1e293b'
    : criticalActive.length
    ? '#7f1d1d'
    : warningActive.length
    ? '#78350f'
    : '#14532d';

  const mainIssue = !img
    ? '—'
    : mainPick.item
    ? mainPick.key ?? mainPick.item.label
    : autoFixApplied
    ? 'Placement and sizing issues handled'
    : 'No major issue found.';

  const shortActionByIssue: Record<string, string> = {
    'Solid Background Box Risk': 'Remove the solid background or upload a transparent PNG.',
    'White Background Risk': 'Use transparent PNG',
    'Fake Transparency Background': 'Fix fake transparency',
    'File Type Risk': 'Use PNG source file',
    'Aspect Ratio': 'Use fixed export',
    'White Edge / Halo Risk': 'Clean design edges',
    'Compression Artifact Risk': 'Use cleaner PNG',
    'Low Contrast Risk': 'Increase contrast',
    'Line Thickness': 'Thicken fine lines',
    'Stray Speck Check': 'Remove stray marks',
    'Artwork Size': 'Review artwork size',
  };

  const currentAction = !img
    ? 'Upload a design to begin.'
    : mainPick.item
    ? isAutoFixableLabel(mainPick.key ?? mainPick.item.label)
      ? 'Run Auto Fix'
      : shortActionByIssue[mainPick.key ?? ''] ?? 'Review scan results'
    : autoFixApplied
    ? getPostAutoFixDownloadText()
    : 'Download and upload.';

  const currentActionHelper =
    autoFixApplied && !mainPick.item ? getAutoFixHelperText() : null;

  // Manual Fix Guidance: issues Auto Fix CANNOT solve need a source-file/manual fix.
  // (autoFixableIssues is defined near the top with the Auto Fix detection.)
  const manualFixMessages: Record<string, string> = {
    'Solid Background Box Risk': 'Remove the solid rectangle background or upload a transparent PNG.',
    'White Background Risk': 'Use a transparent PNG before uploading to dark shirts.',
    'Fake Transparency Background': 'Replace the fake checkerboard background with real transparency.',
    'File Type Risk': 'Use a PNG source file with transparency for best POD results.',
    'Compression Artifact Risk': 'Use a cleaner PNG source before uploading.',
    'White Edge / Halo Risk': 'Clean the design edges before uploading to dark shirts.',
    'Low Contrast Risk': 'Increase contrast so details print clearly.',
  };

  const showManualFixCard = Boolean(img) && Boolean(mainPick.item) && !autoFixableIssues.includes(mainIssue);
  const manualFixMessage = manualFixMessages[mainIssue] ?? 'This issue needs a source-file fix before upload.';

  // Display-only confidence: caps match visible risk without changing printScore.
  let displayScore: number | null = null;
  if (img) {
    let score = printScore;
    if (criticalActive.length > 0) {
      score = Math.min(score, 59);
    } else if (warningActive.length > 0) {
      score = Math.min(score, 89);
    }
    const mainIssueLabel = mainPick.key ?? mainPick.item?.label ?? '';
    if (
      !autoFixApplied &&
      mainPick.item &&
      isAutoFixableLabel(mainIssueLabel)
    ) {
      score = Math.min(score, 85);
    }
    displayScore = score;
  }

  const fixedDownloaded = downloadMessage.includes('Download ready');
  const scanCompleted = Boolean(img) && checks.length > 0;
  const autoFixNeeded = checks.some(
    (item) => isAutoFixableLabel(item.label) && (item.status === 'fail' || item.status === 'warn'),
  );
  const hasWarnings = warningActive.length > 0;
  const noFailRemain = criticalActive.length === 0;

  let finalUploadLabel: string;
  let finalUploadColor: string;
  let finalUploadBg: string;
  let finalUploadMsg: string;
  if (!img || !noFailRemain) {
    finalUploadLabel = 'NOT READY';
    finalUploadColor = '#fca5a5';
    finalUploadBg = 'rgba(127,29,29,0.45)';
    finalUploadMsg = 'Fix the main issue before uploading.';
  } else if (hasWarnings) {
    finalUploadLabel = 'READY WITH NOTES';
    finalUploadColor = '#fde68a';
    finalUploadBg = 'rgba(120,53,15,0.45)';
    finalUploadMsg = 'Your design may be usable, but review the notes before uploading.';
  } else if (fixedDownloaded) {
    finalUploadLabel = 'READY TO UPLOAD';
    finalUploadColor = '#86efac';
    finalUploadBg = 'rgba(20,83,45,0.55)';
    finalUploadMsg = 'Your fixed PNG is ready for POD upload.';
  } else {
    finalUploadLabel = 'READY TO DOWNLOAD';
    finalUploadColor = '#7dd3fc';
    finalUploadBg = 'rgba(7,89,133,0.50)';
    finalUploadMsg = 'No critical issues remain. Download the fixed PNG before uploading.';
  }

  const finalUploadChecklist = [
    { label: img ? 'Design uploaded' : 'Upload a design', status: img ? 'pass' : 'fail' },
    {
      label: scanCompleted ? 'Scan completed' : 'Scan not completed',
      status: scanCompleted ? 'pass' : 'fail',
    },
    {
      label: noFailRemain ? 'Main issue reviewed' : 'Fix main issue first',
      status: noFailRemain ? 'pass' : 'fail',
    },
    {
      label: autoFixApplied
        ? 'Auto Fix applied'
        : autoFixNeeded
        ? 'Run Auto Fix if needed'
        : 'Auto Fix not needed',
      status: autoFixApplied ? 'pass' : autoFixNeeded ? 'warn' : 'pass',
    },
    {
      label: hasWarnings ? 'Review remaining warnings' : 'No warnings remaining',
      status: hasWarnings ? 'warn' : 'pass',
    },
    {
      label: fixedDownloaded
        ? 'Fixed PNG downloaded'
        : img && noFailRemain && !hasWarnings
        ? 'Next: Download fixed PNG'
        : 'Download fixed PNG before upload',
      status: fixedDownloaded
        ? 'pass'
        : img && noFailRemain && !hasWarnings
        ? 'next'
        : img
        ? 'warn'
        : 'fail',
    },
  ];

  const checklistMark = (s: string) =>
    s === 'pass' ? '✓' : s === 'next' ? '→' : s === 'warn' ? '⚠' : '✕';
  const checklistMarkColor = (s: string) =>
    s === 'pass' ? '#86efac' : s === 'next' ? '#7dd3fc' : s === 'warn' ? '#fde68a' : '#fca5a5';

  const showAutoFixButton =
    Boolean(img) &&
    [
      'Design Too Small',
      'Print Safety Border',
      'Off-Center Design',
      'Empty Padding Risk',
      'Uneven Padding Risk',
      'Artwork Near Canvas Edge',
      'Cut-Off Edge Risk',
    ].includes(mainIssue);

  const compactRowStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 10,
    background: 'rgba(15,23,42,0.68)',
    border: '1px solid rgba(255,255,255,0.10)',
    fontSize: 13,
    lineHeight: 1.45,
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
  };

  const directChildStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  };

  return (
    <div
      className="scan-results-panel"
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 12,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridAutoRows: 'max-content',
        alignContent: 'start',
        gap: 10,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        height: '100%',
        minHeight: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
      }}
    >
      <style>{`
        .scan-results-panel {
          overflow-x: hidden;
        }
        .scan-results-panel > * {
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }
        .scan-results-panel button {
          max-width: 100%;
          box-sizing: border-box;
        }
        .scan-results-panel button:not([style*="padding: 0"]) {
          padding: 8px 10px;
        }
        .scan-results-panel input,
        .scan-results-panel select,
        .scan-results-panel textarea {
          max-width: 100%;
          box-sizing: border-box;
        }
      `}</style>
      <div style={{ ...directChildStyle, display: 'grid', gap: 10, overflow: 'hidden' }}>
        <div
          style={{
            padding: 10,
            borderRadius: 16,
            background: 'rgba(15,23,42,0.72)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'grid',
            gap: 10,
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'grid', gap: 6, minWidth: 0, maxWidth: '100%' }}>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>
              POD Design Checker™
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.35 }}>
              Check, fix and prepare your design for POD.
            </div>

            <div
              style={{
                padding: 10,
                borderRadius: 12,
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.22)',
                display: 'grid',
                gap: 8,
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 12, color: '#93c5fd' }}>Tools</div>
                <button type="button" onClick={() => onOpenTutorial?.()} style={whatsNewLinkStyle}>
                  Tutorial
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 6,
                  minWidth: 0,
                  maxWidth: '100%',
                  width: '100%',
                }}
              >
                <button
                  type="button"
                  onClick={() => setToolsTab('export')}
                  style={{
                    ...toolsTabButtonStyle(toolsTab === 'export'),
                    lineHeight: 1.25,
                    whiteSpace: 'normal',
                  }}
                >
                  Single Design
                </button>
                <button
                  type="button"
                  onClick={() => setToolsTab('batch')}
                  style={{
                    ...toolsTabButtonStyle(toolsTab === 'batch'),
                    whiteSpace: 'nowrap',
                  }}
                >
                  Batch
                </button>
                <button
                  type="button"
                  onClick={() => setToolsTab('converter')}
                  style={{
                    ...toolsTabButtonStyle(toolsTab === 'converter'),
                    whiteSpace: 'nowrap',
                  }}
                >
                  Converter
                </button>
                <button
                  type="button"
                  onClick={() => setToolsTab('colorcheck')}
                  style={{
                    ...toolsTabButtonStyle(toolsTab === 'colorcheck'),
                    whiteSpace: 'nowrap',
                  }}
                >
                  Color Check
                </button>
                <button
                  type="button"
                  onClick={() => setToolsTab('printsize')}
                  style={{
                    ...toolsTabButtonStyle(toolsTab === 'printsize'),
                    whiteSpace: 'nowrap',
                  }}
                >
                  Print Size
                </button>
                <button
                  type="button"
                  onClick={() => setToolsTab('fileinspector')}
                  style={{
                    ...toolsTabButtonStyle(toolsTab === 'fileinspector'),
                    whiteSpace: 'nowrap',
                  }}
                >
                  File Info
                </button>
              </div>
              <button
                type="button"
                onClick={() => setWhatsNewOpen((open) => !open)}
                style={{ ...whatsNewLinkStyle, justifySelf: 'start' }}
              >
                What&apos;s New
              </button>

              {toolsTab === 'batch' ? (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgba(37, 99, 235, 0.12)',
                    border: '1px solid rgba(147, 197, 253, 0.28)',
                    color: '#93c5fd',
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>Batch Check</div>
                  Check many designs at once.
                </div>
              ) : null}
              {toolsTab === 'converter' ? (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgba(37, 99, 235, 0.12)',
                    border: '1px solid rgba(147, 197, 253, 0.28)',
                    color: '#93c5fd',
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1.45,
                  }}
                >
                  Use the Product Converter in the centre panel to resize and export your design for any platform.
                </div>
              ) : null}
              {toolsTab === 'colorcheck' ? (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgba(37, 99, 235, 0.12)',
                    border: '1px solid rgba(147, 197, 253, 0.28)',
                    color: '#93c5fd',
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>Color Check</div>
                  Preview one design on different background colours.
                </div>
              ) : null}
              {toolsTab === 'printsize' ? (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgba(37, 99, 235, 0.12)',
                    border: '1px solid rgba(147, 197, 253, 0.28)',
                    color: '#93c5fd',
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>Print Size</div>
                  See how large your design can print at different PPI values.
                </div>
              ) : null}
              {toolsTab === 'fileinspector' ? (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgba(37, 99, 235, 0.12)',
                    border: '1px solid rgba(147, 197, 253, 0.28)',
                    color: '#93c5fd',
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>File Inspector</div>
                  See file type, size, transparency and image details.
                </div>
              ) : null}
            </div>

            {toolsTab === 'export' ? (
            <div
            style={{
              display: 'grid',
              gap: 4,
              minWidth: 0,
              maxWidth: '100%',
            }}
            data-tour="detail-zoom"
          >
            <span style={{ fontWeight: 800, color: '#bae6fd', fontSize: 12 }}>
              Detail Zoom
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 4,
                alignItems: 'center',
                minWidth: 0,
                maxWidth: '100%',
                width: '100%',
              }}
            >
              {[1, 2, 4, 8].map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    setInspectZoom(z);
                    setActionMessage(`Inspect Zoom set to ${z * 100}%.`);
                  }}
                  style={{
                    padding: '6px 2px',
                    minWidth: 0,
                    width: '100%',
                    maxWidth: '100%',
                    fontSize: 10,
                    fontWeight: inspectZoom === z ? 800 : 600,
                    boxShadow: inspectZoom === z ? 'inset 0 0 0 2px #38bdf8' : undefined,
                    boxSizing: 'border-box',
                  }}
                  disabled={!img}
                >
                  {z * 100}%
                </button>
              ))}
            </div>
            </div>
            ) : null}
          </div>
        </div>
      </div>

      {toolsTab === 'export' ? (
      <>
      <div style={{ ...directChildStyle, display: 'grid', gap: 10 }} data-tour="upload">
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
          key={uploadInputKey}
          id="design-upload"
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div style={secondaryLinkRowStyle}>
          <button type="button" onClick={() => onOpenTutorial?.()} style={whatsNewLinkStyle}>
            Tutorial
          </button>
          <span aria-hidden="true">•</span>
          <button
            type="button"
            onClick={() => setWhatsNewOpen((open) => !open)}
            style={whatsNewLinkStyle}
          >
            What&apos;s New
          </button>
          <span aria-hidden="true">•</span>
          <a
            href={podCheckerV4Notes.supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-tour="support"
            style={{ ...whatsNewLinkStyle, textDecoration: 'underline' }}
          >
            Support
          </a>
        </div>

        {whatsNewOpen ? (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(15, 23, 42, 0.55)',
              border: '1px solid rgba(148, 163, 184, 0.22)',
              display: 'grid',
              gap: 6,
              color: '#cbd5e1',
              fontSize: 11,
              lineHeight: 1.45,
            }}
          >
            {podCheckerV4Notes.paragraphs.map((paragraph) => (
              <p key={paragraph} style={{ margin: 0 }}>
                {paragraph.replace(/\bV4\b/g, '').replace(/  +/g, ' ').trim()}
              </p>
            ))}
          </div>
        ) : null}

        {!file ? (
          <div
            style={{
              padding: '9px 11px',
              borderRadius: 10,
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(147, 197, 253, 0.25)',
              display: 'grid',
              gap: 4,
            }}
          >
            <div style={{ color: '#e0f2fe', fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}>
              Upload a PNG design to begin.
            </div>
            <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.35 }}>
              Transparent PNG recommended for best POD results.
            </div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 8, minWidth: 0, maxWidth: '100%' }}>
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
                minWidth: 0,
              }}
              title={file.name}
            >
              {file.name}
            </div>
          ) : null}

          {img && handleResetDesign ? (
            <button
              onClick={handleResetDesign}
              style={{
                justifySelf: 'start',
                padding: '8px 14px',
                borderRadius: 10,
                background: '#0284c7',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 700,
                border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
                maxWidth: '100%',
              }}
            >
              Check Another Design
            </button>
          ) : null}
        </div>
      </div>

      {img ? (
      <div style={{ ...directChildStyle, display: 'grid', gap: 8 }} data-tour="scan-results">
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.04em' }}>SCAN REPORT</h2>
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            background: 'rgba(2,6,23,0.92)',
            border: '1px solid rgba(56,189,248,0.28)',
            display: 'grid',
            gap: 8,
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignSelf: 'start',
              padding: '5px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              background: riskBg,
              letterSpacing: '0.03em',
            }}
          >
            {riskLabel}
          </div>

          <div style={{ display: 'grid', gap: 2, fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
            {displayScore !== null ? (
              <div>
                <span style={{ color: '#94a3b8' }}>Print Confidence:</span>{' '}
                <strong style={{ color: '#e2e8f0' }}>{displayScore}%</strong>
              </div>
            ) : null}
            {criticalActive.length > 0 ? (
              <div style={{ color: '#f9a8d4', fontWeight: 700 }}>
                {criticalActive.length === 1
                  ? '1 critical issue found'
                  : `${criticalActive.length} critical issues found`}
              </div>
            ) : warningActive.length > 0 ? (
              <div style={{ color: '#fde68a', fontWeight: 700 }}>
                {warningActive.length === 1
                  ? '1 item needs review'
                  : `${warningActive.length} items need review`}
              </div>
            ) : (
              <div style={{ color: '#86efac', fontWeight: 700 }}>No issues need review</div>
            )}
          </div>

          {autoFixApplied ? (
            <div style={compactRowStyle}>
              <span style={{ fontWeight: 800, color: '#93c5fd' }}>Status:</span>{' '}
              {getAutoFixAppliedText()}
            </div>
          ) : null}

          <div style={compactRowStyle}>
            <div style={{ fontWeight: 800, color: '#93c5fd', marginBottom: 2 }}>Main Issue</div>
            <div style={{ color: '#e5e7eb' }}>{mainIssue}</div>
          </div>

          <div style={compactRowStyle} data-tour="autofix">
            <div style={{ fontWeight: 800, color: '#93c5fd', marginBottom: 2 }}>Next Action</div>
            <div style={{ color: '#e5e7eb' }}>{currentAction}</div>
            {currentActionHelper ? (
              <div
                style={{
                  fontSize: 11,
                  color: '#93c5fd',
                  fontWeight: 600,
                  lineHeight: 1.35,
                  marginTop: 4,
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: 'rgba(37, 99, 235, 0.10)',
                  border: '1px solid rgba(147, 197, 253, 0.25)',
                }}
              >
                {currentActionHelper}
              </div>
            ) : null}
          </div>

          {showAutoFixButton ? (
            <button
              type="button"
              onClick={() => {
                handleQuickFix();
                setActionMessage(getAutoFixAppliedText());
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                background: '#2563eb',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              Run Auto Fix
            </button>
          ) : null}
        </div>

        <details
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(15,23,42,0.55)',
            border: '1px solid rgba(148,163,184,0.22)',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#cbd5e1', fontSize: 12 }}>
            View Details
          </summary>
          <div style={{ display: 'grid', gap: 10, marginTop: 10, minWidth: 0, maxWidth: '100%' }}>
            {actionMessage ? (
              <div style={{ ...compactRowStyle, fontSize: 12, color: '#bae6fd' }}>
                <span style={{ fontWeight: 800 }}>Last Action:</span> {actionMessage}
              </div>
            ) : null}

            {downloadMessage ? (
              <div style={{ ...compactRowStyle, fontSize: 12, color: '#7dd3fc' }}>
                <span style={{ fontWeight: 800 }}>Download:</span> {downloadMessage}
              </div>
            ) : null}

            {showManualFixCard ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(120,53,15,0.45)',
                  border: '1px solid rgba(253,186,116,0.45)',
                  display: 'grid',
                  gap: 4,
                }}
              >
                <div style={{ fontWeight: 800, color: '#fdba74', fontSize: 13 }}>Manual Fix Needed</div>
                <div style={{ fontSize: 12, lineHeight: 1.45, color: '#fde68a' }}>{manualFixMessage}</div>
              </div>
            ) : null}

            {autoFixApplied ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(8,47,73,0.72)',
                  border: '1px solid rgba(56,189,248,0.35)',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!img) return;
                    handleDownloadFixedPng();
                  }}
                  style={{
                    justifySelf: 'start',
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    border: '1px solid rgba(255,255,255,0.2)',
                    cursor: img ? 'pointer' : 'not-allowed',
                  }}
                >
                  {getFixedDownloadButtonText()}
                </button>
                {uploadTarget === 'standard' ? (
                  <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                    Exports as 4200 × 4800 transparent PNG.
                  </div>
                ) : null}
                {autoFixHandledLabels.length > 0 ? (
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 800, color: '#7dd3fc', fontSize: 12 }}>Auto Fix handled:</div>
                    {autoFixHandledLabels.map((label) => (
                      <div key={`autofix-handled-${label}`} style={{ fontSize: 12, color: '#bae6fd' }}>
                        ✓ {label}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: 'rgba(2,6,23,0.92)',
                border: '1px solid rgba(56,189,248,0.28)',
                display: 'grid',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: 12, color: '#ffffff', fontWeight: 800 }}>FINAL UPLOAD CHECK</div>
                <div
                  style={{
                    padding: '4px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    color: finalUploadColor,
                    background: finalUploadBg,
                  }}
                >
                  {finalUploadLabel}
                </div>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.45, color: '#cbd5e1' }}>{finalUploadMsg}</div>
              <div style={{ display: 'grid', gap: 5 }}>
                {finalUploadChecklist.map((c) => (
                  <div
                    key={`final-check-${c.label}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                  >
                    <span style={{ color: checklistMarkColor(c.status), fontWeight: 800, width: 14 }}>
                      {checklistMark(c.status)}
                    </span>
                    <span style={{ color: '#e5e7eb' }}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {criticalActive.length > 0 ? (
              <div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>Must fix before upload.</div>
                <Section
                  title="Critical Issues"
                  items={criticalActive}
                  emptyText="No critical issues."
                  headingColor="#fca5a5"
                />
              </div>
            ) : null}

            {warningActive.length > 0 ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#fdba74', fontSize: 13 }}>Review Warnings</div>
                  <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 700 }}>{warningActive.length}</div>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
                  Check these before upload, but they may not block the design.
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {warningActive.map((item, index) => (
                    <CheckCard
                      key={`Warnings-${item.label}-${index}`}
                      item={item}
                      keyHint={`Warnings-${item.label}-${index}`}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {passedDisplay.length > 0 ? (
              <details
                data-tour="passed-checks"
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(15,23,42,0.55)',
                  border: '1px solid rgba(134,239,172,0.2)',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#86efac', fontSize: 12 }}>
                  Show Passed Checks ({passedDisplay.length})
                </summary>
                <div style={{ marginTop: 8 }}>
                  <Section
                    title="Passed Checks"
                    items={passedDisplay}
                    emptyText="No passed checks yet."
                    headingColor="#86efac"
                  />
                </div>
              </details>
            ) : null}

            {infoDisplay.length > 0 ? (
              <details
                data-tour="optional-notes"
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(15,23,42,0.55)',
                  border: '1px solid rgba(125,211,252,0.2)',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#7dd3fc', fontSize: 12 }}>
                  Show Optional Notes ({infoDisplay.length})
                </summary>
                <div style={{ marginTop: 8 }}>
                  <Section
                    title="Optional Notes"
                    items={infoDisplay}
                    emptyText="No optional notes."
                    headingColor="#7dd3fc"
                  />
                </div>
              </details>
            ) : null}

            {effectiveBounds ? (
              <div
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: 'rgba(15,23,42,0.75)',
                  border: '1px solid rgba(34,197,94,0.22)',
                  display: 'grid',
                  gap: 4,
                  fontSize: 12,
                  lineHeight: 1.4,
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
                padding: '8px 10px',
                borderRadius: 10,
                background: 'rgba(15,23,42,0.45)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#94a3b8',
                fontSize: 11,
                lineHeight: 1.4,
              }}
            >
              POD Checker includes DTG/DTF apparel export, Printful Readiness Check, Redbubble presets,
              TeePublic all-products export, Shirt Colour Preview with custom colours, and export tools.
              More POD tools coming soon.
            </div>
          </div>
        </details>
      </div>
      ) : null}
      </>
      ) : null}
    </div>
  );
}