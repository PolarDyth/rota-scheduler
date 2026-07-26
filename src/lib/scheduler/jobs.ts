import type { Hour, JobId, Slot, SpecialisedRole, StaffingRule } from '../types';
import { timeToMinutes } from '../time';

export interface JobMeta {
  label: string;
  short: string;
  colour: string;
  specialised?: boolean;
}

export const JOBS: Record<JobId, JobMeta> = {
  tills:         { label: 'Tills',            short: 'Till',  colour: '#dbeafe' },
  hosting:       { label: 'Hosting',          short: 'Host',  colour: '#fef3c7' },
  clickCollect:  { label: 'Click & Collect',  short: 'C&C',   colour: '#dcfce7' },
  repro:         { label: 'Repro',            short: 'Repro', colour: '#fae8ff' },
  standards:     { label: 'Standards',        short: 'Std',   colour: '#f1f5f9' },
  delivery:      { label: 'Delivery',         short: 'Del',   colour: '#fed7aa' },
  fittingMens:   { label: 'Mens Fit',         short: 'M-Fit', colour: '#bfdbfe' },
  fittingWomens: { label: 'Womens Fit',       short: 'W-Fit', colour: '#fbcfe8' },
  lingerie:      { label: 'Bra Fit',          short: 'Bra',   colour: '#ddd6fe', specialised: true },
  bureau:        { label: 'Bureau',           short: 'Bur',   colour: '#fde68a', specialised: true },
  vm:            { label: 'Visual Merchandising', short: 'VM', colour: '#a7f3d0', specialised: true },
  isf:           { label: 'Stock Controller', short: 'Stock', colour: '#fecaca', specialised: true },
  break:         { label: 'Break',            short: 'BRK',   colour: '#d4d4d8' },
  off:           { label: '—',                short: '',      colour: '#ffffff' },
  idle:          { label: 'Idle',             short: 'Idle',  colour: '#faf5e6' },
};

export function specialisedRoleLabel(role: SpecialisedRole | undefined): string {
  if (!role) return '';
  if (role === 'tsm') return 'TSM';
  return JOBS[role].label;
}

export const GENERAL_JOBS: JobId[] = [
  'tills',
  'hosting',
  'clickCollect',
  'repro',
  'standards',
];

const TRADING_JOB_SET = new Set<JobId>([
  'tills',
  'hosting',
  'clickCollect',
  'fittingMens',
  'fittingWomens',
]);

export function isTradingJob(job: JobId): boolean {
  return TRADING_JOB_SET.has(job);
}

export const SINGLE_HEAD_JOBS = new Set<JobId>([
  'tills',
  'hosting',
  'clickCollect',
  'fittingMens',
  'fittingWomens',
]);

export function isSingleHead(job: JobId): boolean {
  return SINGLE_HEAD_JOBS.has(job);
}

export const SPECIALISED_JOBS = new Set<JobId>(['bureau', 'vm', 'isf', 'lingerie']);

export const PRIORITY_ORDER: JobId[] = [
  'tills',
  'hosting',
  'fittingMens',
  'fittingWomens',
  'bureau',
  'isf',
  'vm',
  'lingerie',
  'clickCollect',
  'delivery',
  'repro',
  'standards',
];

export const UNLIMITED = -1;

export function requiredCountFor(
  job: JobId,
  hourStartMin: number,
  hourEndMin: number,
  rules: StaffingRule[]
): number {
  let count = 0;
  let unlimited = false;
  for (const r of rules) {
    if (r.job !== job) continue;
    const rs = timeToMinutes(r.start);
    const re = timeToMinutes(r.end);
    if (rs >= hourEndMin || re <= hourStartMin) continue;
    if (r.count === UNLIMITED) {
      unlimited = true;
    } else if (r.count > 0) {
      count = Math.max(count, r.count);
    }
  }
  return unlimited ? UNLIMITED : count;
}

export function newRuleId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultStaffingRules(): StaffingRule[] {
  return [
    { id: newRuleId(), job: 'tills', start: '08:00', end: '10:00', count: 2 },
    { id: newRuleId(), job: 'tills', start: '10:00', end: '14:00', count: 3 },
    { id: newRuleId(), job: 'tills', start: '14:00', end: '18:00', count: 2 },
    { id: newRuleId(), job: 'tills', start: '18:00', end: '20:30', count: 1 },
    { id: newRuleId(), job: 'hosting', start: '08:30', end: '18:00', count: 1 },
    { id: newRuleId(), job: 'clickCollect', start: '08:30', end: '20:30', count: 1 },
    { id: newRuleId(), job: 'fittingMens', start: '10:00', end: '18:00', count: 1 },
    { id: newRuleId(), job: 'fittingWomens', start: '08:30', end: '20:30', count: 1 },
    { id: newRuleId(), job: 'lingerie', start: '08:30', end: '20:30', count: 1 },
    { id: newRuleId(), job: 'bureau', start: '08:00', end: '10:00', count: 1 },
    { id: newRuleId(), job: 'bureau', start: '10:00', end: '18:00', count: 2 },
    { id: newRuleId(), job: 'bureau', start: '18:00', end: '20:30', count: 1 },
    { id: newRuleId(), job: 'bureau', start: '20:30', end: '21:00', count: 2 },
    { id: newRuleId(), job: 'vm', start: '09:00', end: '17:00', count: UNLIMITED },
    { id: newRuleId(), job: 'isf', start: '06:00', end: '14:00', count: UNLIMITED },
    { id: newRuleId(), job: 'isf', start: '14:00', end: '21:00', count: UNLIMITED },
  ];
}

export const TRADING_HOURS: Hour[] = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

export const TRADING_SLOTS: Slot[] = (() => {
  const arr: Slot[] = [];
  for (let m = 6 * 60; m < 21 * 60; m += 15) arr.push(m);
  return arr;
})();

export function formatSlot(slot: Slot): string {
  const h = Math.floor(slot / 60);
  const m = slot % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function slotHour(slot: Slot): Hour {
  return Math.floor(slot / 60);
}

