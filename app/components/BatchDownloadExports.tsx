'use client';

import React, { useMemo, useState } from 'react';
import type { BatchQueueItem } from '../lib/batchQueueUtils';
import {
  buildBatchProductExportZip,
  buildBatchReadyFilesZip,
  computeBatchProductOutputCount,
  getEligibleBatchExportItems,
  getPresetsForQuickExportPack,
  makeCustomSizePreset,
  parseCustomExportSize,
  triggerZipDownload,
} from '../lib/batchProductExport';
import {
  getFixedSizePresetsGrouped,
  getQuickExportPackPresetIds,
  QUICK_EXPORT_CATEGORY_PACKS,
  QUICK_EXPORT_PLATFORM_PACKS,
  type ProductConverterPreset,
  type QuickExportPackId,
} from '../lib/productConverterPresets';

type ExportChoice = 'ready' | 'quick-pack' | 'choose-products';

type BatchDownloadExportsProps = {
  queueItems: BatchQueueItem[];
};

const choiceButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
  background: active ? 'rgba(37, 99, 235, 0.28)' : 'rgba(148, 163, 184, 0.10)',
  color: active ? '#bfdbfe' : '#94a3b8',
  border: active
    ? '1px solid rgba(147, 197, 253, 0.45)'
    : '1px solid rgba(148, 163, 184, 0.22)',
  cursor: 'pointer',
});

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

const primaryButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 800,
  background: '#2563eb',
  color: '#ffffff',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
};

