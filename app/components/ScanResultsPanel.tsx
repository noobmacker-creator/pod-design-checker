'use client';

import React from 'react';
import type { CheckItem, ViewMode } from '../lib/podCheckerTypes';
import { statusColor, statusIcon } from '../lib/podCheckerUtils';

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
  handleDownloadFixedPng: () => void;
  handleResetDesign?: () => void;
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
  targetCanvasW: number;
  targetCanvasH: number;
};

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

      <div style={{ color: '#e5e7eb', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{item.message}</div>
    </div>
  );
}

function Section({ title, items, emptyText, headingColor }: SectionProps) {
  return (
    <div style={{ marginBottom: 18 }}>
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

              <div style={{ color: '#e5e7eb', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{item.message}</div>
            </div>
          ))}

        </div>
      )}
    </div>
  );
}

export default function ScanResultsPanel({
  file,
  actionMessage,
  downloadMessage,
  handleFileChange,
  viewMode,
  setViewMode,
  setActionMessage,
  handleQuickFix,
  handleDownloadFixedPng,
  handleResetDesign,
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
  targetCanvasW,
  targetCanvasH,
}: ScanResultsPanelProps) {
  // Auto Fix detection: once Auto Fix has run, the placement/size issues it resolves
  // should disappear from the active scan report AND from the Result Summary, instead
  // of being listed in a separate "Handled by Auto Fix" section.
  const autoFixableIssues = [
    'Design Too Small',
    'Print Safety Border',
    'Off-Center Design',
    'Empty Padding Risk',
    'Uneven Padding Risk',
    'Oversized Artwork Risk',
    'Cut-Off Edge Risk',
  ];
  const autoFixApplied = Boolean(img) && actionMessage.includes('Auto Fix applied');
  const isAutoFixableLabel = (label: string) => autoFixableIssues.includes(label);

  // After Auto Fix, drop the fixable labels from the working set so every downstream
  // list (summary, critical, warnings) treats them as resolved. The original checks
  // array is never changed; this only affects what is displayed.
  const visibleChecks = autoFixApplied
    ? checks.filter((item) => !isAutoFixableLabel(item.label))
    : checks;

  // The auto-fixable labels that were actually present in the original scan, so the
  // "Auto Fix handled" confirmation under the Download Fixed PNG area lists real items.
  const autoFixHandledLabels = autoFixableIssues.filter((label) =>
    checks.some((item) => item.label === label),
  );

  const criticalItems = visibleChecks.filter((item) => item.status === 'fail');
  const warningItems = visibleChecks.filter((item) => item.status === 'warn');
  const passedItems = visibleChecks.filter((item) => item.status === 'pass');
  const infoItems = visibleChecks.filter((item) => item.status === 'info');

  // Display grouping only: compact the many "Shirt Fit: <colour>" rows into one
  // "Shirt Colour Fit" card. This does NOT change the checks array or the summary
  // engine above; it only affects how the section lists are rendered.
  const isShirtFit = (item: CheckItem) => item.label.startsWith('Shirt Fit:');
  const shirtName = (item: CheckItem) => item.label.replace(/^Shirt Fit:\s*/, '');
  const shirtFitItems = checks.filter(isShirtFit);

  let shirtFitCard: CheckItem | null = null;
  if (shirtFitItems.length > 0) {
    const goodFit = shirtFitItems.filter((i) => i.status === 'pass').map(shirtName);
    const checkFirst = shirtFitItems.filter((i) => i.status === 'warn').map(shirtName);
    const notRecommended = shirtFitItems.filter((i) => i.status === 'fail').map(shirtName);

    const combinedStatus: CheckItem['status'] = notRecommended.length
      ? 'fail'
      : checkFirst.length
      ? 'warn'
      : goodFit.length
      ? 'pass'
      : 'info';

    shirtFitCard = {
      label: 'Shirt Colour Fit',
      status: combinedStatus,
      message: [
        `Good fit: ${goodFit.length ? goodFit.join(', ') : 'none'}`,
        `Check first: ${checkFirst.length ? checkFirst.join(', ') : 'none'}`,
        `Not recommended: ${notRecommended.length ? notRecommended.join(', ') : 'none'}`,
      ].join('\n'),
    };
  }

  const criticalDisplay = criticalItems.filter((item) => !isShirtFit(item));
  const warningDisplay = warningItems.filter((item) => !isShirtFit(item));
  const passedDisplay = passedItems.filter((item) => !isShirtFit(item));
  const infoDisplay = infoItems.filter((item) => !isShirtFit(item));

  if (shirtFitCard) {
    if (shirtFitCard.status === 'fail') criticalDisplay.push(shirtFitCard);
    else if (shirtFitCard.status === 'warn') warningDisplay.push(shirtFitCard);
    else if (shirtFitCard.status === 'pass') passedDisplay.push(shirtFitCard);
    else infoDisplay.push(shirtFitCard);
  }

  // Result Summary Engine: picks the single most important issue from the checks array.
  // Info checks are ignored. Fails always win over warns. Within each group, the issue
  // that sits highest in this priority list is chosen as the Main Issue.
  const issuePriority = [
    'Solid Background Box Risk',
    'White Background Risk',
    'Fake Transparency Background',
    'File Type Risk',
    'Canvas Size',
    'Aspect Ratio',
    'Cut-Off Edge Risk',
    'Oversized Artwork Risk',
    'Empty Padding Risk',
    'Uneven Padding Risk',
    'Design Too Small',
    'Print Safety Border',
    'White Edge / Halo Risk',
    'Compression Artifact Risk',
    'Low Contrast Risk',
    'Shirt Fit',
    'Line Thickness',
    'Off-Center Design',
    'Artwork Size',
    'Stray Speck Check',
    'Soft Transparency',
  ];

  // Match a check label to its priority key. startsWith covers grouped checks like the
  // "Shirt Fit: White" labels, which all map to the single "Shirt Fit" priority entry.
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

  const actionByIssue: Record<string, string> = {
    'Solid Background Box Risk':
      'Use a transparent PNG or remove the solid rectangle background before uploading.',
    'White Background Risk': 'Use a transparent PNG before uploading to dark shirts.',
    'Fake Transparency Background':
      'Replace the fake checkerboard background with real transparency.',
    'File Type Risk': 'Use a transparent PNG source file for best POD results.',
    'Canvas Size': 'Use the fixed export or upload a larger source file.',
    'Aspect Ratio': 'Use the fixed export so the design fits the POD canvas correctly.',
    'Cut-Off Edge Risk':
      'Use the original uncropped artwork or add transparent space around the design.',
    'Oversized Artwork Risk': 'Reduce the artwork size or add more transparent space around it.',
    'Empty Padding Risk': 'Crop empty space or use Auto Fix before uploading.',
    'Uneven Padding Risk': 'Center the artwork or crop the file more evenly.',
    'Design Too Small': 'Use Auto Fix or upload a larger artwork source.',
    'Print Safety Border': 'Use Auto Fix to move the artwork inside the safe print area.',
    'White Edge / Halo Risk': 'Clean the design edges before uploading to dark shirts.',
    'Soft Transparency': 'Preview this design on dark shirt colours before uploading.',
    'Compression Artifact Risk': 'Use a cleaner PNG source before uploading.',
    'Low Contrast Risk': 'Increase contrast so details print clearly.',
    'Shirt Fit': 'Choose shirt colours where the artwork has strong contrast.',
    'Line Thickness': 'Thicken fine lines before printing.',
    'Stray Speck Check':
      'Remove unwanted floating marks from empty transparent areas before upload.',
    'Off-Center Design': 'Use Auto Fix to center the artwork.',
    'Artwork Size': 'Check the artwork size before upload.',
  };

  const mainPick = criticalItems.length
    ? pickMainIssue(criticalItems)
    : warningItems.length
    ? pickMainIssue(warningItems)
    : { key: undefined, item: null };

  const riskLabel = !img
    ? 'UPLOAD A DESIGN'
    : criticalItems.length
    ? 'HIGH RISK'
    : warningItems.length
    ? 'NEEDS FIX'
    : 'READY';

  const riskBg = !img
    ? '#1e293b'
    : criticalItems.length
    ? '#7f1d1d'
    : warningItems.length
    ? '#78350f'
    : '#14532d';

  const mainIssue = !img
    ? '—'
    : mainPick.item
    ? mainPick.key ?? mainPick.item.label
    : autoFixApplied
    ? 'Placement and sizing issues handled'
    : 'No major issue found.';

  const nextStep = !img
    ? 'Upload a design to begin.'
    : mainPick.item
    ? actionByIssue[mainPick.key ?? ''] ?? 'Review the highlighted issue before uploading.'
    : autoFixApplied
    ? 'Review the preview, then download the fixed PNG.'
    : 'Download and upload.';

  // Manual Fix Guidance: issues Auto Fix CANNOT solve need a source-file/manual fix.
  // (autoFixableIssues is defined near the top with the Auto Fix detection.)
  const manualFixMessages: Record<string, string> = {
    'Solid Background Box Risk': 'Remove the solid rectangle background or upload a transparent PNG.',
    'White Background Risk': 'Use a transparent PNG before uploading to dark shirts.',
    'Fake Transparency Background': 'Replace the fake checkerboard background with real transparency.',
    'File Type Risk': 'Use a PNG source file with transparency for best POD results.',
    'Compression Artifact Risk': 'Use a cleaner PNG source before uploading.',
    'Soft Transparency': 'Preview this design on dark shirt colours before uploading.',
    'White Edge / Halo Risk': 'Clean the design edges before uploading to dark shirts.',
    'Low Contrast Risk': 'Increase contrast so details print clearly.',
    // Main issue key for the grouped shirt checks is "Shirt Fit"; cover both labels.
    'Shirt Fit': 'Choose shirt colours where the artwork has stronger contrast.',
    'Shirt Colour Fit': 'Choose shirt colours where the artwork has stronger contrast.',
  };

  const showManualFixCard = Boolean(img) && Boolean(mainPick.item) && !autoFixableIssues.includes(mainIssue);
  const manualFixMessage = manualFixMessages[mainIssue] ?? 'This issue needs a source-file fix before upload.';

  // The fixable placement/size issues are already removed from visibleChecks above,
  // so criticalDisplay / warningDisplay no longer contain them after Auto Fix.
  const criticalActive = criticalDisplay;
  const warningActive = warningDisplay;

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
            <div
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 12,
                background: 'rgba(2,132,199,0.12)',
                border: '1px solid rgba(125,211,252,0.35)',
              }}
            >
              <a
                href="https://buymeacoffee.com/poddesignchecker"
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(186,230,253,0.3), 0 0 16px rgba(56,189,248,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(186,230,253,0.22), 0 0 12px rgba(56,189,248,0.25)';
                }}
                style={{
                  display: 'inline-block',
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: '#0284c7',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.2)',
                  boxShadow: '0 0 0 2px rgba(186,230,253,0.22), 0 0 12px rgba(56,189,248,0.25)',
                  transition: 'box-shadow 180ms ease',
                }}
              >
                Support POD Checker
              </a>
              <div style={{ marginTop: 6, color: '#cbd5e1', fontSize: 12, lineHeight: 1.4 }}>
                Support POD Checker to help it grow and improve.
              </div>
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

          <div
            style={{
              padding: '6px 10px',
              borderRadius: 12,
              background: 'rgba(15,23,42,0.82)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#a7f3d0',
              fontSize: 12,
              fontWeight: 700,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            Next Step:{' '}
            {downloadMessage.includes('Download ready')
              ? 'Upload this fixed PNG to your POD platform, or check another design.'
              : actionMessage.includes('Auto Fix applied')
              ? 'Review the preview, then download the fixed PNG.'
              : !img
              ? 'Upload a design to begin.'
              : 'Review the scan results.'}
          </div>

          {handleResetDesign && downloadMessage.includes('Download ready') ? (
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
              }}
            >
              Check Another Design
            </button>
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
            <span style={{ fontWeight: 800 }}>Best Next Action:</span> {nextStep}
          </div>

          {img &&
          [
            'Design Too Small',
            'Print Safety Border',
            'Off-Center Design',
            'Empty Padding Risk',
            'Uneven Padding Risk',
            'Oversized Artwork Risk',
            'Cut-Off Edge Risk',
          ].includes(mainIssue) ? (
            <button
              onClick={() => {
                handleQuickFix();
                setActionMessage('Auto Fix applied. Artwork was centered and moved into a safer print area. Review the preview, then download the fixed PNG.');
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
                cursor: 'pointer',
              }}
            >
              Run Auto Fix
            </button>
          ) : null}

          {showManualFixCard ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(120,53,15,0.45)',
                border: '1px solid rgba(253,186,116,0.45)',
                display: 'grid',
                gap: 4,
              }}
            >
              <div style={{ fontWeight: 800, color: '#fdba74', fontSize: 14 }}>Manual Fix Needed</div>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: '#fde68a' }}>{manualFixMessage}</div>
            </div>
          ) : null}

          {img && criticalItems.length === 0 && warningItems.length === 0 ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(20,83,45,0.55)',
                border: '1px solid rgba(134,239,172,0.45)',
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 800, color: '#86efac', fontSize: 14 }}>
                Ready for export
              </div>
              <button
                onClick={handleDownloadFixedPng}
                style={{
                  justifySelf: 'start',
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: '#16a34a',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                }}
              >
                Download Fixed PNG
              </button>
            </div>
          ) : null}

          {img && criticalItems.length === 0 && warningItems.length > 0 ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(120,53,15,0.45)',
                border: '1px solid rgba(253,186,116,0.45)',
                fontSize: 13,
                lineHeight: 1.45,
                color: '#fde68a',
                fontWeight: 700,
              }}
            >
              You can download, but review warnings first.
            </div>
          ) : null}

          {img && actionMessage.includes('Auto Fix applied') ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(8,47,73,0.72)',
                border: '1px solid rgba(56,189,248,0.35)',
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 13, lineHeight: 1.45, color: '#7dd3fc', fontWeight: 700 }}>
                Auto Fix applied. Review the preview, then download the fixed PNG.
              </div>
              <button
                onClick={handleDownloadFixedPng}
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
                }}
              >
                Download Fixed PNG
              </button>

              {autoFixHandledLabels.length > 0 ? (
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontWeight: 800, color: '#7dd3fc', fontSize: 13 }}>Auto Fix handled:</div>
                  {autoFixHandledLabels.map((label) => (
                    <div key={`autofix-handled-${label}`} style={{ fontSize: 13, color: '#bae6fd' }}>
                      ✓ {label}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      </div>

      {/* Final Upload Check: beginner-friendly readiness checklist using existing scan data. */}
      {(() => {
        const fixedDownloaded = downloadMessage.includes('Download ready');
        const noFailRemain = criticalItems.length === 0;
        const hasWarnings = warningItems.length > 0;
        const scanCompleted = Boolean(img) && checks.length > 0;
        const autoFixNeeded = checks.some(
          (item) => isAutoFixableLabel(item.label) && (item.status === 'fail' || item.status === 'warn'),
        );

        let finalLabel: string;
        let finalColor: string;
        let finalBg: string;
        let finalMsg: string;
        if (!img || !noFailRemain) {
          finalLabel = 'NOT READY';
          finalColor = '#fca5a5';
          finalBg = 'rgba(127,29,29,0.45)';
          finalMsg = 'Fix the main issue before uploading.';
        } else if (hasWarnings) {
          finalLabel = 'REVIEW FIRST';
          finalColor = '#fde68a';
          finalBg = 'rgba(120,53,15,0.45)';
          finalMsg = 'Review remaining warnings before upload.';
        } else if (fixedDownloaded) {
          finalLabel = 'READY TO UPLOAD';
          finalColor = '#86efac';
          finalBg = 'rgba(20,83,45,0.55)';
          finalMsg = 'Your fixed PNG is ready for POD upload.';
        } else {
          finalLabel = 'READY TO DOWNLOAD';
          finalColor = '#7dd3fc';
          finalBg = 'rgba(7,89,133,0.50)';
          finalMsg = 'No critical issues remain. Download the fixed PNG before uploading.';
        }

        const checklist = [
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
            label: fixedDownloaded ? 'Fixed PNG downloaded' : 'Download fixed PNG before upload',
            status: fixedDownloaded ? 'pass' : img ? 'warn' : 'fail',
          },
        ];
        const mark = (s: string) => (s === 'pass' ? '✓' : s === 'warn' ? '⚠' : '✕');
        const markColor = (s: string) => (s === 'pass' ? '#86efac' : s === 'warn' ? '#fde68a' : '#fca5a5');

        return (
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              background: 'rgba(2,6,23,0.92)',
              border: '1px solid rgba(56,189,248,0.28)',
              display: 'grid',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 13, color: '#ffffff', fontWeight: 800, letterSpacing: 0.4 }}>
                FINAL UPLOAD CHECK
              </div>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  color: finalColor,
                  background: finalBg,
                }}
              >
                {finalLabel}
              </div>
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.45, color: '#cbd5e1' }}>{finalMsg}</div>

            <div style={{ display: 'grid', gap: 6 }}>
              {checklist.map((c) => (
                <div
                  key={`final-check-${c.label}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                >
                  <span style={{ color: markColor(c.status), fontWeight: 800, width: 16 }}>
                    {mark(c.status)}
                  </span>
                  <span style={{ color: '#e5e7eb' }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {criticalActive.length > 0 ? (
        <Section
          title="Critical Issues"
          items={criticalActive}
          emptyText="No critical issues."
          headingColor="#fca5a5"
        />
      ) : (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>No critical issues.</div>
      )}

      {warningActive.length > 0 ? (
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 800, color: '#fdba74' }}>Warnings</div>
            <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>{warningActive.length}</div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {warningActive.slice(0, 3).map((item, index) => (
              <CheckCard key={`Warnings-${item.label}-${index}`} item={item} keyHint={`Warnings-${item.label}-${index}`} />
            ))}
          </div>

          {warningActive.length > 3 ? (
            <details
              style={{
                marginTop: 8,
                padding: '8px 10px',
                borderRadius: 10,
                background: 'rgba(15,23,42,0.55)',
                border: '1px solid rgba(253,186,116,0.25)',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#fdba74', fontSize: 13 }}>
                Show More Warnings ({warningActive.length - 3})
              </summary>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {warningActive.slice(3).map((item, index) => (
                  <CheckCard
                    key={`Warnings-more-${item.label}-${index}`}
                    item={item}
                    keyHint={`Warnings-more-${item.label}-${index}`}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>No warnings.</div>
      )}

      {passedDisplay.length > 0 ? (
        <details
          style={{
            marginBottom: 8,
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(15,23,42,0.55)',
            border: '1px solid rgba(134,239,172,0.2)',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#86efac', fontSize: 13 }}>
            Show Passed Checks ({passedDisplay.length})
          </summary>
          <div style={{ marginTop: 10 }}>
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
        <Section
          title="Info"
          items={infoDisplay}
          emptyText="No info checks."
          headingColor="#7dd3fc"
        />
      ) : null}

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
        V2 supports DTG/DTF apparel export, Redbubble presets, and TeePublic all-products export. More POD tools coming soon.
      </div>
    </div>
  );
}