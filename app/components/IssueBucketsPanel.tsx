'use client';

import React from 'react';
import type { CheckItem } from '../lib/podCheckerTypes';
import { statusColor, statusIcon } from '../lib/podCheckerUtils';

type IssueBucketsPanelProps = {
  checks: CheckItem[];
  isScanning: boolean;
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

              {item.status === 'fail' || item.status === 'warn' ? (
  <div style={{ marginTop: 5, color: '#94a3b8', fontSize: 11, lineHeight: 1.35 }}>
    {item.status === 'fail'
      ? item.label === 'Fake Transparency Background'
        ? 'Recommended: remove background and re-upload.'
        : 'Fix: Use Quick Fix (Auto) or correct this issue before printing.'
      : 'Fix: Improve this for better print quality.'}
  </div>
) : null}
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

export default function IssueBucketsPanel({ checks, isScanning }: IssueBucketsPanelProps) {
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
        Issue Buckets
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