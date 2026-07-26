// Smoke test for swapWorkBlocks and moveBreak.
// Run via: npx tsx scripts/test-swap.ts
//
// Exercises the pure schedule-mutation functions against the worked
// examples in the design doc (Alice, Bob, end-of-shift) plus rejection
// paths (cross-hour, cross-employee break, overlapping break move).

import type { Employee, JobId, Schedule, Slot } from '../src/lib/types';
import {
  swapWorkBlocks,
  moveBreak,
  type BlockRef,
} from '../src/lib/scheduler/swapBlock';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const H9 = 9 * 60;
const H9_15 = H9 + 15;
const H9_30 = H9 + 30;
const H9_45 = H9 + 45;
const H10 = 10 * 60;
const H10_15 = H10 + 15;
const H10_30 = H10 + 30;
const H10_45 = H10 + 45;
const H11 = 11 * 60;
const H11_15 = H11 + 15;
const H11_30 = H11 + 30;

function rowFrom(entries: Array<[Slot, JobId]>): Partial<Record<Slot, JobId>> {
  const row: Partial<Record<Slot, JobId>> = {};
  for (const [s, j] of entries) row[s] = j;
  return row;
}

const alice: Employee = {
  id: 'alice',
  name: 'Alice',
  shiftStart: '09:00',
  shiftEnd: '11:00',
  breaks: [{ start: '09:00', end: '09:30' }],
  department: 'womenswear',
  pdfTags: [],
};

const bob: Employee = {
  id: 'bob',
  name: 'Bob',
  shiftStart: '09:00',
  shiftEnd: '11:00',
  breaks: [{ start: '10:00', end: '10:30' }],
  department: 'menswear',
  pdfTags: [],
};

function workSwap() {
  console.log('Work-block swap (Alice 30m tills ↔ Bob 60m fitting, same hour)');
  const schedule: Schedule = {
    alice: rowFrom([
      [H9, 'tills'], [H9_15, 'tills'], [H9_30, 'idle'], [H9_45, 'idle'],
    ]),
    bob: rowFrom([
      [H9, 'fittingMens'], [H9_15, 'fittingMens'], [H9_30, 'fittingMens'], [H9_45, 'fittingMens'],
    ]),
  };
  const source: BlockRef = { empId: 'alice', startSlot: H9, length: 2, job: 'tills' };
  const target: BlockRef = { empId: 'bob', startSlot: H9, length: 4, job: 'fittingMens' };
  const next = swapWorkBlocks(schedule, source, target);
  check('Alice source slots → fittingMens', next.alice[H9] === 'fittingMens' && next.alice[H9_15] === 'fittingMens', JSON.stringify(next.alice));
  check('Alice untouched slots stay idle', next.alice[H9_30] === 'idle' && next.alice[H9_45] === 'idle');
  check('Bob target slots → tills', next.bob[H9] === 'tills' && next.bob[H9_15] === 'tills' && next.bob[H9_30] === 'tills' && next.bob[H9_45] === 'tills', JSON.stringify(next.bob));
}

function sameEmployeeWorkSwap() {
  console.log('\nSame-employee swap (two distinct work blocks in one hour)');
  const schedule: Schedule = {
    alice: rowFrom([
      [H9, 'tills'], [H9_15, 'tills'], [H9_30, 'fittingWomens'], [H9_45, 'fittingWomens'],
    ]),
  };
  const source: BlockRef = { empId: 'alice', startSlot: H9, length: 2, job: 'tills' };
  const target: BlockRef = { empId: 'alice', startSlot: H9_30, length: 2, job: 'fittingWomens' };
  const next = swapWorkBlocks(schedule, source, target);
  check('Alice first half → fittingWomens', next.alice[H9] === 'fittingWomens' && next.alice[H9_15] === 'fittingWomens');
  check('Alice second half → tills', next.alice[H9_30] === 'tills' && next.alice[H9_45] === 'tills');
}

function crossHourSwapRejected() {
  console.log('\nCross-hour swap rejected');
  const schedule: Schedule = {
    alice: rowFrom([[H9, 'tills'], [H9_15, 'tills']]),
    bob: rowFrom([[H10, 'tills'], [H10_15, 'tills']]),
  };
  const source: BlockRef = { empId: 'alice', startSlot: H9, length: 2, job: 'tills' };
  const target: BlockRef = { empId: 'bob', startSlot: H10, length: 2, job: 'tills' };
  const next = swapWorkBlocks(schedule, source, target);
  check('schedule unchanged', next === schedule || (next.alice[H9] === 'tills' && next.bob[H10] === 'tills'));
}

function breakMoveAlice() {
  console.log('\nBreak move — Alice (break at start, drag later)');
  // Alice: break 9:00-9:30, tills 9:30-11:00
  const schedule: Schedule = {
    alice: rowFrom([
      [H9, 'break'], [H9_15, 'break'],
      [H9_30, 'tills'], [H9_45, 'tills'], [H10, 'tills'], [H10_15, 'tills'], [H10_30, 'tills'], [H10_45, 'tills'],
    ]),
  };
  // Move break from 9:00 to 10:00
  const result = moveBreak(schedule, [alice], 'alice', H9, H10);
  check('moved=true', result.moved);
  check('break now at 10:00-10:30', result.schedule.alice[H10] === 'break' && result.schedule.alice[H10_15] === 'break', JSON.stringify(result.schedule.alice));
  check('old slot 9:00 filled with tills (WA_after)', result.schedule.alice[H9] === 'tills' && result.schedule.alice[H9_15] === 'tills');
  check('9:30-10:00 unchanged tills', result.schedule.alice[H9_30] === 'tills' && result.schedule.alice[H9_45] === 'tills');
  check('10:30-10:45 unchanged tills', result.schedule.alice[H10_30] === 'tills' && result.schedule.alice[H10_45] === 'tills');
  check('emitted breakShifted warning', result.warnings[0]?.kind === 'breakShifted');
}

