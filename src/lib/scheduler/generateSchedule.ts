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
  SPECIALISED_JOBS,
  UNLIMITED,
  isSingleHead,
  requiredCountFor,
} from './jobs';
import { isOpenHour } from './storeHours';
import { timeToMinutes } from '../time';
import { expandToSlots, type BreakCover } from './expandToSlotsShared';
import {
  canCoverFullHour,
  isFullyOnBreak,
  isOnShiftAny,
  preferNonReserve,
} from './employeeQueries';
import {
  HISTORY_LEN,
  orderByLeastRecent,
  scoreFor,
  wouldExceedMaxBlock,
} from './assignmentHistory';
import { tryShiftBreakForCoverage } from './breakShift';
import { swapFittingRoomsFromGeneral } from './fittingRoomSwap';
import { computeRequiredUntil } from './staffingQuery';
import { resolveBreakCovers, type BreakGap } from './breakCoverResolve';

const SETUP_JOBS: JobId[] = ['standards', 'repro'];
const ALL_ROLES: SpecialisedRole[] = ['lingerie', 'bureau', 'vm', 'isf'];

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

  resolveBreakCovers({
    employees,
    breakGaps,
    hourlyAssignments,
    history,
    warnList,
    breakCovers,
  });

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
