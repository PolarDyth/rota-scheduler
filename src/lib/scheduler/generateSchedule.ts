import type {
  BreakPeriod,
  Department,
  Employee,
  Hour,
  JobId,
  Schedule,
  ScheduleInput,
  ScheduleResult,
  ScheduleWarning,
  SpecialisedRole,
  StoreHours,
} from '../types';
import {
  GENERAL_JOBS,
  JOBS,
  PRIORITY_ORDER,
  UNLIMITED,
  isSingleHead,
  isTradingJob,
  requiredCountFor,
  slotHour,
} from './jobs';
import type { StaffingRule } from '../types';
import { isOpenHour, isOpenSlot } from './storeHours';
import { timeToMinutes } from '../time';

const SLOT_MINUTES = 15;
const HISTORY_LEN = 6;
const SETUP_JOBS: JobId[] = ['standards', 'repro'];
const SPECIALISED_JOBS = new Set<JobId>(['bureau', 'vm', 'isf', 'lingerie']);
const ALL_ROLES: SpecialisedRole[] = ['lingerie', 'bureau', 'vm', 'isf'];

interface BreakGap {
  empId: string;
  hour: Hour;
  job: JobId;
  slotStart: number;
  slotEnd: number;
}

interface BreakCover {
  empId: string;
  primaryId: string;
  jobId: JobId;
  slotStart: number;
  slotEnd: number;
}

