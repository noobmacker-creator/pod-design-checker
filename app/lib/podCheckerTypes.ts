export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';
export type ViewMode = 'pod' | 'design' | 'shirt' | 'mockup';
export type PreviewSize = number;

export type CheckItem = {
  label: string;
  status: CheckStatus;
  message: string;
};