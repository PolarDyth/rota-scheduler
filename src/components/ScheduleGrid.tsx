'use client';

import { Sun } from 'lucide-react';
import { JOBS, specialisedRoleLabel, formatSlot } from '@/lib/scheduler/jobs';
import type { Employee, Hour, JobId, ScheduleResult, Slot, StoreHours } from '@/lib/types';
import { isOpenSlot } from '@/lib/scheduler/storeHours';

interface Props {
  employees: Employee[];
  hours: Hour[];
  slots: Slot[];
  result: ScheduleResult;
  storeHours?: StoreHours;
}

const SLOT_WIDTH = 18;
const NAME_WIDTH = 160;

interface Run {
  slot: Slot;
  length: number;
  job: JobId;
}

function getRuns(slots: Slot[], rowSchedule: Partial<Record<Slot, JobId>>): Run[] {
  const rawRuns: Run[] = [];
  let current: Run | null = null;
  for (const slot of slots) {
    const job: JobId = rowSchedule[slot] ?? 'off';
    if (current && current.job === job) {
      current.length++;
    } else {
      if (current) rawRuns.push(current);
      current = { slot, length: 1, job };
    }
  }
  if (current) rawRuns.push(current);

  const runs: Run[] = [];
  for (const run of rawRuns) {
    const endTime = run.slot + run.length * 15;
    let start = run.slot;
    while (start < endTime) {
      const nextHour = Math.ceil((start + 1) / 60) * 60;
      const segEnd = Math.min(nextHour, endTime);
      const segLen = Math.max(1, (segEnd - start) / 15);
      runs.push({ slot: start, length: segLen, job: run.job });
      start = segEnd;
    }
  }
  return runs;
}

export function ScheduleGrid({
  employees,
  hours,
  slots,
  result,
  storeHours,
}: Props) {
  const totalWidth = NAME_WIDTH + slots.length * SLOT_WIDTH;

  return (
    <div className="overflow-x-auto">
      <table
        className="schedule-print-table border-collapse"
        style={{ tableLayout: 'fixed', width: totalWidth }}
      >
        <colgroup>
          <col style={{ width: NAME_WIDTH }} />
          {slots.map((s) => (
            <col key={s} style={{ width: SLOT_WIDTH }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-secondary">
            <th
              className="sticky left-0 z-10 border-b border-r border-border bg-secondary p-2 text-left text-xs font-semibold tracking-wide uppercase"
              style={{ minWidth: NAME_WIDTH }}
            >
              Employee
            </th>
            {hours.map((h) => {
              const open =
                storeHours && h >= Math.floor(storeHours.open) && h < Math.ceil(storeHours.close);
              return (
                <th
                  key={h}
                  colSpan={4}
                  className="border-b border-r border-border bg-secondary text-center text-[11px] font-semibold"
                >
                  <span className="font-mono">
                    {String(h).padStart(2, '0')}
                  </span>
                  {open && (
                    <Sun className="ml-1 inline size-3 text-accent" aria-hidden />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => {
            const row = result.schedule[e.id] ?? {};
            const runs = getRuns(slots, row);
            return (
              <tr key={e.id} className="border-b border-border" style={{ height: 32 }}>
                <td
                  className="sticky left-0 z-10 border-r border-border bg-background p-2"
                  style={{ minWidth: NAME_WIDTH }}
                >
                  <div className="text-xs font-semibold leading-tight">{e.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {e.shiftStart}–{e.shiftEnd}
                    {e.specialisedRole ? ` · ${specialisedRoleLabel(e.specialisedRole)}` : ''}
                  </div>
                </td>
                {runs.map((run) => {
                  const meta = JOBS[run.job];
                  const isHourStart = run.slot % 60 === 0;
                  const showText =
                    run.length >= 2 && run.job !== 'off' && meta.short.length > 0;
                  const slotOpen = storeHours ? isOpenSlot(run.slot, storeHours) : true;
                  return (
                    <td
                      key={run.slot}
                      colSpan={run.length}
                      title={`${formatSlot(run.slot)}–${formatSlot(run.slot + run.length * 15)} — ${meta.label}${slotOpen ? '' : ' (closed)'}`}
                      style={{
                        background: meta.colour,
                        padding: 0,
                        borderRight: '1px solid var(--border)',
                        borderLeft: isHourStart ? '2px solid #6b7280' : undefined,
                        opacity: run.job === 'off' ? 0.3 : 1,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      {showText && (
                        <span className="block truncate px-1 text-[10px] font-semibold leading-none text-foreground">
                          {meta.short}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
