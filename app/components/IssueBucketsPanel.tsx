'use client';

import React from 'react';
import type { CheckItem } from '../lib/podCheckerTypes';
import { statusColor, statusIcon } from '../lib/podCheckerUtils';

type IssueBucketsPanelProps = {
  checks: CheckItem[];
  isScanning: boolean;
  img: HTMLImageElement | null;
  handleDownloadApparelPng: () => void;
  handleDownloadRedbubblePng: () => void;
  handleDownloadPrintfulPng: () => void;
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
  handleDownloadApparelPng,
  handleDownloadRedbubblePng,
  handleDownloadPrintfulPng,
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
      <h2 style={{ margin: 0, marginBottom: 14, fontSize: 20, fontWeight: 800 }}>
        Scan Report
      </h2>

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
        <button
          onClick={handleDownloadApparelPng}
          disabled={!img}
          style={{
            width: '100%',
            background: '#2563eb',
          }}
        >
          Download DTG/DTF Apparel PNG (4200 × 4800)
        </button>
        <div style={{ fontSize: 12, color: '#cbd5e1' }}>
          Great for T-shirts and DTF apparel workflows, including Printful Flex-style printing.
        </div>
        <button
          onClick={handleDownloadRedbubblePng}
          disabled={!img}
          style={{
            width: '100%',
            background: '#1d4ed8',
          }}
        >
          Download Selected Redbubble PNG
        </button>
        <div style={{ fontSize: 12, color: '#cbd5e1' }}>
          Select preset, then press Auto Fix for best centering.
        </div>
        <button
          onClick={handleDownloadPrintfulPng}
          disabled={!img}
          style={{
            width: '100%',
            background: '#1e40af',
          }}
        >
          Download Selected Printful PNG
        </button>
        <div style={{ fontSize: 12, color: '#cbd5e1' }}>
          Select preset, then press Auto Fix for best centering.
        </div>
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
