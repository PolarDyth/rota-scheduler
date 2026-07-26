import type { JobId, StaffingRule } from '../types';
import { timeToMinutes } from '../time';

export function computeRequiredUntil(
  job: JobId,
  hourStart: number,
  hourEnd: number,
  staffing: StaffingRule[]
): number {
  const ends = staffing
    .filter((r) => r.job === job)
    .map((r) => {
      const rs = timeToMinutes(r.start);
      const re = timeToMinutes(r.end);
      if (rs >= hourEnd || re <= hourStart) return null;
      return Math.min(re, hourEnd);
    })
    .filter((t): t is number => t !== null);
  return ends.length ? Math.max(...ends) : hourEnd;
}
