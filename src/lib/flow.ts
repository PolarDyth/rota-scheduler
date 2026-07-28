export type Step = 'upload' | 'confirm' | 'tag' | 'rules' | 'schedule';

export interface StepMeta {
  id: Step;
  label: string;
  short: string;
}

export const STEPS: StepMeta[] = [
  { id: 'upload', label: 'Upload rota', short: 'Upload' },
  { id: 'confirm', label: 'Review staff & shifts', short: 'Staff' },
  { id: 'tag', label: 'Assign roles & departments', short: 'Roles' },
  { id: 'rules', label: 'Set staffing rules', short: 'Rules' },
  { id: 'schedule', label: 'Schedule', short: 'Schedule' },
];

export const STEP_ORDER: Step[] = STEPS.map((s) => s.id);

export function stepIndex(step: Step): number {
  return STEP_ORDER.indexOf(step);
}

export function canJumpTo(target: Step, completed: Set<Step>): boolean {
  if (target === 'upload') return true;
  return completed.has(target);
}

export function nextStepAfter(step: Step): Step | null {
  const i = stepIndex(step);
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null;
}

export function prevStepAfter(step: Step): Step | null {
  const i = stepIndex(step);
  return i > 0 ? STEP_ORDER[i - 1] : null;
}
