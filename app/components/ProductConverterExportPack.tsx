'use client';

import React, { useMemo, useState } from 'react';
import {
  createConverterExportBlob,
  sanitizeUploadBasename,
} from '../lib/productConverterExport';
import {
  getFixedSizePresetsGrouped,
  type ProductConverterPreset,
} from '../lib/productConverterPresets';

type ProductConverterExportPackProps = {
  img: HTMLImageElement | null;
  file: File | null;
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: '#93c5fd',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const mutedStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#94a3b8',
  lineHeight: 1.45,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(15, 23, 42, 0.85)',
  color: '#e2e8f0',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
};

export default function ProductConverterExportPack({ img, file }: ProductConverterExportPackProps) {
  const platformGroups = useMemo(() => getFixedSizePresetsGrouped(), []);
  const allPresets = useMemo(
    () => platformGroups.flatMap((group) => group.presets),
    [platformGroups],
  );
  const allPresetIds = useMemo(() => allPresets.map((preset) => preset.id), [allPresets]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [exportBusy, setExportBusy] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  const selectedCount = selectedIds.size;
  const canDownload = img !== null && selectedCount > 0 && !exportBusy;

  function togglePreset(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setResultMessage('');
  }

  function handleSelectAll() {
    setSelectedIds(new Set(allPresetIds));
    setResultMessage('');
  }

  function handleClearAll() {
    setSelectedIds(new Set());
    setResultMessage('');
  }

  async function handleDownloadPack() {
    if (!img || !canDownload) return;

    const selectedPresets = allPresets.filter((preset) => selectedIds.has(preset.id));
    if (selectedPresets.length === 0) return;

    setExportBusy(true);
    setResultMessage('');
    setProgressText('Creating export pack…');

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const total = selectedPresets.length;

      for (let i = 0; i < selectedPresets.length; i++) {
        const preset = selectedPresets[i];
        setProgressText(`Creating ${i + 1} of ${total} files…`);

        const blob = await createConverterExportBlob(img, preset.width, preset.height);
        if (!blob) {
          setResultMessage(`Export failed while creating ${preset.label}. Try again.`);
          setProgressText('');
          setExportBusy(false);
          return;
        }

        zip.file(preset.filename, blob);
      }

      setProgressText('Finalising ZIP…');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const uploadBasename = file ? sanitizeUploadBasename(file.name) : 'design';
      const zipFilename = `${uploadBasename}-pod-export-pack.zip`;

      const objectUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.download = zipFilename;
      link.href = objectUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      setResultMessage(`Export pack downloaded — ${total} PNG file${total === 1 ? '' : 's'} created.`);
      setProgressText('');
    } catch {
      setResultMessage('Export pack failed. Try again with fewer products selected.');
      setProgressText('');
    } finally {
      setExportBusy(false);
    }
  }

  function renderPresetRow(preset: ProductConverterPreset) {
    const checked = selectedIds.has(preset.id);
    return (
      <label
        key={preset.id}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '4px 0',
          cursor: 'pointer',
          fontSize: 12,
          color: '#e2e8f0',
          lineHeight: 1.35,
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => togglePreset(preset.id)}
          disabled={exportBusy}
          style={{ marginTop: 2, flexShrink: 0 }}
        />
        <span>
          <span style={{ fontWeight: 700 }}>{preset.label}</span>
          <span style={{ color: '#94a3b8' }}>
            {' '}
            — {preset.width} × {preset.height}
          </span>
        </span>
      </label>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        paddingTop: 8,
        borderTop: '1px solid rgba(148, 163, 184, 0.18)',
      }}
    >
      <div style={labelStyle}>Multi-Product Export Pack</div>
      <div style={mutedStyle}>
        Select several products and download every converted PNG in one ZIP.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <button type="button" onClick={handleSelectAll} disabled={exportBusy} style={secondaryButtonStyle}>
          Select All
        </button>
        <button type="button" onClick={handleClearAll} disabled={exportBusy} style={secondaryButtonStyle}>
          Clear All
        </button>
        <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>
          {selectedCount === 0
            ? '0 products selected'
            : selectedCount === 1
              ? '1 product selected'
              : `${selectedCount} products selected`}
        </span>
      </div>

      <div
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: 10,
          padding: '8px 10px',
          background: 'rgba(15, 23, 42, 0.45)',
          display: 'grid',
          gap: 10,
        }}
      >
        {platformGroups.map((group) => (
          <div key={group.platformId} style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#bae6fd' }}>{group.platformLabel}</div>
            {group.presets.map((preset) => renderPresetRow(preset))}
          </div>
        ))}
      </div>

      {progressText ? (
        <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 700 }}>{progressText}</div>
      ) : null}

      {resultMessage ? (
        <div
          style={{
            fontSize: 12,
            color: resultMessage.includes('failed') ? '#fca5a5' : '#86efac',
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          {resultMessage}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleDownloadPack()}
        disabled={!canDownload}
        aria-disabled={!canDownload}
        style={{
          width: '100%',
          background: '#2563eb',
          color: '#ffffff',
          fontWeight: 800,
          borderRadius: 12,
          padding: '12px 16px',
          opacity: canDownload ? 1 : 0.55,
          boxShadow: canDownload ? '0 10px 20px rgba(37, 99, 235, 0.30)' : 'none',
          cursor: canDownload ? 'pointer' : 'not-allowed',
          border: 'none',
        }}
      >
        Download Export Pack
      </button>
    </div>
  );
}
