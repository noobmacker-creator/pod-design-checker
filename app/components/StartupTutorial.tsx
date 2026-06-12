'use client';

import React, { useCallback, useEffect, useState } from 'react';

const SHOW_STARTUP_KEY = 'podCheckerShowStartupTutorial';
const HAS_SEEN_KEY = 'podCheckerHasSeenTutorial';

type TutorialOption = {
  label: string;
  text: string;
};

type TutorialStep = {
  target: string;
  title: string;
  description: string;
  options?: TutorialOption[];
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: 'upload',
    title: 'Upload your design',
    description: 'Start by uploading a PNG design. Transparent PNG is best for POD shirt uploads.',
  },
  {
    target: 'scan-results',
    title: 'Read the scan result',
    description: 'The Scan Report shows print readiness, critical issues, warnings, and helpful notes.',
  },
  {
    target: 'scan-results',
    title: 'Scan display options',
    description:
      'After you upload a design, the Scan Results panel shows extra display options.',
    options: [
      {
        label: 'Show Passed Checks',
        text: 'Show Passed Checks lets you see every check the app ran, including checks that passed.',
      },
      {
        label: 'Show Optional Notes',
        text: 'Show Optional Notes shows extra guidance and learning notes. These are helpful tips, not always urgent problems.',
      },
    ],
  },
  {
    target: 'autofix',
    title: 'Use Auto Fix when available',
    description: 'If placement or sizing needs help, use Run Auto Fix from the Best Next Action area.',
  },
  {
    target: 'export',
    title: 'Choose your upload platform',
    description: 'Pick where you are uploading, then use the matching export preset in Export & Download.',
  },
  {
    target: 'shirt-colour-preview',
    title: 'Preview shirt colours',
    description: 'Test your design on light, dark, and custom shirt colours before export.',
  },
  {
    target: 'detail-zoom',
    title: 'Inspect details with Detail Zoom',
    description:
      'Use 100%, 200%, 400%, or 800% zoom to check edges, small marks, thin lines, and print risks more closely.',
  },
  {
    target: 'download',
    title: 'Download the final PNG',
    description: 'Choose a size, then press the blue download button to export your fixed transparent PNG.',
  },
  {
    target: 'support',
    title: 'Support POD Checker',
    description:
      'POD Checker is built from a lot of real print-prep testing, fixes, and platform checks. Support helps keep the tool improving and helps fund more POD tools. Use the Support POD Checker button when you are ready.',
  },
];

type StartupTutorialProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function readShowOnStartup(): boolean {
  if (typeof window === 'undefined') return true;
  const value = window.localStorage.getItem(SHOW_STARTUP_KEY);
  if (value === null) return true;
  return value !== 'false';
}

function readHasSeenTutorial(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(HAS_SEEN_KEY) === 'true';
}

function writeShowOnStartup(show: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SHOW_STARTUP_KEY, show ? 'true' : 'false');
}

function writeHasSeenTutorial() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HAS_SEEN_KEY, 'true');
}

/** Auto-open when show-on-startup is explicitly on, or on first visit (missing keys). */
export function shouldAutoOpenStartupTutorial(): boolean {
  if (typeof window === 'undefined') return false;
  const showStartup = window.localStorage.getItem(SHOW_STARTUP_KEY);
  const hasSeen = window.localStorage.getItem(HAS_SEEN_KEY) === 'true';
  if (showStartup === 'true') return true;
  if (showStartup === 'false') return false;
  return !hasSeen;
}

