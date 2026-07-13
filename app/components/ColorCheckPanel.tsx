'use client';

import React, { useState } from 'react';
import {
  COLOR_CHECK_PRESETS,
  addCustomColour,
  buildActiveColourEntries,
  createComparisonSheetBlob,
  getColourCheckFilename,
  normalizeHexColour,
  resetToDefaultSelection,
  togglePresetSelection,
  triggerBlobDownload,
} from '../lib/colorCheckUtils';

type ColorCheckPanelProps = {
  file: File | null;
  img: HTMLImageElement | null;
  selectedPresetIds: Set<string>;
  onSelectedPresetIdsChange: (next: Set<string>) => void;
  customColours: string[];
  onCustomColoursChange: (next: string[]) => void;
  showCheckerboard: boolean;
  onShowCheckerboardChange: (next: boolean) => void;
};

const sectionStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: 'rgba(15, 23, 42, 0.65)',
  border: '1px solid rgba(147, 197, 253, 0.25)',
  display: 'grid',
  gap: 10,
};

const presetButtonStyle = (selected: boolean): React.CSSProperties => ({
  padding: '7px 10px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  background: selected ? '#2563eb' : 'rgba(37, 99, 235, 0.14)',
  color: selected ? '#ffffff' : '#bfdbfe',
  border: selected ? '1px solid rgba(96, 165, 250, 0.85)' : '1px solid rgba(147, 197, 253, 0.35)',
});

export default function ColorCheckPanel({
  file,
  img,
  selectedPresetIds,
  onSelectedPresetIdsChange,
  customColours,
  onCustomColoursChange,
  showCheckerboard,
  onShowCheckerboardChange,
}: ColorCheckPanelProps) {
  const [customHexInput, setCustomHexInput] = useState('#7A3F91');
  const [customError, setCustomError] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [downloading, setDownloading] = useState(false);

  const activeColours = buildActiveColourEntries(selectedPresetIds, customColours);
  const selectedCount = activeColours.length;

  const handleTogglePreset = (presetId: string) => {
    onSelectedPresetIdsChange(togglePresetSelection(selectedPresetIds, presetId));
  };

  const handleSelectAll = () => {
    onSelectedPresetIdsChange(new Set(COLOR_CHECK_PRESETS.map((preset) => preset.id)));
  };

  const handleResetDefaults = () => {
    onSelectedPresetIdsChange(resetToDefaultSelection());
    onCustomColoursChange([]);
    onShowCheckerboardChange(false);
    setCustomError(null);
  };

  const handleAddCustom = () => {
    const result = addCustomColour(customColours, customHexInput);
    if (result.error) {
      setCustomError(result.error);
      return;
    }
    onCustomColoursChange(result.colours);
    setCustomError(null);
  };

  const handleDownloadSheet = async () => {
    if (!img || !file) {
      setDownloadMessage('Upload a design before downloading a comparison sheet.');
      return;
    }
    setDownloading(true);
    setDownloadMessage('Creating comparison sheet...');
    try {
      const blob = await createComparisonSheetBlob(
        img,
        file.name,
        activeColours,
        showCheckerboard,
      );
      if (!blob) {
        setDownloadMessage('Could not create comparison sheet. Select at least one colour.');
        return;
      }
      triggerBlobDownload(blob, getColourCheckFilename(file.name));
      setDownloadMessage('Comparison sheet downloaded. Check your Downloads folder.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12, padding: 12, minWidth: 0 }}>
      <div style={sectionStyle}>
        <div style={{ fontWeight: 900, fontSize: 14, color: '#93c5fd' }}>TEST COLOURS</div>
        <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45 }}>
          Show or hide background colours for comparison.
        </div>
        <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 700 }}>
          Selected: {selectedCount}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COLOR_CHECK_PRESETS.map((preset) => {
            const selected = selectedPresetIds.has(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() => handleTogglePreset(preset.id)}
                style={presetButtonStyle(selected)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={handleSelectAll} style={{ fontSize: 12, padding: '7px 10px' }}>
            Select All
          </button>
          <button type="button" onClick={handleResetDefaults} style={{ fontSize: 12, padding: '7px 10px' }}>
            Reset to Defaults
          </button>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#93c5fd', letterSpacing: '0.04em' }}>
            CUSTOM COLOUR
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="color"
              value={getPickerHexValue(customHexInput)}
              onChange={(event) => {
                setCustomHexInput(event.target.value.toUpperCase());
                setCustomError(null);
              }}
              aria-label="Custom colour picker"
              style={{ width: 36, height: 36, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
            <input
              type="text"
              value={customHexInput}
              onChange={(event) => {
                setCustomHexInput(event.target.value);
                setCustomError(null);
              }}
              onBlur={() => {
                const normalized = normalizeHexColour(customHexInput);
                if (normalized) setCustomHexInput(normalized);
              }}
              placeholder="#7A3F91"
              aria-label="Custom hex colour"
              style={{
                flex: 1,
                minWidth: 100,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid rgba(148, 163, 184, 0.35)',
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#f8fafc',
                fontSize: 13,
              }}
            />
            <button type="button" onClick={handleAddCustom} style={{ fontSize: 12, padding: '7px 10px', whiteSpace: 'nowrap' }}>
              Add
            </button>
          </div>
          {customError ? (
            <div style={{ color: '#fca5a5', fontSize: 11, lineHeight: 1.35 }}>{customError}</div>
          ) : customColours.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.35 }}>
              Add a colour using the picker or hex value.
            </div>
          ) : null}
          {customColours.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {customColours.map((hex) => (
                <div
                  key={hex}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 12,
                    color: '#e2e8f0',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        background: hex,
                        border: '1px solid rgba(148, 163, 184, 0.45)',
                      }}
                    />
                    Custom {hex}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCustomColoursChange(customColours.filter((c) => c !== hex))}
                    style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: '#cbd5e1',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={showCheckerboard}
            onChange={(event) => onShowCheckerboardChange(event.target.checked)}
          />
          Show Transparency (checkerboard)
        </label>
      </div>

      {img && file ? (
        <div style={sectionStyle}>
          <div style={{ fontWeight: 900, fontSize: 14, color: '#93c5fd' }}>DOWNLOAD COLOUR TEST</div>
          <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45 }}>
            Creates a reference sheet showing your design on the selected colours.
          </div>
          <div style={{ color: '#64748b', fontSize: 11, lineHeight: 1.35 }}>
            Reference image only — not a print-ready artwork file.
          </div>
          <button
            type="button"
            onClick={handleDownloadSheet}
            disabled={downloading || activeColours.length === 0}
            style={{
              width: '100%',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 800,
              borderRadius: 12,
              padding: '12px 16px',
              opacity: downloading || activeColours.length === 0 ? 0.55 : 1,
              cursor: downloading || activeColours.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Download Comparison Sheet
          </button>
          {downloadMessage ? (
            <div style={{ color: '#86efac', fontSize: 11, lineHeight: 1.35 }}>{downloadMessage}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getPickerHexValue(value: string): string {
  const normalized = normalizeHexColour(value);
  return normalized ?? '#7A3F91';
}
