'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CONVERTER_PLATFORMS,
  CUSTOM_DIMENSION_MAX,
  CUSTOM_DIMENSION_MIN,
  type ConverterPlatformId,
  getCustomDimensionFilename,
  getDefaultPresetIdForPlatform,
  getPresetById,
  getPresetsForPlatform,
  isValidCustomDimensions,
  platformUsesCustomDimensions,
  type ProductConverterPreset,
} from '../lib/productConverterPresets';
import {
  getPreviewBackgroundStyle,
  PREVIEW_BACKGROUND_OPTIONS,
  type PreviewBackground,
} from './DesignPreviewPanel';
import ProductConverterExportPack from './ProductConverterExportPack';

const SOURCE_CANVAS_W = 4200;
const SOURCE_CANVAS_H = 4800;

type ProductConverterPanelProps = {
  onDownloadConverted: (
    image: HTMLImageElement,
    width: number,
    height: number,
    exactFilename: string,
    presetLabel: string,
  ) => void;
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(15, 23, 42, 0.85)',
  color: '#f8fafc',
  fontWeight: 700,
  fontSize: 13,
  boxSizing: 'border-box',
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

function drawConvertedPreview(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.clearRect(0, 0, targetWidth, targetHeight);

  const scaleX = SOURCE_CANVAS_W / image.naturalWidth;
  const scaleY = SOURCE_CANVAS_H / image.naturalHeight;
  const fitScaleToCanvas = Math.min(scaleX, scaleY);
  const scaledW = image.naturalWidth * fitScaleToCanvas;
  const scaledH = image.naturalHeight * fitScaleToCanvas;
  const offsetX = Math.round((SOURCE_CANVAS_W - scaledW) / 2);
  const offsetY = Math.round((SOURCE_CANVAS_H - scaledH) / 2);

  const canvasFitScale = Math.min(targetWidth / SOURCE_CANVAS_W, targetHeight / SOURCE_CANVAS_H);
  const padX = (targetWidth - SOURCE_CANVAS_W * canvasFitScale) / 2;
  const padY = (targetHeight - SOURCE_CANVAS_H * canvasFitScale) / 2;
  const drawW = image.naturalWidth * fitScaleToCanvas * canvasFitScale;
  const drawH = image.naturalHeight * fitScaleToCanvas * canvasFitScale;
  const drawX = offsetX * canvasFitScale + padX;
  const drawY = offsetY * canvasFitScale + padY;

  ctx.drawImage(image, drawX, drawY, drawW, drawH);
}

export default function ProductConverterPanel({ onDownloadConverted }: ProductConverterPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [platform, setPlatform] = useState<ConverterPlatformId>('standard');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    getDefaultPresetIdForPlatform('standard') ?? 'standard-apparel',
  );
  const [customWidth, setCustomWidth] = useState('3000');
  const [customHeight, setCustomHeight] = useState('3000');
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [previewBackground, setPreviewBackground] = useState<PreviewBackground>('checker');
  const [customPreviewColor, setCustomPreviewColor] = useState('#808080');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const platformPresets = useMemo(() => getPresetsForPlatform(platform), [platform]);
  const selectedPreset = useMemo((): ProductConverterPreset | null => {
    if (platformUsesCustomDimensions(platform)) return null;
    return getPresetById(selectedPresetId) ?? platformPresets[0] ?? null;
  }, [platform, selectedPresetId, platformPresets]);

  const customWidthNum = Number.parseInt(customWidth, 10);
  const customHeightNum = Number.parseInt(customHeight, 10);
  const customDimensionsValid = isValidCustomDimensions(customWidthNum, customHeightNum);

  const targetWidth = platformUsesCustomDimensions(platform)
    ? customDimensionsValid
      ? customWidthNum
      : 0
    : selectedPreset?.width ?? 0;

  const targetHeight = platformUsesCustomDimensions(platform)
    ? customDimensionsValid
      ? customHeightNum
      : 0
    : selectedPreset?.height ?? 0;

  const targetFilename = platformUsesCustomDimensions(platform)
    ? customDimensionsValid
      ? getCustomDimensionFilename(
          platform as 'gelato' | 'custom',
          customWidthNum,
          customHeightNum,
        )
      : ''
    : selectedPreset?.filename ?? '';

  const targetLabel = platformUsesCustomDimensions(platform)
    ? platform === 'gelato'
      ? 'Gelato Apparel'
      : 'Custom Size'
    : selectedPreset?.label ?? '';

  const canDownload =
    img !== null &&
    targetWidth > 0 &&
    targetHeight > 0 &&
    targetFilename.length > 0 &&
    (platformUsesCustomDimensions(platform) ? customDimensionsValid : selectedPreset !== null);

  useEffect(() => {
    const defaultId = getDefaultPresetIdForPlatform(platform);
    if (defaultId) {
      setSelectedPresetId(defaultId);
    }
  }, [platform]);

  useEffect(() => {
    if (!img || !previewCanvasRef.current || targetWidth <= 0 || targetHeight <= 0) return;
    drawConvertedPreview(previewCanvasRef.current, img, targetWidth, targetHeight);
  }, [img, targetWidth, targetHeight]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;

    const url = URL.createObjectURL(selected);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      setFile(selected);
      setImg(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setFile(null);
      setImg(null);
    };
    image.src = url;
  }

  function handleDownload() {
    if (!img || !canDownload) return;
    onDownloadConverted(img, targetWidth, targetHeight, targetFilename, targetLabel);
  }

  function handleClearDesign() {
    setFile(null);
    setImg(null);
    setPreviewBackground('checker');
    setUploadInputKey((value) => value + 1);
    if (previewCanvasRef.current) {
      const ctx = previewCanvasRef.current.getContext('2d', { alpha: true });
      if (ctx) {
        ctx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
      }
    }
  }

  function handleUploadButtonClick() {
    fileInputRef.current?.click();
  }

  const previewScale = useMemo(() => {
    if (targetWidth <= 0 || targetHeight <= 0) return 0.12;
    const maxW = 680;
    const maxH = 420;
    return Math.min(maxW / targetWidth, maxH / targetHeight, 0.22);
  }, [targetWidth, targetHeight]);

  const zazzleCategories = useMemo(() => {
    if (platform !== 'zazzle') return [];
    const categories = new Set<string>();
    for (const preset of platformPresets) {
      categories.add(preset.category);
    }
    return Array.from(categories);
  }, [platform, platformPresets]);

  return (
    <div
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 16,
        background: 'rgba(255,255,255,0.04)',
        boxShadow: '0 25px 70px rgba(0,0,0,0.35)',
        height: '100%',
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr auto',
        gap: 12,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'grid', gap: 6, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>POD Product Converter</div>
        <div style={{ ...mutedStyle, fontSize: 13 }}>
          Upload a design, choose a platform and product size, then download a converted transparent PNG.
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <div style={labelStyle}>Step 1 — Upload Design</div>
        <input
          key={uploadInputKey}
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleFileChange}
          aria-label="Upload design for conversion"
          style={{ display: 'none' }}
        />
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <button
            type="button"
            onClick={handleUploadButtonClick}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(147, 197, 253, 0.35)',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {img ? 'Replace Design' : 'Upload Design'}
          </button>
          {img ? (
            <button
              type="button"
              onClick={handleClearDesign}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(148, 163, 184, 0.35)',
                background: 'rgba(15, 23, 42, 0.85)',
                color: '#e2e8f0',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Clear Design
            </button>
          ) : null}
          {file ? (
            <span style={{ fontSize: 12, color: '#86efac', fontWeight: 700 }}>{file.name}</span>
          ) : (
            <span style={{ ...mutedStyle, fontSize: 12 }}>PNG, JPG, or WEBP</span>
          )}
        </div>
        <div style={{ display: 'grid', gap: 4, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <span style={{ fontWeight: 700, color: '#bae6fd', fontSize: 13 }}>
            Preview Background Colour
          </span>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              padding: '4px 4px',
            }}
          >
            {PREVIEW_BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPreviewBackground(option.id)}
                style={{
                  padding: '5px 8px',
                  fontSize: 12,
                  fontWeight: previewBackground === option.id ? 800 : 600,
                  border:
                    previewBackground === option.id
                      ? '2px solid #38bdf8'
                      : '2px solid transparent',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                {option.label}
              </button>
            ))}
            <label
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: previewBackground === 'custom' ? 800 : 600,
                borderRadius: 999,
                padding: '5px 10px 5px 12px',
                cursor: 'pointer',
                background: 'rgba(15, 23, 42, 0.72)',
                border:
                  previewBackground === 'custom'
                    ? '1px solid rgba(56, 189, 248, 0.55)'
                    : '1px solid rgba(148, 163, 184, 0.35)',
                boxShadow:
                  previewBackground === 'custom'
                    ? '0 0 0 1px rgba(56, 189, 248, 0.15)'
                    : 'none',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  flexShrink: 0,
                  border: '1px solid rgba(148, 163, 184, 0.45)',
                  background:
                    'conic-gradient(red, orange, yellow, green, cyan, blue, purple, red)',
                }}
              />
              <span style={{ color: '#bae6fd', whiteSpace: 'nowrap' }}>Custom Colour</span>
              <input
                type="color"
                value={customPreviewColor}
                onChange={(event) => {
                  setCustomPreviewColor(event.target.value);
                  setPreviewBackground('custom');
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  padding: 0,
                  margin: 0,
                  border: 'none',
                  cursor: 'pointer',
                  opacity: 0,
                }}
              />
            </label>
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.35 }}>
            Preview colour only — not included in the downloaded PNG.
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)',
          gap: 12,
          minHeight: 0,
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 10,
            alignContent: 'start',
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarGutter: 'stable',
            paddingRight: 6,
            minHeight: 0,
            minWidth: 0,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={labelStyle}>Step 2 — Choose Export</div>
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Platform</span>
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as ConverterPlatformId)}
                style={selectStyle}
                aria-label="Choose platform"
              >
                {CONVERTER_PLATFORMS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {platformUsesCustomDimensions(platform) ? (
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                  {platform === 'gelato' ? 'Gelato dimensions' : 'Custom dimensions'}
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <input
                    type="number"
                    min={CUSTOM_DIMENSION_MIN}
                    max={CUSTOM_DIMENSION_MAX}
                    value={customWidth}
                    onChange={(event) => setCustomWidth(event.target.value)}
                    placeholder="Width"
                    aria-label="Export width in pixels"
                    style={selectStyle}
                  />
                  <input
                    type="number"
                    min={CUSTOM_DIMENSION_MIN}
                    max={CUSTOM_DIMENSION_MAX}
                    value={customHeight}
                    onChange={(event) => setCustomHeight(event.target.value)}
                    placeholder="Height"
                    aria-label="Export height in pixels"
                    style={selectStyle}
                  />
                </div>
                {!customDimensionsValid ? (
                  <div style={{ fontSize: 11, color: '#facc15' }}>
                    Enter a width and height between {CUSTOM_DIMENSION_MIN} and {CUSTOM_DIMENSION_MAX} px.
                  </div>
                ) : null}
                {platform === 'gelato' ? (
                  <div style={mutedStyle}>
                    Gelato dimensions vary by product. Enter the exact pixel size from your Gelato product guide.
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>Product / Export Size</span>
                <select
                  value={selectedPresetId}
                  onChange={(event) => setSelectedPresetId(event.target.value)}
                  style={selectStyle}
                  aria-label="Choose product or export size"
                >
                  {platform === 'zazzle'
                    ? zazzleCategories.map((category) => (
                        <optgroup key={category} label={category}>
                          {platformPresets
                            .filter((preset) => preset.category === category)
                            .map((preset) => (
                              <option key={preset.id} value={preset.id}>
                                {preset.label} — {preset.width} × {preset.height}
                              </option>
                            ))}
                        </optgroup>
                      ))
                    : platformPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} — {preset.width} × {preset.height}
                        </option>
                      ))}
                </select>
              </div>
            )}

            {selectedPreset?.helperText ? (
              <div style={mutedStyle}>{selectedPreset.helperText}</div>
            ) : null}
            {selectedPreset?.physicalSize ? (
              <div style={mutedStyle}>Size: {selectedPreset.physicalSize}</div>
            ) : null}
            {selectedPreset?.ppi ? (
              <div style={mutedStyle}>Recommended PPI: {selectedPreset.ppi}</div>
            ) : null}
            {selectedPreset?.presetType ? (
              <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>{selectedPreset.presetType}</div>
            ) : null}
            {selectedPreset?.bleedNote ? (
              <div style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1.4 }}>{selectedPreset.bleedNote}</div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={labelStyle}>Step 3 — Download</div>
            {targetWidth > 0 && targetHeight > 0 ? (
              <>
                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 700 }}>{targetLabel}</div>
                <div style={mutedStyle}>
                  Target: {targetWidth} × {targetHeight} px
                </div>
                {targetFilename ? (
                  <div style={{ fontSize: 11, color: '#64748b' }}>File name: {targetFilename}</div>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={handleDownload}
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
              Download Converted PNG
            </button>
            <div
              style={{
                fontSize: 12,
                color: '#93c5fd',
                fontWeight: 700,
                lineHeight: 1.4,
                padding: '8px 10px',
                borderRadius: 10,
                background: 'rgba(37, 99, 235, 0.10)',
                border: '1px solid rgba(147, 197, 253, 0.18)',
              }}
            >
              Automatically fitted and centred for each selected product size.
            </div>

            <ProductConverterExportPack img={img} file={file} />
          </div>
        </div>

        <div
          style={{
            minHeight: 0,
            minWidth: 0,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            borderRadius: 14,
            border: '1px solid rgba(56, 189, 248, 0.35)',
            ...getPreviewBackgroundStyle(previewBackground, customPreviewColor),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            padding: 12,
          }}
        >
          {img && targetWidth > 0 && targetHeight > 0 ? (
            <canvas
              ref={previewCanvasRef}
              style={{
                width: `${targetWidth * previewScale}px`,
                height: `${targetHeight * previewScale}px`,
                imageRendering: 'auto',
                boxShadow: '0 0 0 1px rgba(148, 163, 184, 0.25)',
              }}
            />
          ) : (
            <div style={{ ...mutedStyle, textAlign: 'center', maxWidth: 280 }}>
              Upload a design and choose a target size to preview the converted canvas.
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          color: '#64748b',
          lineHeight: 1.35,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        Resizes and centres your artwork on the selected canvas. Exports stay transparent — preview checkerboard is
        display only.
      </div>
    </div>
  );
}