export function generateSchedule(input: ScheduleInput, storeHours?: StoreHours): ScheduleResult {
  // Clone so break-shift mutations don't leak back into the caller's employees
  // (otherwise regenerating operates on already-shifted breaks).
  const employees = input.employees.map((e) => ({ ...e, breaks: e.breaks.map((b) => ({ ...b })) }));
  const { hours, staffing } = input;
  const priorityOrder = input.priorityOrder ?? PRIORITY_ORDER;
  const maxRoleBlock = input.maxRoleBlock ?? 0;
  const hourlyAssignments: Record<Hour, Record<string, JobId>> = {};
  const assignmentOrder: Record<Hour, Partial<Record<JobId, string[]>>> = {} as Record<
    Hour,
    Partial<Record<JobId, string[]>>
  >;
  const coverage: Record<Hour, Partial<Record<JobId, number>>> = {} as Record<
    Hour,
    Partial<Record<JobId, number>>
  >;
  for (const h of hours) {
    coverage[h] = {};
    assignmentOrder[h] = {};
  }

  const history = new Map<string, JobId[]>();
  for (const e of employees) history.set(e.id, []);

  const singleHeadLockedHours = new Map<string, Set<Hour>>();
  for (const e of employees) singleHeadLockedHours.set(e.id, new Set());

  const warnList: ScheduleWarning[] = [];
  const specialisedAssignees = new Map<SpecialisedRole, Employee[]>();
  const breakGaps: BreakGap[] = [];
  const breakCovers: BreakCover[] = [];
  const shortShiftWarned = new Set<string>();

  for (const hour of hours) {
    const trading = storeHours ? isOpenHour(hour, storeHours) : true;
    hourlyAssignments[hour] = {};
    const assignedThisHour = new Map<string, JobId>();
    const onShift = employees.filter((e) => isOnShiftAny(e, hour));
    const pool = onShift.filter((e) => !isFullyOnBreak(e, hour) && e.specialisedRole !== 'tsm');
    const hourStart = hour * 60;
    const hourEnd = hourStart + 60;

    const placeHour = (e: Employee, job: JobId) => {
      hourlyAssignments[hour][e.id] = job;
      assignedThisHour.set(e.id, job);
      coverage[hour][job] = (coverage[hour][job] ?? 0) + 1;
      const orderList = assignmentOrder[hour][job] ?? [];
      orderList.push(e.id);
      assignmentOrder[hour][job] = orderList;
      const h = history.get(e.id) ?? [];
      history.set(e.id, [job, ...h].slice(0, HISTORY_LEN));
      if (isSingleHead(job)) {
        singleHeadLockedHours.get(e.id)?.add(hour);
        const hStart = hour * 60;
        const hEnd = hStart + 60;
        for (const b of e.breaks) {
          const bs = timeToMinutes(b.start);
          const be = timeToMinutes(b.end);
          if (bs >= hEnd || be <= hStart) continue;
          breakGaps.push({
            empId: e.id,
            hour,
            job,
            slotStart: Math.max(bs, hStart),
            slotEnd: Math.min(be, hEnd),
          });
        }
      }
    };

    for (const role of ALL_ROLES) {
      if (role === 'tsm') continue;
      const job = role;
      const needed = requiredCountFor(job, hourStart, hourEnd, staffing);

      if (needed === 0) {
        specialisedAssignees.delete(role);
        continue;
      }

      const cap = needed === UNLIMITED ? Number.MAX_SAFE_INTEGER : needed;
      const retained = (specialisedAssignees.get(role) ?? [])
        .filter((e) => isOnShiftAny(e, hour))
        .slice(0, cap);
      const tagged = onShift.filter(
        (e) => e.specialisedRole === role && !retained.includes(e)
      );
      const sortedTagged = [...tagged].sort((a, b) => {
        const aPref = a.specialisedPreferred ? 1 : 0;
        const bPref = b.specialisedPreferred ? 1 : 0;
        if (aPref !== bPref) return bPref - aPref;
        const aRemain = timeToMinutes(a.shiftEnd) - hourEnd;
        const bRemain = timeToMinutes(b.shiftEnd) - hourEnd;
        if (aRemain !== bRemain) return bRemain - aRemain;
        return a.name.localeCompare(b.name);
      });

      const current = [...retained];
      while (current.length < cap && sortedTagged.length > 0) {
        current.push(sortedTagged.shift()!);
      }
      specialisedAssignees.set(role, current);

      for (const e of current) {
        if (!assignedThisHour.has(e.id)) placeHour(e, job);
      }
    }

    const singleHeadEligible = new Set(
      pool.filter((e) => canCoverFullHour(e, hour)).map((e) => e.id)
    );

    // Specialised jobs: specialised phase above already placed tagged staff.
    // Just emit shortfall warnings here.
    for (const job of priorityOrder) {
      if (!SPECIALISED_JOBS.has(job)) continue;
      const needed = requiredCountFor(job, hourStart, hourEnd, staffing);
      if (needed === 0) continue;
      const currentCount = coverage[hour][job] ?? 0;
      const remaining = (needed === UNLIMITED ? 0 : needed) - currentCount;
      if (remaining > 0) {
        warnList.push({
          hour,
          kind: 'understaffed',
          message: `${job} short by ${remaining} (need more specialised-tagged staff)`,
        });
      }
    }

    const fillJob = (job: JobId, cap: number, isUnlimited: boolean, silent: boolean = false) => {
      let remaining = isUnlimited
        ? Number.MAX_SAFE_INTEGER
        : cap - (coverage[hour][job] ?? 0);
      if (!isUnlimited && remaining <= 0) return;

      while (remaining > 0) {
        let eligible = pool.filter((e) => !assignedThisHour.has(e.id));
        eligible = eligible.filter(
          (e) => !wouldExceedMaxBlock(e.id, job, history, maxRoleBlock)
        );
        eligible = preferNonReserve(eligible);
        if (eligible.length === 0) {
          const reserve = onShift.filter(
            (e) =>
              e.specialisedRole === 'tsm' &&
              !isFullyOnBreak(e, hour) &&
              !assignedThisHour.has(e.id) &&
              !wouldExceedMaxBlock(e.id, job, history, maxRoleBlock)
          );
          if (reserve.length > 0) {
            eligible = reserve;
          }
        }
        if (job === 'fittingMens' || job === 'fittingWomens') {
          const dept: Department = job === 'fittingMens' ? 'menswear' : 'womenswear';
          const matched = eligible.filter(
            (e) => e.department === dept || e.department === 'any'
          );
          if (matched.length > 0) {
            eligible = matched;
          } else if (eligible.length > 0) {
            warnList.push({
              hour,
              kind: 'understaffed',
              message: `${job} covered by non-${dept} staff (last resort)`,
            });
          }
        }
        if (isSingleHead(job)) {
          const fullHour = eligible.filter((e) => singleHeadEligible.has(e.id));
          if (fullHour.length > 0) {
            eligible = fullHour;
          } else if (eligible.length > 0) {
            const shiftable = eligible
              .map((e) => ({
                e,
                shift: tryShiftBreakForCoverage(
                  e,
                  hour,
                  singleHeadLockedHours.get(e.id) ?? new Set()
                ),
              }))
              .filter(
                (x): x is { e: Employee; shift: { newBreaks: BreakPeriod[]; minutes: number } } =>
                  x.shift !== null
              )
              .sort((a, b) => Math.abs(a.shift.minutes) - Math.abs(b.shift.minutes));

            if (shiftable.length > 0) {
              const { e, shift } = shiftable[0];
              e.breaks = shift.newBreaks;
              singleHeadEligible.add(e.id);
              warnList.push({
                hour,
                kind: 'breakShifted',
                message: `${e.name} break shifted ${shift.minutes > 0 ? '+' : ''}${shift.minutes} min to cover ${JOBS[job].label}`,
                employeeIds: [e.id],
              });
              eligible = [e];
            } else {
              const requiredUntil = computeRequiredUntil(job, hourStart, hourEnd, staffing);
              const coversRule = eligible.filter(
                (e) => timeToMinutes(e.shiftEnd) >= requiredUntil
              );
              if (coversRule.length > 0) {
                eligible = coversRule;
              } else {
                warnList.push({
                  hour,
                  kind: 'understaffed',
                  message: `${job} covered by partial-hour staff (gap when they leave)`,
                });
              }
            }
          }
        }
        if (eligible.length === 0) {
          if (!isUnlimited && !silent) {
            warnList.push({
              hour,
              kind: 'understaffed',
              message: `${job} short by ${remaining}`,
            });
          }
          break;
        }
        const pick = orderByLeastRecent(eligible, job, history, hour)[0];
        placeHour(pick, job);
        remaining--;
      }

      swapFittingRoomsFromGeneral(
        job,
        hour,
        employees,
        assignedThisHour,
        hourlyAssignments,
        assignmentOrder,
        singleHeadEligible
      );
    };

    // Pass 1: every finite-count non-specialised job gets at least 1 placement before anyone gets a 2nd.
    // Prevents a higher-priority job from starving lower-priority jobs to 0 when staff are scarce.
    for (const job of priorityOrder) {
      if (SPECIALISED_JOBS.has(job)) continue;
      const needed = requiredCountFor(job, hourStart, hourEnd, staffing);
      if (needed <= 0 || needed === UNLIMITED) continue;
      if ((coverage[hour][job] ?? 0) >= 1) continue;
      fillJob(job, 1, false, true);
    }

    // Pass 2: top up finite-count jobs to required, fill unlimited jobs.
    for (const job of priorityOrder) {
      if (SPECIALISED_JOBS.has(job)) continue;
      const needed = requiredCountFor(job, hourStart, hourEnd, staffing);
      if (needed === 0) continue;
      fillJob(job, needed, needed === UNLIMITED);
    }

    const availableJobs: JobId[] = (trading ? GENERAL_JOBS : SETUP_JOBS).filter((j) => {
      const needed = requiredCountFor(j, hourStart, hourEnd, staffing);
      return needed !== 0;
    });
    const leftover = pool.filter((e) => !assignedThisHour.has(e.id));
    if (leftover.length > 0 && availableJobs.length > 0) {
      const canPlaceOn = (job: JobId): boolean => {
        if (isSingleHead(job)) {
          return (coverage[hour][job] ?? 0) === 0;
        }
        const needed = requiredCountFor(job, hourStart, hourEnd, staffing);
        if (needed === 0) return false;
        if (needed === UNLIMITED) return true;
        return (coverage[hour][job] ?? 0) < needed;
      };
      const pairings: { emp: Employee; job: JobId; score: number }[] = [];
      for (const emp of leftover) {
        for (const job of availableJobs) {
          if (isSingleHead(job) && !singleHeadEligible.has(emp.id)) continue;
          if (wouldExceedMaxBlock(emp.id, job, history, maxRoleBlock)) continue;
          pairings.push({ emp, job, score: scoreFor(emp.id, job, history) });
        }
      }
      pairings.sort((a, b) => b.score - a.score);
      for (const { emp, job } of pairings) {
        if (assignedThisHour.has(emp.id)) continue;
        if (!canPlaceOn(job)) continue;
        placeHour(emp, job);
      }
    }

    for (const e of onShift) {
      if (shortShiftWarned.has(e.id)) continue;
      const shiftLen = timeToMinutes(e.shiftEnd) - timeToMinutes(e.shiftStart);
      if (shiftLen > 0 && shiftLen < 120) {
        shortShiftWarned.add(e.id);
        warnList.push({
          hour,
          kind: 'shortShift',
          message: `${e.name} shift is ${Math.floor(shiftLen / 60)}h${shiftLen % 60}m`,
          employeeIds: [e.id],
        });
      }
    }
  }

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

  const schedule: Schedule = expandToSlots(
    employees,
    hourlyAssignments,
    assignmentOrder,
    hours,
    storeHours,
    staffing,
    breakCovers
  );
  return { schedule, warnings: warnList, coverage };
}

