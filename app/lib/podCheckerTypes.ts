export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';
export type ViewMode = 'pod' | 'design' | 'shirt' | 'mockup';
export type PreviewSize = number;

export type CheckItem = {
  label: string;
  status: CheckStatus;
  message: string;
  /** Numeric visibility score for shirt-colour guidance (optional). */
  score?: number;
  /** Per-shirt visibility level for guidance overlay (optional). */
  visibilityLevel?: 'strong' | 'preview' | 'low';
  /** DTG print-risk flag for semi-transparent artwork (optional). */
  semiTransparencyRisk?: boolean;
};