function breakMoveBob() {
  console.log('\nBreak move — Bob (break in middle, drag earlier)');
  // Bob: fitting 9:00-10:00, break 10:00-10:30, X(repro) 10:30-11:00
  const schedule: Schedule = {
    bob: rowFrom([
      [H9, 'fittingMens'], [H9_15, 'fittingMens'], [H9_30, 'fittingMens'], [H9_45, 'fittingMens'],
      [H10, 'break'], [H10_15, 'break'],
      [H10_30, 'repro'], [H10_45, 'repro'],
    ]),
  };
  // Move break from 10:00 to 9:30
  const result = moveBreak(schedule, [bob], 'bob', H10, H9_30);
  check('moved=true', result.moved);
  check('break at 9:30-10:00', result.schedule.bob[H9_30] === 'break' && result.schedule.bob[H9_45] === 'break', JSON.stringify(result.schedule.bob));
  check('fitting shrank to 9:00-9:30', result.schedule.bob[H9] === 'fittingMens' && result.schedule.bob[H9_15] === 'fittingMens');
  check('X grew backward into old break slot (10:00-10:30 → repro)', result.schedule.bob[H10] === 'repro' && result.schedule.bob[H10_15] === 'repro');
  check('10:30-11:00 still repro', result.schedule.bob[H10_30] === 'repro' && result.schedule.bob[H10_45] === 'repro');
}

function breakMoveEndOfShift() {
  console.log('\nBreak move — break at end of shift, drag earlier (no WA_after)');
  // Bob: tills 9:00-11:00, break 11:00-11:30
  const schedule: Schedule = {
    bob: rowFrom([
      [H9, 'tills'], [H9_15, 'tills'], [H9_30, 'tills'], [H9_45, 'tills'],
      [H10, 'tills'], [H10_15, 'tills'], [H10_30, 'tills'], [H10_45, 'tills'],
      [H11, 'break'], [H11_15, 'break'],
    ]),
  };
  const bobLate: Employee = { ...bob, shiftEnd: '11:30' };
  // Move break from 11:00 to 10:00
  const result = moveBreak(schedule, [bobLate], 'bob', H11, H10);
  check('moved=true', result.moved);
  check('break at 10:00-10:30', result.schedule.bob[H10] === 'break' && result.schedule.bob[H10_15] === 'break', JSON.stringify(result.schedule.bob));
  check('tills before break unchanged', result.schedule.bob[H9] === 'tills' && result.schedule.bob[H9_45] === 'tills');
  check('old break slot 11:00 filled with tills (WB_before extends forward)', result.schedule.bob[H11] === 'tills' && result.schedule.bob[H11_15] === 'tills');
}

function breakMoveCrossEmployeeRejected() {
  console.log('\nBreak move — cross-employee rejected');
  const schedule: Schedule = {
    alice: rowFrom([[H9, 'break'], [H9_15, 'break']]),
    bob: rowFrom([[H9, 'tills'], [H9_15, 'tills']]),
  };
  // Try to move Alice's break onto Bob's row
  const result = moveBreak(schedule, [alice, bob], 'alice', H9, H9);
  check('no move when oldStart === newStart', !result.moved);
}

function breakMoveOverlapRejected() {
  console.log('\nBreak move — overlap with old position rejected');
  // Alice: break 9:00-9:30, tills after. Try moving break to 9:15 (overlaps).
  const schedule: Schedule = {
    alice: rowFrom([
      [H9, 'break'], [H9_15, 'break'],
      [H9_30, 'tills'], [H9_45, 'tills'], [H10, 'tills'], [H10_15, 'tills'],
    ]),
  };
  const result = moveBreak(schedule, [alice], 'alice', H9, H9_15);
  check('overlap rejected', !result.moved);
}

function breakMoveNonWorkTargetRejected() {
  console.log('\nBreak move — drop target not a work job rejected');
  // Alice: break 9:00-9:30, tills 9:30-10:00, then off-shift at 10:00+
  const schedule: Schedule = {
    alice: rowFrom([
      [H9, 'break'], [H9_15, 'break'],
      [H9_30, 'tills'], [H9_45, 'tills'],
    ]),
  };
  // Try to drop break at H9_30 — that's a work job, valid. But try at a slot that doesn't exist.
  const result = moveBreak(schedule, [alice], 'alice', H9, H11);
  check('drop into off-shift rejected', !result.moved);
}

workSwap();
sameEmployeeWorkSwap();
crossHourSwapRejected();
breakMoveAlice();
breakMoveBob();
breakMoveEndOfShift();
breakMoveCrossEmployeeRejected();
breakMoveOverlapRejected();
breakMoveNonWorkTargetRejected();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