export default function BatchDownloadExports({ queueItems }: BatchDownloadExportsProps) {
  const [exportChoice, setExportChoice] = useState<ExportChoice>('ready');
  const [selectedPackId, setSelectedPackId] = useState<QuickExportPackId | null>(null);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(() => new Set());
  const [productSearch, setProductSearch] = useState('');
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [customSizeError, setCustomSizeError] = useState('');
  const [activeCustomSize, setActiveCustomSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [progressDetail, setProgressDetail] = useState('');

  const eligibleItems = useMemo(
    () => getEligibleBatchExportItems(queueItems),
    [queueItems],
  );

  const platformGroups = useMemo(() => getFixedSizePresetsGrouped(), []);
  const allPresets = useMemo(
    () => platformGroups.flatMap((group) => group.presets),
    [platformGroups],
  );

  const selectedPackPresets = useMemo(() => {
    if (!selectedPackId) return [];
    return getPresetsForQuickExportPack(selectedPackId);
  }, [selectedPackId]);

  const activePresets = useMemo((): ProductConverterPreset[] => {
    if (exportChoice === 'quick-pack') return selectedPackPresets;
    if (exportChoice === 'choose-products') {
      const presets = allPresets.filter((preset) => selectedPresetIds.has(preset.id));
      if (activeCustomSize) {
        return [
          ...presets,
          makeCustomSizePreset(activeCustomSize.width, activeCustomSize.height),
        ];
      }
      return presets;
    }
    return [];
  }, [exportChoice, selectedPackPresets, allPresets, selectedPresetIds, activeCustomSize]);

  const designCount = eligibleItems.length;
  const productCount = exportChoice === 'ready' ? 1 : activePresets.length;
  const totalOutputCount = computeBatchProductOutputCount(designCount, productCount);

  const filteredGroups = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return platformGroups;
    return platformGroups
      .map((group) => ({
        ...group,
        presets: group.presets.filter(
          (preset) =>
            preset.label.toLowerCase().includes(query) ||
            preset.category.toLowerCase().includes(query) ||
            group.platformLabel.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.presets.length > 0);
  }, [platformGroups, productSearch]);

  const canExportReady = designCount > 0 && !busy;
  const canExportProducts =
    designCount > 0 && activePresets.length > 0 && !busy;

  function handleQuickPack(packId: QuickExportPackId) {
    setSelectedPackId(packId);
    setMessage('');
  }

  function togglePreset(id: string) {
    setSelectedPresetIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMessage('');
  }

  function handleSelectAllProducts() {
    setSelectedPresetIds(new Set(allPresets.map((preset) => preset.id)));
    setMessage('');
  }

  function handleClearAllProducts() {
    setSelectedPresetIds(new Set());
    setMessage('');
  }

  function handleUseCustomSize() {
    const parsed = parseCustomExportSize(customWidth, customHeight);
    if (!parsed.valid) {
      setCustomSizeError(parsed.error);
      return;
    }
    setActiveCustomSize({ width: parsed.width, height: parsed.height });
    setCustomSizeError('');
    setMessage('');
  }

  function handleRemoveCustomSize() {
    setActiveCustomSize(null);
    setCustomSizeError('');
    setMessage('');
  }

  async function handleDownloadReadyFiles() {
    if (queueItems.length === 0) {
      setMessage('Upload a design before building an export pack.');
      return;
    }
    if (eligibleItems.length === 0) {
      setMessage('No ready designs to export.');
      return;
    }

    setBusy(true);
    setMessage('');
    setProgressMessage('Building export pack...');
    setProgressDetail('');

    try {
      const result = await buildBatchReadyFilesZip(eligibleItems, setProgressMessage);
      if (!result) {
        setMessage('Could not export any ready designs. Check that the files can be loaded.');
        setProgressMessage('');
        return;
      }

      triggerZipDownload(result.zipBlob, 'pod-checker-batch-ready-files.zip');
      setProgressMessage('Export pack ready. Check your Downloads folder.');
      if (result.skippedDesigns.length > 0) {
        setMessage(`Skipped ${result.skippedDesigns.length} design(s) that could not be loaded.`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadProductZip() {
    if (queueItems.length === 0) {
      setMessage('Upload a design before building an export pack.');
      return;
    }
    if (eligibleItems.length === 0) {
      setMessage('No ready designs to export.');
      return;
    }
    if (activePresets.length === 0) {
      setMessage('Choose at least one export size.');
      return;
    }

    setBusy(true);
    setMessage('');
    setProgressMessage('Building export pack...');
    setProgressDetail('');

    try {
      const result = await buildBatchProductExportZip(
        eligibleItems,
        activePresets,
        (progress) => {
          setProgressMessage(progress.message);
          setProgressDetail(`${progress.designName} — ${progress.productName}`);
        },
      );

      if (!result) {
        setMessage('Could not export any selected designs. Check that the files can be loaded.');
        setProgressMessage('');
        setProgressDetail('');
        return;
      }

      triggerZipDownload(result.zipBlob, 'batch-product-exports.zip');
      setProgressMessage('Export pack ready. Check your Downloads folder.');

      const notes: string[] = [];
      if (result.skippedDesigns.length > 0) {
        notes.push(`Skipped ${result.skippedDesigns.length} design(s) that could not be loaded.`);
      }
      if (result.failedOutputs.length > 0) {
        notes.push(`${result.failedOutputs.length} export(s) failed.`);
      }
      if (notes.length > 0) setMessage(notes.join(' '));
    } finally {
      setBusy(false);
    }
  }

  function renderQuickPackButtons(
    packs: { id: QuickExportPackId; label: string }[],
  ) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {packs.map((pack) => {
          const presetCount = getQuickExportPackPresetIds(pack.id).length;
          if (presetCount === 0) return null;
          const active = selectedPackId === pack.id;
          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => handleQuickPack(pack.id)}
              disabled={busy}
              style={{
                ...secondaryButtonStyle,
                background: active ? 'rgba(37, 99, 235, 0.28)' : secondaryButtonStyle.background,
                color: active ? '#bfdbfe' : '#e2e8f0',
                border: active
                  ? '1px solid rgba(147, 197, 253, 0.45)'
                  : secondaryButtonStyle.border,
              }}
            >
              {pack.label}
            </button>
          );
        })}
      </div>
    );
  }

  function renderCustomSizeSection() {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <details
          style={{
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: 10,
            padding: '8px 10px',
            background: 'rgba(15, 23, 42, 0.45)',
          }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 800,
              color: '#cbd5e1',
              listStyle: 'none',
            }}
          >
            ▸ Add a Custom Size
          </summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Custom Batch Size
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#e2e8f0' }}>
                Width
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customWidth}
                    onChange={(e) => {
                      setCustomWidth(e.target.value);
                      setCustomSizeError('');
                    }}
                    disabled={busy}
                    placeholder="4200"
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: '1px solid rgba(148, 163, 184, 0.35)',
                      background: 'rgba(15, 23, 42, 0.85)',
                      color: '#e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>px</span>
                </div>
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#e2e8f0' }}>
                Height
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customHeight}
                    onChange={(e) => {
                      setCustomHeight(e.target.value);
                      setCustomSizeError('');
                    }}
                    disabled={busy}
                    placeholder="4800"
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: '1px solid rgba(148, 163, 184, 0.35)',
                      background: 'rgba(15, 23, 42, 0.85)',
                      color: '#e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>px</span>
                </div>
              </label>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
              Apply this size to all ready designs.
            </div>
            {customSizeError ? (
              <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.4 }}>{customSizeError}</div>
            ) : null}
            <button
              type="button"
              onClick={handleUseCustomSize}
              disabled={busy}
              style={secondaryButtonStyle}
            >
              Use Custom Size
            </button>
          </div>
        </details>

        {activeCustomSize ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 10,
              background: 'rgba(37, 99, 235, 0.10)',
              border: '1px solid rgba(147, 197, 253, 0.25)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>
              Custom Size — {activeCustomSize.width} × {activeCustomSize.height} px
            </span>
            <button
              type="button"
              onClick={handleRemoveCustomSize}
              disabled={busy}
              style={{ ...secondaryButtonStyle, marginLeft: 'auto' }}
            >
              Remove
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderPresetChecklist() {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <input
          type="search"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Search products..."
          disabled={busy}
          style={{
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid rgba(148, 163, 184, 0.35)',
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#e2e8f0',
            fontSize: 12,
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <button type="button" onClick={handleSelectAllProducts} disabled={busy} style={secondaryButtonStyle}>
            Select All
          </button>
          <button type="button" onClick={handleClearAllProducts} disabled={busy} style={secondaryButtonStyle}>
            Clear All
          </button>
          <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>
            {selectedPresetIds.size === 0
              ? '0 products selected'
              : `${selectedPresetIds.size} product${selectedPresetIds.size === 1 ? '' : 's'} selected`}
          </span>
        </div>
        <div
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: 10,
            padding: '8px 10px',
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'grid',
            gap: 10,
          }}
        >
          {filteredGroups.map((group) => (
            <div key={group.platformId} style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#bae6fd' }}>{group.platformLabel}</div>
              {group.presets.map((preset) => (
                <label
                  key={preset.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    color: '#e2e8f0',
                    lineHeight: 1.35,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPresetIds.has(preset.id)}
                    disabled={busy}
                    onChange={() => togglePreset(preset.id)}
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
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      id="batch-download-exports"
      style={{
        display: 'grid',
        gap: 10,
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          onClick={() => {
            setExportChoice('ready');
            setMessage('');
          }}
          style={choiceButtonStyle(exportChoice === 'ready')}
        >
          Ready Files
        </button>
        <button
          type="button"
          onClick={() => {
            setExportChoice('quick-pack');
            setMessage('');
          }}
          style={choiceButtonStyle(exportChoice === 'quick-pack')}
        >
          Quick Export Pack
        </button>
        <button
          type="button"
          onClick={() => {
            setExportChoice('choose-products');
            setMessage('');
          }}
          style={choiceButtonStyle(exportChoice === 'choose-products')}
        >
          Choose Products
        </button>
      </div>

      {designCount === 0 ? (
        <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.4 }}>
          No ready designs to export. Only Ready designs are included — Need Review and Failed designs are skipped.
        </div>
      ) : null}

      {exportChoice === 'ready' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>
            Download one transparent PNG per ready design — no extra product sizes.
          </div>
          {designCount > 0 ? (
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              One ZIP · One folder per design
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void handleDownloadReadyFiles()}
            disabled={!canExportReady}
            style={{
              ...primaryButtonStyle,
              opacity: canExportReady ? 1 : 0.55,
              cursor: canExportReady ? 'pointer' : 'not-allowed',
              boxShadow: canExportReady ? '0 10px 20px rgba(37, 99, 235, 0.30)' : 'none',
            }}
          >
            {busy && exportChoice === 'ready' ? 'Building export pack...' : 'Download Batch ZIP'}
          </button>
        </div>
      ) : null}

      {exportChoice === 'quick-pack' ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Category Packs
          </div>
          {renderQuickPackButtons(QUICK_EXPORT_CATEGORY_PACKS)}
          <div style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Platform Packs
          </div>
          {renderQuickPackButtons(QUICK_EXPORT_PLATFORM_PACKS)}
          {selectedPackId && selectedPackPresets.length > 0 ? (
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.22)',
                display: 'grid',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>
                {QUICK_EXPORT_CATEGORY_PACKS.find((p) => p.id === selectedPackId)?.label ??
                  QUICK_EXPORT_PLATFORM_PACKS.find((p) => p.id === selectedPackId)?.label ??
                  'Selected pack'}
              </div>
              <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>
                {selectedPackPresets.length} size{selectedPackPresets.length === 1 ? '' : 's'} selected
              </div>
              {selectedPackPresets.slice(0, 8).map((preset) => (
                <div key={preset.id} style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.4 }}>
                  {preset.label} — {preset.width} × {preset.height}
                </div>
              ))}
              {selectedPackPresets.length > 8 ? (
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  + {selectedPackPresets.length - 8} more
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Choose a pack to see included products.</div>
          )}
        </div>
      ) : null}

      {exportChoice === 'choose-products' ? (
        <>
          {renderPresetChecklist()}
          {designCount > 0 ? renderCustomSizeSection() : null}
        </>
      ) : null}

      {exportChoice !== 'ready' && designCount > 0 && activePresets.length > 0 ? (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            background: 'rgba(37, 99, 235, 0.10)',
            border: '1px solid rgba(147, 197, 253, 0.25)',
            display: 'grid',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>
            {designCount} ready design{designCount === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>
            × {activePresets.length} export size{activePresets.length === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#bfdbfe' }}>
            = {totalOutputCount} PNG file{totalOutputCount === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>One ZIP · One folder per design</div>
        </div>
      ) : null}

      {exportChoice !== 'ready' ? (
        <button
          type="button"
          onClick={() => void handleDownloadProductZip()}
          disabled={!canExportProducts}
          style={{
            ...primaryButtonStyle,
            opacity: canExportProducts ? 1 : 0.55,
            cursor: canExportProducts ? 'pointer' : 'not-allowed',
            boxShadow: canExportProducts ? '0 10px 20px rgba(37, 99, 235, 0.30)' : 'none',
          }}
        >
          {busy
            ? 'Creating exports...'
            : totalOutputCount > 0
              ? `Create ZIP with ${totalOutputCount} PNG${totalOutputCount === 1 ? '' : 's'}`
              : 'Create Batch ZIP'}
        </button>
      ) : null}

      {busy && exportChoice !== 'ready' ? (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#f8fafc' }}>CREATING EXPORTS</div>
          {progressMessage ? (
            <div style={{ fontSize: 12, color: '#93c5fd', fontWeight: 700 }}>{progressMessage}</div>
          ) : null}
          {progressDetail ? (
            <div style={{ fontSize: 11, color: '#94a3b8', wordBreak: 'break-all' }}>{progressDetail}</div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.4 }}>{message}</div>
      ) : null}

      {!busy && progressMessage && exportChoice === 'ready' ? (
        <div
          style={{
            fontSize: 12,
            color: progressMessage.includes('ready') ? '#86efac' : '#cbd5e1',
            lineHeight: 1.4,
            fontWeight: progressMessage.includes('ready') ? 700 : 400,
          }}
        >
          {progressMessage}
        </div>
      ) : null}

      {!busy && progressMessage && exportChoice !== 'ready' && !progressMessage.includes('Building') ? (
        <div style={{ fontSize: 12, color: '#86efac', fontWeight: 700, lineHeight: 1.4 }}>
          {progressMessage}
        </div>
      ) : null}
    </div>
  );
}
