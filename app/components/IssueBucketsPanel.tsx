'use client';

import React from 'react';
import type { CheckItem } from '../lib/podCheckerTypes';
import { statusColor, statusIcon } from '../lib/podCheckerUtils';
import type { RedbubblePresetId } from '../lib/redbubblePresets';
import { redbubblePresets } from '../lib/redbubblePresets';
import type { PrintfulPresetId } from '../lib/printfulPresets';
import { printfulPresets } from '../lib/printfulPresets';

type IssueBucketsPanelProps = {
  checks: CheckItem[];
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

type SectionProps = {
  title: string;
  items: CheckItem[];
  emptyText: string;
  headingColor: string;
};

function Section({ title, items, emptyText, headingColor }: SectionProps) {
  const topItems = items.slice(0, 3);

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
        <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700 }}>
          {items.length}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {topItems.map((item, index) => (
            <div
              key={`${title}-${item.label}-${index}`}
              style={{
                padding: '8px 10px',
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
                  marginBottom: 3,
                  fontWeight: 700,
                  color: statusColor(item.status),
                  fontSize: 13,
                }}
              >
                <span>{statusIcon(item.status)}</span>
                <span>{item.label}</span>
              </div>

              <div style={{ color: '#e5e7eb', fontSize: 12, lineHeight: 1.4 }}>
                {item.message}
              </div>
            </div>
          ))}

          {items.length > 3 && (
            <div style={{ color: '#94a3b8', fontSize: 12 }}>
              + {items.length - 3} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IssueBucketsPanel({
  checks,
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
  const criticalItems = checks.filter((item) => item.status === 'fail');
  const warningItems = checks.filter((item) => item.status === 'warn');
  const passedItems = checks.filter(
    (item) => item.status === 'pass' || item.status === 'info'
  );

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

      <Section
        title="Critical Issues"
        items={criticalItems}
        emptyText="No critical issues."
        headingColor="#fca5a5"
      />

      <Section
        title="Warnings"
        items={warningItems}
        emptyText="No warnings."
        headingColor="#fdba74"
      />

      <Section
        title="Passed Checks"
        items={passedItems}
        emptyText="No passed checks yet."
        headingColor="#86efac"
      />
    </div>
  );
}
