import type {
  Employee,
  Hour,
  JobId,
  Schedule,
  ScheduleWarning,
  Slot,
} from '@/lib/types';

const SLOT_MINUTES = 15;

export interface BlockRef {
  empId: string;
  startSlot: Slot;
  length: number;
  job: JobId;
}

export interface BreakMoveResult {
  schedule: Schedule;
  moved: boolean;
  warnings: ScheduleWarning[];
  affectedHours: Hour[];
}

function isWorkJob(job: JobId | undefined): job is JobId {
  return job !== undefined && job !== 'break' && job !== 'off';
}

function slotHour(slot: Slot): Hour {
  return Math.floor(slot / 60);
}

function sameHour(a: Slot, b: Slot): boolean {
  return slotHour(a) === slotHour(b);
}

export function swapWorkBlocks(
  schedule: Schedule,
  source: BlockRef,
  target: BlockRef
): Schedule {
  if (!sameHour(source.startSlot, target.startSlot)) return schedule;
  if (source.empId === target.empId && source.startSlot === target.startSlot) {
    return schedule;
  }

  const next = structuredClone(schedule);
  if (!next[source.empId]) next[source.empId] = {};
  if (!next[target.empId]) next[target.empId] = {};

  for (let i = 0; i < source.length; i++) {
    const slot = source.startSlot + i * SLOT_MINUTES;
    next[source.empId]![slot] = target.job;
  }
  for (let i = 0; i < target.length; i++) {
    const slot = target.startSlot + i * SLOT_MINUTES;
    next[target.empId]![slot] = source.job;
  }

  return next;
}

export function moveBreak(
  schedule: Schedule,
  employees: Employee[],
  empId: string,
  oldStart: Slot,
  newStart: Slot
): BreakMoveResult {
  if (oldStart === newStart) {
    return { schedule, moved: false, warnings: [], affectedHours: [] };
  }

  const emp = employees.find((e) => e.id === empId);
  if (!emp) {
    return { schedule, moved: false, warnings: [], affectedHours: [] };
  }

  const row = schedule[empId] ?? {};

  let duration = 0;
  let s: Slot = oldStart;
  while (row[s] === 'break') {
    duration++;
    s += SLOT_MINUTES;
  }
  if (duration === 0) {
    return { schedule, moved: false, warnings: [], affectedHours: [] };
  }

  const newSlots: Slot[] = [];
  for (let i = 0; i < duration; i++) newSlots.push(newStart + i * SLOT_MINUTES);
  const oldSlots: Slot[] = [];
  for (let i = 0; i < duration; i++) oldSlots.push(oldStart + i * SLOT_MINUTES);

  const oldSet = new Set(oldSlots);
  if (newSlots.some((ns) => oldSet.has(ns))) {
    return { schedule, moved: false, warnings: [], affectedHours: [] };
  }

  for (const slot of newSlots) {
    if (!isWorkJob(row[slot])) {
      return { schedule, moved: false, warnings: [], affectedHours: [] };
    }
  }

  const oldEnd = oldStart + duration * SLOT_MINUTES;
  const jobAfterOld = row[oldEnd];
  const jobAtNew = row[newStart];
  const fillJob: JobId = isWorkJob(jobAfterOld) ? jobAfterOld : jobAtNew!;

  const next = structuredClone(schedule);
  if (!next[empId]) next[empId] = {};
  const nextRow = next[empId]!;

  for (const slot of newSlots) {
    nextRow[slot] = 'break';
  }
  for (const slot of oldSlots) {
    nextRow[slot] = fillJob;
  }

  const affectedHours = Array.from(
    new Set<Hour>([slotHour(oldStart), slotHour(newStart)])
  );

  const warnings: ScheduleWarning[] = [
    {
      hour: slotHour(newStart),
      kind: 'breakShifted',
      message: `${emp.name}'s break moved manually`,
      employeeIds: [empId],
    },
  ];

  return { schedule: next, moved: true, warnings, affectedHours };
}
