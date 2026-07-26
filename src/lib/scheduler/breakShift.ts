import type { BreakPeriod, Employee, Hour } from '../types';
import { timeToMinutes } from '../time';

export function tryShiftBreakForCoverage(
  e: Employee,
  hour: Hour,
  lockedHours: Set<Hour>
): { newBreaks: BreakPeriod[]; minutes: number } | null {
  const hStart = hour * 60;
  const hEnd = hStart + 60;
  const shiftStart = timeToMinutes(e.shiftStart);
  const shiftEnd = timeToMinutes(e.shiftEnd);

  const overlapping = e.breaks.filter((b) => {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    return bs < hEnd && be > hStart;
  });

  if (overlapping.length !== 1) return null;
  const target = overlapping[0];
  const otherBreaks = e.breaks.filter((b) => b !== target);

  const candidates = [-15, 15, -30, 30];
  for (const shift of candidates) {
    const newStart = timeToMinutes(target.start) + shift;
    const newEnd = timeToMinutes(target.end) + shift;

    if (newStart < hEnd && newEnd > hStart) continue;
    if (newStart < shiftStart || newEnd > shiftEnd) continue;

    const conflictsWithLocked = Array.from(lockedHours).some((lh) => {
      const lhStart = lh * 60;
      const lhEnd = lhStart + 60;
      return newStart < lhEnd && newEnd > lhStart;
    });
    if (conflictsWithLocked) continue;

    const conflict = otherBreaks.some((b) => {
      const bs = timeToMinutes(b.start);
      const be = timeToMinutes(b.end);
      return newStart < be && bs < newEnd;
    });
    if (conflict) continue;

    const newBreak: BreakPeriod = {
      start: minToTime(newStart),
      end: minToTime(newEnd),
    };
    const newBreaks = [...otherBreaks, newBreak].sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
    );
    return { newBreaks, minutes: shift };
  }
  return null;
}

function minToTime(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
