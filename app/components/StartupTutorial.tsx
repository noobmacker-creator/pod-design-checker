'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

const SHOW_STARTUP_KEY = 'podCheckerShowStartupTutorial';
const HAS_SEEN_KEY = 'podCheckerHasSeenTutorial';

type TutorialStep = {
  target: string;
  title: string;
  description: string;
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
];

export type StartupTutorialHandle = {
  open: () => void;
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

const StartupTutorial = forwardRef<StartupTutorialHandle>(function StartupTutorial(_props, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showOnStartup, setShowOnStartup] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});

  const currentStep = TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1;

  const closeTutorial = useCallback((markSeen = true) => {
    if (markSeen) writeHasSeenTutorial();
    setIsOpen(false);
    setStepIndex(0);
  }, []);

  const openTutorial = useCallback(() => {
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  useImperativeHandle(ref, () => ({ open: openTutorial }), [openTutorial]);

  useEffect(() => {
    setShowOnStartup(readShowOnStartup());
    if (!readHasSeenTutorial() && readShowOnStartup()) {
      const timer = window.setTimeout(() => setIsOpen(true), 400);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const updateTargetPosition = useCallback(() => {
    if (!isOpen || !currentStep) {
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
        maxWidth: 360,
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect(rect);

    const cardWidth = 320;
    const cardHeight = 240;
    const margin = 16;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = rect.bottom + margin;
    let left = rect.left + rect.width / 2 - cardWidth / 2;

    if (top + cardHeight > viewportH - margin) {
      top = rect.top - cardHeight - margin;
    }
    if (left < margin) left = margin;
    if (left + cardWidth > viewportW - margin) left = viewportW - cardWidth - margin;
    if (top < margin) top = margin;

    setCardStyle({
      top,
      left,
      width: cardWidth,
      maxWidth: 'calc(100vw - 32px)',
    });
  }, [currentStep, isOpen]);

  useEffect(() => {
    updateTargetPosition();
    if (!isOpen) return;

    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);
    const timer = window.setInterval(updateTargetPosition, 300);

    return () => {
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition, true);
      window.clearInterval(timer);
    };
  }, [isOpen, stepIndex, updateTargetPosition]);

  const handleToggleStartup = () => {
    const next = !showOnStartup;
    setShowOnStartup(next);
    writeShowOnStartup(next);
  };

  const handleDontShowAgain = () => {
    setShowOnStartup(false);
    writeShowOnStartup(false);
    closeTutorial(true);
  };

  if (!isOpen) return null;

  const arrowStyle: React.CSSProperties = targetRect
    ? (() => {
        const cardTop = typeof cardStyle.top === 'number' ? cardStyle.top : 0;
        const cardLeft = typeof cardStyle.left === 'number' ? cardStyle.left : 0;
        const cardWidth = typeof cardStyle.width === 'number' ? cardStyle.width : 320;
        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;
        const cardCenterX = cardLeft + cardWidth / 2;
        const cardCenterY = cardTop + 120;
        const dx = targetCenterX - cardCenterX;
        const dy = targetCenterY - cardCenterY;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return {
          position: 'fixed' as const,
          left: cardCenterX,
          top: cardCenterY,
          width: 28,
          height: 2,
          background: 'rgba(125, 211, 252, 0.85)',
          transformOrigin: '0 50%',
          transform: `rotate(${angle}deg)`,
          zIndex: 9993,
          pointerEvents: 'none' as const,
        };
      })()
    : { display: 'none' };

  return (
    <>
      <style jsx global>{`
        @keyframes podCheckerTutorialPulse {
          0%,
          100% {
            box-shadow:
              0 0 0 2px rgba(56, 189, 248, 0.55),
              0 0 0 8px rgba(56, 189, 248, 0.12);
          }
          50% {
            box-shadow:
              0 0 0 3px rgba(56, 189, 248, 0.85),
              0 0 0 14px rgba(56, 189, 248, 0.2);
          }
        }
      `}</style>

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

      <div aria-hidden style={arrowStyle} />

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
          display: 'grid',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7dd3fc', letterSpacing: 0.04 }}>
            Step {stepIndex + 1} of {TUTORIAL_STEPS.length}
          </div>
        </div>

        <div id="pod-checker-tutorial-title" style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', lineHeight: 1.3 }}>
          {currentStep.title}
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.5, color: '#cbd5e1' }}>{currentStep.description}</div>

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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
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
              onClick={() => closeTutorial(true)}
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
});

export default StartupTutorial;
