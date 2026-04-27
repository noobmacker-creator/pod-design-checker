'use client';

import React from 'react';
import type { RedbubblePresetId } from '../lib/redbubblePresets';
import { redbubblePresets } from '../lib/redbubblePresets';
import type { PrintfulPresetId } from '../lib/printfulPresets';
import { printfulPresets } from '../lib/printfulPresets';

type IssueBucketsPanelProps = {
  isScanning: boolean;
  img: HTMLImageElement | null;
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
  handleDownloadApparelPng: () => void;
  handleDownloadRedbubblePng: () => void;
  handleDownloadPrintfulPng: () => void;
  handleDownloadTeePublicPng: () => void;
};

export default function IssueBucketsPanel({
  isScanning,
  img,
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
  handleDownloadApparelPng,
  handleDownloadRedbubblePng,
  handleDownloadPrintfulPng,
  handleDownloadTeePublicPng,
}: IssueBucketsPanelProps) {
  return (
    <div
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

      <div style={{ marginBottom: 14, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
          {standardTargetLine}
        </div>
        <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800 }}>
          Standard Export
        </div>
        <div style={{ fontSize: 12, color: '#cbd5e1' }}>
          Generic 4200 × 4800 apparel PNG, not tied to one company.
        </div>
        <button
          onClick={handleDownloadApparelPng}
          disabled={!img}
          style={{
            width: '100%',
            background: '#2563eb',
          }}
        >
          Download Standard Apparel PNG — 4200 × 4800
        </button>
        <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800, marginTop: 2 }}>
          Redbubble Export
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
        <button
          onClick={handleDownloadRedbubblePng}
          disabled={!img}
          style={{
            width: '100%',
            background: '#1d4ed8',
          }}
        >
          {selectedRedbubbleDownloadLabel}
        </button>
        <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800, marginTop: 2 }}>
          Printful Export
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
        <button
          onClick={handleDownloadPrintfulPng}
          disabled={!img}
          style={{
            width: '100%',
            background: '#1e40af',
          }}
        >
          {selectedPrintfulDownloadLabel}
        </button>
        <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800, marginTop: 2 }}>
          TeePublic Export
        </div>
        <div style={{ fontSize: 12, color: '#bae6fd', fontWeight: 800 }}>
          {teePublicTargetLine}
        </div>
        <div style={{ fontSize: 12, color: '#cbd5e1' }}>
          Resized for TeePublic all-products export.
        </div>
        <button
          onClick={handleDownloadTeePublicPng}
          disabled={!img}
          style={{
            width: '100%',
            background: '#1d4ed8',
          }}
        >
          {teePublicDownloadLabel}
        </button>
      </div>

    </div>
  );
}