export default function StartupTutorial({ open, onOpenChange }: StartupTutorialProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [showOnStartup, setShowOnStartup] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});

  const currentStep = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;

  const closeTutorial = useCallback(
    (markSeen = true, persistStartupPref = false) => {
      if (markSeen) writeHasSeenTutorial();
      if (persistStartupPref && showOnStartup) writeShowOnStartup(true);
      onOpenChange(false);
      setStepIndex(0);
    },
    [onOpenChange, showOnStartup],
  );

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  useEffect(() => {
    setShowOnStartup(readShowOnStartup());
  }, []);

  const updateTargetPosition = useCallback(() => {
    if (!open || !currentStep) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (!el) {
      setTargetRect(null);
      setCardStyle({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 320,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 32px)',
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    const cardWidth = 320;
    const cardMaxHeight = window.innerHeight - 32;
    const margin = 16;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = rect.bottom + margin;
    let left = rect.left + rect.width / 2 - cardWidth / 2;

    if (top + cardMaxHeight > viewportH - margin) {
      top = rect.top - cardMaxHeight - margin;
    }
    if (left < margin) left = margin;
    if (left + cardWidth > viewportW - margin) left = viewportW - cardWidth - margin;
    if (top < margin) top = margin;
    if (top + cardMaxHeight > viewportH - margin) {
      top = Math.max(margin, viewportH - cardMaxHeight - margin);
    }

    setCardStyle({
      top,
      left,
      width: cardWidth,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 32px)',
    });
  }, [currentStep, open]);

  useEffect(() => {
    updateTargetPosition();
    if (!open) return;

    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);
    const timer = window.setInterval(updateTargetPosition, 300);

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition, true);
      window.clearInterval(timer);
    };
  }, [open, stepIndex, updateTargetPosition]);

  const handleToggleStartup = () => {
    const next = !showOnStartup;
    setShowOnStartup(next);
    writeShowOnStartup(next);
  };

  const handleDontShowAgain = () => {
    setShowOnStartup(false);
    writeShowOnStartup(false);
    writeHasSeenTutorial();
    onOpenChange(false);
    setStepIndex(0);
  };

  if (!open) return null;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes podCheckerTutorialPulse {
          0%, 100% {
            box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.55), 0 0 0 8px rgba(56, 189, 248, 0.12);
          }
          50% {
            box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.85), 0 0 0 14px rgba(56, 189, 248, 0.2);
          }
        }`,
        }}
      />

      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.62)',
          zIndex: 9990,
        }}
      />

      {targetRect ? (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderRadius: 14,
            border: '2px solid rgba(125, 211, 252, 0.75)',
            background: 'rgba(56, 189, 248, 0.06)',
            animation: 'podCheckerTutorialPulse 2.4s ease-in-out infinite',
            zIndex: 9991,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pod-checker-tutorial-title"
        style={{
          position: 'fixed',
          ...cardStyle,
          zIndex: 9992,
          padding: 14,
          borderRadius: 14,
          background: 'rgba(15, 23, 42, 0.96)',
          border: '1px solid rgba(125, 211, 252, 0.45)',
          boxShadow: '0 18px 40px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'grid',
            gap: 10,
            paddingBottom: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#7dd3fc', letterSpacing: 0.04 }}>
              Step {stepIndex + 1} of {TUTORIAL_STEPS.length}
            </div>
          </div>

          <div
            id="pod-checker-tutorial-title"
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#f8fafc',
              lineHeight: 1.3,
              textDecoration: 'none',
            }}
          >
            {currentStep.title}
          </div>

          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#cbd5e1' }}>{currentStep.description}</div>

          {currentStep.options?.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {currentStep.options.map((option) => (
                <div
                  key={option.label}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgba(15, 23, 42, 0.55)',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#7dd3fc', marginBottom: 4 }}>
                    {option.label}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.45, color: '#cbd5e1' }}>{option.text}</div>
                </div>
              ))}
            </div>
          ) : null}

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showOnStartup}
              onChange={handleToggleStartup}
              style={{ accentColor: '#38bdf8' }}
            />
            Show tutorial on startup
          </label>
        </div>

        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
            paddingTop: 10,
            borderTop: '1px solid rgba(148, 163, 184, 0.18)',
          }}
        >
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              opacity: stepIndex === 0 ? 0.5 : 1,
            }}
          >
            Back
          </button>

          {!isLastStep ? (
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1))}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                background: '#2563eb',
                color: '#ffffff',
              }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={() => closeTutorial(true, true)}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                background: '#2563eb',
                color: '#ffffff',
              }}
            >
              Done
            </button>
          )}

          <button
            type="button"
            onClick={handleDontShowAgain}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.06)',
              color: '#cbd5e1',
            }}
          >
            Don&apos;t show again
          </button>
        </div>
      </div>
    </>
  );
}
