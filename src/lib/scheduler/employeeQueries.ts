import type { Employee, Hour } from '../types';
import { timeToMinutes } from '../time';

export function isOnShiftAny(e: Employee, hour: Hour): boolean {
  if (!e.shiftStart || !e.shiftEnd) return false;
  const hStart = hour * 60;
  const hEnd = hStart + 60;
  return timeToMinutes(e.shiftStart) < hEnd && timeToMinutes(e.shiftEnd) > hStart;
}

export function isFullyOnBreak(e: Employee, hour: Hour): boolean {
  const hStart = hour * 60;
  const hEnd = hStart + 60;
  return e.breaks.some((b) => {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    return bs <= hStart && be >= hEnd;
  });
}

export function canCoverFullHour(e: Employee, hour: Hour): boolean {
  if (!e.shiftStart || !e.shiftEnd) return false;
  const hStart = hour * 60;
  const hEnd = hStart + 60;
  const s = timeToMinutes(e.shiftStart);
  const en = timeToMinutes(e.shiftEnd);
  if (s > hStart || en < hEnd) return false;
  return !e.breaks.some((b) => {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    return bs < hEnd && be > hStart;
  });
}

export function preferNonReserve(eligible: Employee[]): Employee[] {
  const non = eligible.filter((e) => e.specialisedRole !== 'tsm');
  return non.length > 0 ? non : eligible;
}
