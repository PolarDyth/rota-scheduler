'use client';

import { useState } from 'react';
import { Sun, Check, Pencil } from 'lucide-react';
import { JOBS, specialisedRoleLabel, formatSlot } from '@/lib/scheduler/jobs';
import type { Employee, Hour, JobId, ScheduleResult, Slot, StoreHours } from '@/lib/types';
import { isOpenSlot } from '@/lib/scheduler/storeHours';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  employees: Employee[];
  hours: Hour[];
  slots: Slot[];
  result: ScheduleResult;
  storeHours?: StoreHours;
  onEditBlock?: (empId: string, startSlot: Slot, length: number, newJob: JobId) => void;
}

const SLOT_WIDTH = 18;
const NAME_WIDTH = 160;

interface Run {
  slot: Slot;
  length: number;
  job: JobId;
}

interface EditTarget {
  empId: string;
  slot: Slot;
  length: number;
  job: JobId;
}

const PICKER_GROUPS: { label: string; jobs: JobId[] }[] = [
  { label: 'Trading', jobs: ['tills', 'hosting', 'clickCollect', 'fittingMens', 'fittingWomens'] },
  { label: 'General', jobs: ['repro', 'standards', 'delivery'] },
  { label: 'Specialised', jobs: ['lingerie', 'bureau', 'vm', 'isf'] },
  { label: 'Status', jobs: ['break', 'idle'] },
];

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
  onEditBlock,
}: Props) {
  const totalWidth = NAME_WIDTH + slots.length * SLOT_WIDTH;
  const [editing, setEditing] = useState<EditTarget | null>(null);

  function pick(job: JobId) {
    if (editing && onEditBlock) {
      onEditBlock(editing.empId, editing.slot, editing.length, job);
    }
    setEditing(null);
  }

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
                  const editable = !!onEditBlock && run.job !== 'off';
                  const isEditing =
                    editing?.empId === e.id && editing?.slot === run.slot && editing?.length === run.length;
                  const timeLabel = `${formatSlot(run.slot)}–${formatSlot(run.slot + run.length * 15)}`;
                  return (
                    <td
                      key={run.slot}
                      colSpan={run.length}
                      className={editable ? 'group' : undefined}
                      title={`${timeLabel} — ${meta.label}${slotOpen ? '' : ' (closed)'}`}
                      style={{
                        background: meta.colour,
                        padding: 0,
                        borderRight: '1px solid var(--border)',
                        borderLeft: isHourStart ? '2px solid #6b7280' : undefined,
                        opacity: run.job === 'off' ? 0.3 : 1,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        position: editable ? 'relative' : undefined,
                        cursor: editable ? 'pointer' : run.job === 'off' ? 'not-allowed' : 'default',
                      }}
                    >
                      {showText && (
                        <span className="block truncate px-1 text-[10px] font-semibold leading-none text-foreground pointer-events-none">
                          {meta.short}
                        </span>
                      )}
                      {editable && (
                        <>
                          <Pencil
                            className="no-print pointer-events-none absolute right-0.5 top-0.5 size-2.5 text-foreground opacity-0 transition-opacity group-hover:opacity-70"
                            aria-hidden
                          />
                          <Popover
                            open={isEditing}
                            onOpenChange={(o) => {
                              if (o) setEditing({ empId: e.id, slot: run.slot, length: run.length, job: run.job });
                              else setEditing(null);
                            }}
                          >
                            <PopoverTrigger
                              render={
                                <button
                                  type="button"
                                  className="no-print absolute inset-0 h-full w-full bg-transparent transition-all group-hover:bg-foreground/5 group-hover:ring-2 group-hover:ring-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                  aria-label={`${e.name} ${timeLabel} — ${meta.label} — click to change`}
                                />
                              }
                            />
                            {isEditing && (
                              <PopoverContent
                                className="w-72 p-2"
                                align="start"
                                sideOffset={4}
                              >
                                <div className="mb-2 px-1">
                                  <div className="text-sm font-semibold leading-tight">{e.name}</div>
                                  <div className="font-mono text-[11px] text-muted-foreground">
                                    {timeLabel} · current: {meta.label}
                                  </div>
                                </div>
                                <div className="no-print flex max-h-80 flex-col gap-2 overflow-y-auto">
                                  {PICKER_GROUPS.map((group) => (
                                    <div key={group.label} className="space-y-1">
                                      <div className="px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                                        {group.label}
                                      </div>
                                      {group.jobs.map((jobId) => {
                                        const jobMeta = JOBS[jobId];
                                        const current = run.job === jobId;
                                        return (
                                          <button
                                            key={jobId}
                                            type="button"
                                            onClick={() => pick(jobId)}
                                            className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary"
                                          >
                                            <span
                                              className="size-4 shrink-0 rounded-sm border border-border"
                                              style={{ background: jobMeta.colour }}
                                              aria-hidden
                                            />
                                            <span className="flex-1 font-medium text-foreground">
                                              {jobMeta.label}
                                            </span>
                                            {current && (
                                              <Check className="size-3.5 text-accent" aria-hidden />
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              </PopoverContent>
                            )}
                          </Popover>
                        </>
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