function expandToSlots(
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

function overlapsShift(e: Employee, slotStart: number, slotEnd: number): boolean {
  if (!e.shiftStart || !e.shiftEnd) return false;
  const s = timeToMinutes(e.shiftStart);
  const en = timeToMinutes(e.shiftEnd);
  return s < slotEnd && en > slotStart;
}

function overlapsBreak(e: Employee, slotStart: number, slotEnd: number): boolean {
  return e.breaks.some((b) => {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    return bs < slotEnd && be > slotStart;
  });
}

function computeRequiredUntil(
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

function swapFittingRoomsFromGeneral(
  job: JobId,
  hour: Hour,
  employees: Employee[],
  assignedThisHour: Map<string, JobId>,
  hourlyAssignments: Record<Hour, Record<string, JobId>>,
  assignmentOrder: Record<Hour, Partial<Record<JobId, string[]>>>,
  singleHeadEligible: Set<string>
) {
  if (job !== 'fittingMens' && job !== 'fittingWomens') return;
  const requiredDept: Department = job === 'fittingMens' ? 'menswear' : 'womenswear';

  const placedIds = assignmentOrder[hour][job] ?? [];
  for (const placedId of placedIds) {
    const placed = employees.find((e) => e.id === placedId);
    if (!placed) continue;
    if (placed.department === requiredDept || placed.department === 'any') continue;

    const swapTarget = employees.find((e) => {
      if (e.department !== requiredDept) return false;
      const currentJob = assignedThisHour.get(e.id);
      if (!currentJob || !GENERAL_JOBS.includes(currentJob)) return false;
      if (!singleHeadEligible.has(e.id)) return false;
      return true;
    });

    if (swapTarget) {
      const oldJob = assignedThisHour.get(swapTarget.id)!;
      assignedThisHour.set(swapTarget.id, job);
      assignedThisHour.set(placed.id, oldJob);
      hourlyAssignments[hour][swapTarget.id] = job;
      hourlyAssignments[hour][placed.id] = oldJob;

      const fittingList = assignmentOrder[hour][job] ?? [];
      const idx = fittingList.indexOf(placedId);
      if (idx >= 0) fittingList[idx] = swapTarget.id;
      assignmentOrder[hour][job] = fittingList;

      const oldJobList = assignmentOrder[hour][oldJob] ?? [];
      const oldIdx = oldJobList.indexOf(swapTarget.id);
      if (oldIdx >= 0) oldJobList[oldIdx] = placed.id;
      assignmentOrder[hour][oldJob] = oldJobList;
    }
  }
}

function canCoverFullHour(e: Employee, hour: Hour): boolean {
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

function preferNonReserve(eligible: Employee[]): Employee[] {
  const non = eligible.filter((e) => e.specialisedRole !== 'tsm');
  return non.length > 0 ? non : eligible;
}

function tryShiftBreakForCoverage(
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

function orderByLeastRecent(
  candidates: Employee[],
  job: JobId,
  history: Map<string, JobId[]>,
  hour: Hour
): Employee[] {
  const indexed = candidates.map((emp, originalIdx) => ({ emp, originalIdx }));
  indexed.sort((a, b) => {
    const sa = scoreFor(a.emp.id, job, history);
    const sb = scoreFor(b.emp.id, job, history);
    if (sb !== sa) return sb - sa;
    const ta = (history.get(a.emp.id) ?? []).length;
    const tb = (history.get(b.emp.id) ?? []).length;
    if (ta !== tb) return ta - tb;
    const ra = (a.originalIdx + hour) % candidates.length;
    const rb = (b.originalIdx + hour) % candidates.length;
    return ra - rb;
  });
  return indexed.map((x) => x.emp);
}

function scoreFor(empId: string, job: JobId, history: Map<string, JobId[]>): number {
  const h = history.get(empId) ?? [];
  if (h.length === 0) return 1000;
  if (h[0] === job) return 2000;
  const idx = h.indexOf(job);
  return idx === -1 ? 1000 : h.length - idx;
}

function wouldExceedMaxBlock(
  empId: string,
  job: JobId,
  history: Map<string, JobId[]>,
  maxBlock: number
): boolean {
  if (maxBlock <= 0) return false;
  const h = history.get(empId) ?? [];
  if (h.length === 0 || h[0] !== job) return false;
  let count = 1;
  for (let i = 1; i < h.length; i++) {
    if (h[i] === job) count++;
    else break;
  }
  return count + 1 > maxBlock;
}

function isOnShiftAny(e: Employee, hour: Hour): boolean {
  if (!e.shiftStart || !e.shiftEnd) return false;
  const hStart = hour * 60;
  const hEnd = hStart + 60;
  return timeToMinutes(e.shiftStart) < hEnd && timeToMinutes(e.shiftEnd) > hStart;
}

function isFullyOnBreak(e: Employee, hour: Hour): boolean {
  const hStart = hour * 60;
  const hEnd = hStart + 60;
  return e.breaks.some((b) => {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    return bs <= hStart && be >= hEnd;
  });
}
