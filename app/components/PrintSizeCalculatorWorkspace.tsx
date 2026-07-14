'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  calculateRequiredPpi,
  computePrintSizes,
  getPlannedPrintStatus,
  validatePixelDimension,
  validatePrintDimension,
} from '../lib/printSizeCalculatorUtils';

type PrintSizeCalculatorWorkspaceProps = {
  file: File | null;
  img: HTMLImageElement | null;
  onAddDesign: (file: File) => void;
  onClear: () => void;
  uploadInputKey: number;
};

const cardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: 'rgba(15, 23, 42, 0.55)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  display: 'grid',
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(2, 6, 23, 0.55)',
  color: '#f8fafc',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

const statusToneColor: Record<string, string> = {
  high: '#86efac',
  good: '#93c5fd',
  maybe: '#facc15',
  low: '#fca5a5',
};

function PixelFields({
  widthValue,
  heightValue,
  onWidthChange,
  onHeightChange,
  widthError,
  heightError,
  idPrefix,
}: {
  widthValue: string;
  heightValue: string;
  onWidthChange: (value: string) => void;
  onHeightChange: (value: string) => void;
  widthError: string | null;
  heightError: string | null;
  idPrefix: string;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <label htmlFor={`${idPrefix}-width`} style={{ fontSize: 12, fontWeight: 700, color: '#bae6fd' }}>
          Width
        </label>
        <input
          id={`${idPrefix}-width`}
          type="text"
          inputMode="numeric"
          value={widthValue}
          onChange={(event) => onWidthChange(event.target.value)}
          style={inputStyle}
          aria-invalid={widthError ? true : undefined}
        />
        {widthError ? (
          <span style={{ fontSize: 11, color: '#fca5a5' }} role="alert">
            {widthError}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        <label htmlFor={`${idPrefix}-height`} style={{ fontSize: 12, fontWeight: 700, color: '#bae6fd' }}>
          Height
        </label>
        <input
          id={`${idPrefix}-height`}
          type="text"
          inputMode="numeric"
          value={heightValue}
          onChange={(event) => onHeightChange(event.target.value)}
          style={inputStyle}
          aria-invalid={heightError ? true : undefined}
        />
        {heightError ? (
          <span style={{ fontSize: 11, color: '#fca5a5' }} role="alert">
            {heightError}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function PrintSizeCalculatorWorkspace({
  file,
  img,
  onAddDesign,
  onClear,
  uploadInputKey,
}: PrintSizeCalculatorWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualWidthPx, setManualWidthPx] = useState('');
  const [manualHeightPx, setManualHeightPx] = useState('');
  const [manualOverride, setManualOverride] = useState(false);
  const [manualCalcActive, setManualCalcActive] = useState(false);
  const [printWidth, setPrintWidth] = useState('');
  const [printHeight, setPrintHeight] = useState('');
  const [printUnit, setPrintUnit] = useState<'in' | 'cm'>('in');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) onAddDesign(selected);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onAddDesign(dropped);
  };

  const widthValidation = validatePixelDimension(manualWidthPx);
  const heightValidation = validatePixelDimension(manualHeightPx);

  const effectiveWidthPx = img && !manualOverride ? img.naturalWidth : widthValidation.value;
  const effectiveHeightPx = img && !manualOverride ? img.naturalHeight : heightValidation.value;

  const hasValidDimensions =
    effectiveWidthPx !== null &&
    effectiveHeightPx !== null &&
    effectiveWidthPx > 0 &&
    effectiveHeightPx > 0;

  const showResults = img ? hasValidDimensions : manualCalcActive && hasValidDimensions;

  const printSizes = useMemo(() => {
    if (!hasValidDimensions || effectiveWidthPx === null || effectiveHeightPx === null) return [];
    return computePrintSizes(effectiveWidthPx, effectiveHeightPx);
  }, [effectiveWidthPx, effectiveHeightPx, hasValidDimensions]);

  const printWidthValidation = validatePrintDimension(printWidth);
  const printHeightValidation = validatePrintDimension(printHeight);

  const requiredPpi =
    hasValidDimensions &&
    effectiveWidthPx !== null &&
    effectiveHeightPx !== null &&
    printWidthValidation.value !== null &&
    printHeightValidation.value !== null
      ? calculateRequiredPpi(
          effectiveWidthPx,
          effectiveHeightPx,
          printWidthValidation.value,
          printHeightValidation.value,
          printUnit,
        )
      : null;

  const plannedStatus = requiredPpi !== null ? getPlannedPrintStatus(requiredPpi) : null;

  const handleManualCalculate = () => {
    setManualCalcActive(true);
  };

  const uploadArea = (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      style={{
        border: '2px dashed rgba(56, 189, 248, 0.45)',
        borderRadius: 16,
        background: 'rgba(8, 47, 73, 0.25)',
        display: 'grid',
        placeItems: 'center',
        alignContent: 'center',
        gap: 12,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 16, color: '#bae6fd' }}>Drag a design here</div>
      <input
        ref={fileInputRef}
        key={uploadInputKey}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button type="button" onClick={() => fileInputRef.current?.click()}>
        Add Design
      </button>
      <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45 }}>PNG, JPG or WEBP</div>
    </div>
  );

  if (!img || !file) {
    return (
      <div
        style={{
          height: '100%',
          minHeight: 0,
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr',
          gap: 12,
          padding: 12,
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#f8fafc', marginBottom: 4 }}>
            PRINT SIZE CALCULATOR
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.45 }}>
            Find out how large your design can print from its pixel size.
          </div>
        </div>

        {uploadArea}

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#e2e8f0' }}>Or enter image size manually</div>
          <PixelFields
            idPrefix="manual-empty"
            widthValue={manualWidthPx}
            heightValue={manualHeightPx}
            onWidthChange={setManualWidthPx}
            onHeightChange={setManualHeightPx}
            widthError={manualCalcActive || manualWidthPx ? widthValidation.error : null}
            heightError={manualCalcActive || manualHeightPx ? heightValidation.error : null}
          />
          <button type="button" onClick={handleManualCalculate} disabled={!widthValidation.value || !heightValidation.value}>
            Calculate
          </button>
        </div>

        {showResults ? (
          <ResultsSection
            printSizes={printSizes}
            printWidth={printWidth}
            printHeight={printHeight}
            printUnit={printUnit}
            onPrintWidthChange={setPrintWidth}
            onPrintHeightChange={setPrintHeight}
            onPrintUnitChange={setPrintUnit}
            printWidthError={printWidthValidation.error}
            printHeightError={printHeightValidation.error}
            requiredPpi={requiredPpi}
            plannedStatus={plannedStatus}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr',
        gap: 10,
        padding: 12,
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#f8fafc' }}>PRINT SIZE CALCULATOR</div>
          <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.4 }}>
            {file.name} · {img.naturalWidth} × {img.naturalHeight}px
          </div>
          {img ? (
            <img
              src={img.src}
              alt={`Preview of ${file.name}`}
              style={{
                maxWidth: 120,
                maxHeight: 80,
                objectFit: 'contain',
                borderRadius: 8,
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(2, 6, 23, 0.35)',
              }}
            />
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            key={uploadInputKey}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Replace Design
          </button>
          <button
            type="button"
            onClick={() => {
              setManualOverride(false);
              setManualCalcActive(false);
              setManualWidthPx('');
              setManualHeightPx('');
              onClear();
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {manualOverride ? (
        <div style={cardStyle}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
            <input
              type="checkbox"
              checked={manualOverride}
              onChange={(event) => {
                setManualOverride(event.target.checked);
                if (!event.target.checked) {
                  setManualWidthPx('');
                  setManualHeightPx('');
                }
              }}
            />
            Manual override
          </label>
          <PixelFields
            idPrefix="manual-loaded"
            widthValue={manualWidthPx}
            heightValue={manualHeightPx}
            onWidthChange={setManualWidthPx}
            onHeightChange={setManualHeightPx}
            widthError={widthValidation.error}
            heightError={heightValidation.error}
          />
        </div>
      ) : (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
          <input
            type="checkbox"
            checked={manualOverride}
            onChange={(event) => {
              setManualOverride(event.target.checked);
              if (event.target.checked) {
                setManualWidthPx(String(img.naturalWidth));
                setManualHeightPx(String(img.naturalHeight));
              }
            }}
          />
          Manual override
        </label>
      )}

      {showResults ? (
        <ResultsSection
          printSizes={printSizes}
          printWidth={printWidth}
          printHeight={printHeight}
          printUnit={printUnit}
          onPrintWidthChange={setPrintWidth}
          onPrintHeightChange={setPrintHeight}
          onPrintUnitChange={setPrintUnit}
          printWidthError={printWidthValidation.error}
          printHeightError={printHeightValidation.error}
          requiredPpi={requiredPpi}
          plannedStatus={plannedStatus}
        />
      ) : null}
    </div>
  );
}

function ResultsSection({
  printSizes,
  printWidth,
  printHeight,
  printUnit,
  onPrintWidthChange,
  onPrintHeightChange,
  onPrintUnitChange,
  printWidthError,
  printHeightError,
  requiredPpi,
  plannedStatus,
}: {
  printSizes: ReturnType<typeof computePrintSizes>;
  printWidth: string;
  printHeight: string;
  printUnit: 'in' | 'cm';
  onPrintWidthChange: (value: string) => void;
  onPrintHeightChange: (value: string) => void;
  onPrintUnitChange: (unit: 'in' | 'cm') => void;
  printWidthError: string | null;
  printHeightError: string | null;
  requiredPpi: number | null;
  plannedStatus: ReturnType<typeof getPlannedPrintStatus> | null;
}) {
  return (
    <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
      <div style={cardStyle}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#e2e8f0' }}>Print size at common PPI values</div>
        <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
          Higher PPI usually gives sharper print detail. Exact results depend on the product, printer
          and artwork.
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {printSizes.map((size) => (
            <div
              key={size.ppi}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(37, 99, 235, 0.10)',
                border: '1px solid rgba(147, 197, 253, 0.22)',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13, color: '#93c5fd', marginBottom: 4 }}>
                {size.ppi} PPI · {size.detailLabel}
              </div>
              <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.45 }}>
                {size.widthIn} × {size.heightIn} in · {size.widthCm} × {size.heightCm} cm
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#e2e8f0' }}>Check a planned print size</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <label htmlFor="planned-print-width" style={{ fontSize: 12, fontWeight: 700, color: '#bae6fd' }}>
              Print width
            </label>
            <input
              id="planned-print-width"
              type="text"
              inputMode="decimal"
              value={printWidth}
              onChange={(event) => onPrintWidthChange(event.target.value)}
              style={inputStyle}
            />
            {printWidthError ? (
              <span style={{ fontSize: 11, color: '#fca5a5' }} role="alert">
                {printWidthError}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <label htmlFor="planned-print-height" style={{ fontSize: 12, fontWeight: 700, color: '#bae6fd' }}>
              Print height
            </label>
            <input
              id="planned-print-height"
              type="text"
              inputMode="decimal"
              value={printHeight}
              onChange={(event) => onPrintHeightChange(event.target.value)}
              style={inputStyle}
            />
            {printHeightError ? (
              <span style={{ fontSize: 11, color: '#fca5a5' }} role="alert">
                {printHeightError}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#bae6fd', alignSelf: 'center' }}>Unit:</span>
          <button
            type="button"
            onClick={() => onPrintUnitChange('in')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              background: printUnit === 'in' ? '#2563eb' : 'rgba(37, 99, 235, 0.14)',
              color: printUnit === 'in' ? '#ffffff' : '#bfdbfe',
              border: printUnit === 'in' ? '1px solid rgba(96, 165, 250, 0.85)' : '1px solid rgba(147, 197, 253, 0.35)',
            }}
          >
            inches
          </button>
          <button
            type="button"
            onClick={() => onPrintUnitChange('cm')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              background: printUnit === 'cm' ? '#2563eb' : 'rgba(37, 99, 235, 0.14)',
              color: printUnit === 'cm' ? '#ffffff' : '#bfdbfe',
              border: printUnit === 'cm' ? '1px solid rgba(96, 165, 250, 0.85)' : '1px solid rgba(147, 197, 253, 0.35)',
            }}
          >
            cm
          </button>
        </div>

        {requiredPpi !== null && plannedStatus ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
            }}
          >
            <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
              Required PPI: <strong>{requiredPpi}</strong>
            </div>
            <div style={{ fontSize: 13, color: statusToneColor[plannedStatus.tone], fontWeight: 700 }}>
              {plannedStatus.label}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
