import type {
  Employee,
  Hour,
  JobId,
  Schedule,
  StaffingRule,
  StoreHours,
} from '../types';
import { timeToMinutes } from '../time';
import { isOpenSlot } from './storeHours';
import { isTradingJob, requiredCountFor, slotHour, UNLIMITED } from './jobs';

const SLOT_MINUTES = 15;

export interface BreakCover {
  empId: string;
  primaryId: string;
  jobId: JobId;
  slotStart: number;
  slotEnd: number;
}

export function expandToSlots(
  employees: Employee[],
  hourly: Record<Hour, Record<string, JobId>>,
  assignmentOrder: Record<Hour, Partial<Record<JobId, string[]>>>,
  hours: Hour[],
  storeHours: StoreHours | undefined,
  staffing: StaffingRule[],
  breakCovers: BreakCover[]
): Schedule {
  const schedule: Schedule = {};
  const minHour = Math.min(...hours);
  const maxHour = Math.max(...hours);
  const jobsWithRules = new Set(staffing.map((r) => r.job));

  const coverByEmpSlot = new Map<string, Map<number, JobId>>();
  for (const c of breakCovers) {
    if (!coverByEmpSlot.has(c.empId)) coverByEmpSlot.set(c.empId, new Map());
    for (let s = c.slotStart; s < c.slotEnd; s += SLOT_MINUTES) {
      coverByEmpSlot.get(c.empId)!.set(s, c.jobId);
    }
  }

  for (const e of employees) {
    schedule[e.id] = {};
    for (let slot = minHour * 60; slot < (maxHour + 1) * 60; slot += SLOT_MINUTES) {
      const slotEnd = slot + SLOT_MINUTES;
      const hour = slotHour(slot);

      if (!overlapsShift(e, slot, slotEnd)) {
        schedule[e.id][slot] = 'off';
        continue;
      }

      const coverJob = coverByEmpSlot.get(e.id)?.get(slot);
      if (coverJob) {
        schedule[e.id][slot] = coverJob;
        continue;
      }

      const hourJob = hourly[hour]?.[e.id];

      if (overlapsBreak(e, slot, slotEnd)) {
        schedule[e.id][slot] = 'break';
        continue;
      }

      if (hourJob && jobsWithRules.has(hourJob)) {
        const order = assignmentOrder[hour][hourJob] ?? [];
        const idx = order.indexOf(e.id);
        const slotCount = requiredCountFor(hourJob, slot, slotEnd, staffing);
        if (slotCount === 0 || (slotCount !== UNLIMITED && idx >= slotCount)) {
          schedule[e.id][slot] = 'standards';
          continue;
        }
      }

      const slotOpen = storeHours ? isOpenSlot(slot, storeHours) : true;
      if (hourJob && isTradingJob(hourJob) && !slotOpen) {
        schedule[e.id][slot] = 'idle';
      } else if (hourJob) {
        schedule[e.id][slot] = hourJob;
      } else {
        schedule[e.id][slot] = 'idle';
      }
    }
  }
  return schedule;
}

export function overlapsShift(e: Employee, slotStart: number, slotEnd: number): boolean {
  if (!e.shiftStart || !e.shiftEnd) return false;
  const s = timeToMinutes(e.shiftStart);
  const en = timeToMinutes(e.shiftEnd);
  return s < slotEnd && en > slotStart;
}

export function overlapsBreak(e: Employee, slotStart: number, slotEnd: number): boolean {
  return e.breaks.some((b) => {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    return bs < slotEnd && be > slotStart;
  });
}
