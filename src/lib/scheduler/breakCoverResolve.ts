import type { Employee, Hour, JobId, ScheduleWarning } from '../types';
import { GENERAL_JOBS, JOBS, SPECIALISED_JOBS, isSingleHead } from './jobs';
import type { BreakCover } from './expandToSlotsShared';
import { HISTORY_LEN, scoreFor } from './assignmentHistory';
import { isOnShiftAny, preferNonReserve } from './employeeQueries';
import { timeToMinutes } from '../time';

export interface BreakGap {
  empId: string;
  hour: Hour;
  job: JobId;
  slotStart: number;
  slotEnd: number;
}

export function resolveBreakCovers(args: {
  employees: Employee[];
  breakGaps: BreakGap[];
  hourlyAssignments: Record<Hour, Record<string, JobId>>;
  history: Map<string, JobId[]>;
  warnList: ScheduleWarning[];
  breakCovers: BreakCover[];
}): void {
  const { employees, breakGaps, hourlyAssignments, history, warnList, breakCovers } = args;

  for (const gap of breakGaps) {
    const primary = employees.find((e) => e.id === gap.empId);
    if (!primary) continue;
    const onShift = employees.filter((e) => isOnShiftAny(e, gap.hour));
    const candidates = preferNonReserve(
      onShift.filter((c) => {
        if (c.id === primary.id) return false;
        if (c.breaks.some((bb) => {
          const bbs = timeToMinutes(bb.start);
          const bbe = timeToMinutes(bb.end);
          return bbs < gap.slotEnd && bbe > gap.slotStart;
        })) return false;
        const cs = timeToMinutes(c.shiftStart);
        const ce = timeToMinutes(c.shiftEnd);
        if (cs >= gap.slotEnd || ce <= gap.slotStart) return false;
        const cJob = hourlyAssignments[gap.hour][c.id];
        if (cJob && (isSingleHead(cJob) || SPECIALISED_JOBS.has(cJob))) return false;
        return true;
      })
    );

    if (candidates.length === 0) {
      warnList.push({
        hour: gap.hour,
        kind: 'understaffed',
        message: `${JOBS[gap.job].label} has a break gap (${primary.name} on break, no cover available)`,
        employeeIds: [primary.id],
      });
      continue;
    }

    const sorted = [...candidates].sort((a, b) => {
      const aJob = hourlyAssignments[gap.hour][a.id];
      const bJob = hourlyAssignments[gap.hour][b.id];
      const aGeneral = aJob && GENERAL_JOBS.includes(aJob) ? 0 : 1;
      const bGeneral = bJob && GENERAL_JOBS.includes(bJob) ? 0 : 1;
      if (aGeneral !== bGeneral) return aGeneral - bGeneral;
      const aScore = scoreFor(a.id, gap.job, history);
      const bScore = scoreFor(b.id, gap.job, history);
      return bScore - aScore;
    });
    const cover = sorted[0];
    breakCovers.push({
      empId: cover.id,
      primaryId: primary.id,
      jobId: gap.job,
      slotStart: gap.slotStart,
      slotEnd: gap.slotEnd,
    });
    const h = history.get(cover.id) ?? [];
    history.set(cover.id, [gap.job, ...h].slice(0, HISTORY_LEN));
    warnList.push({
      hour: gap.hour,
      kind: 'breakCovered',
      message: `${cover.name} covering ${JOBS[gap.job].label} while ${primary.name} on break`,
      employeeIds: [cover.id, primary.id],
    });
  }
}
