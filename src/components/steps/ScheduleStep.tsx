'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Printer, AlertTriangle, RotateCcw, Info } from 'lucide-react';
import type {
  Employee,
  Hour,
  JobId,
  ScheduleResult,
  Slot,
  StoreHours,
  ScheduleWarningKind,
} from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { Legend } from '@/components/Legend';
import { PrintHeader } from '@/components/PrintHeader';
import { HelpBubble } from '@/components/HelpBubble';
import { InfoAlert } from '@/components/InfoAlert';

interface Props {
  employees: Employee[];
  hours: Hour[];
  slots: Slot[];
  result: ScheduleResult;
  date?: string;
  dayName?: string;
  storeHours?: StoreHours;
  manuallyEdited?: boolean;
  onEditBlock?: (empId: string, startSlot: Slot, length: number, newJob: JobId) => void;
  onRegenerate?: () => void;
  onBack: () => void;
}

const KIND_LABEL: Record<ScheduleWarningKind, string> = {
  understaffed: 'Not enough staff',
  unassigned: 'Unassigned',
  shortShift: 'Short shift',
  overlap: 'Overlap',
  breakShifted: 'Break moved',
  breakCovered: 'Break covered',
};

const KIND_ORDER: ScheduleWarningKind[] = [
  'understaffed',
  'unassigned',
  'overlap',
  'shortShift',
  'breakShifted',
  'breakCovered',
];

export function ScheduleStep({
  employees,
  hours,
  slots,
  result,
  date,
  dayName,
  storeHours,
  manuallyEdited,
  onEditBlock,
  onRegenerate,
  onBack,
}: Props) {
  const prettyDate = dayName ? `${dayName} ${date ?? ''}`.trim() : date;
  const warnings = result.warnings;
  const warningCount = warnings.length;

  const warningsByKind = useMemo(() => {
    const map: Record<ScheduleWarningKind, typeof warnings> = {
      understaffed: [],
      unassigned: [],
      overlap: [],
      shortShift: [],
      breakShifted: [],
      breakCovered: [],
    };
    for (const w of warnings) {
      map[w.kind].push(w);
    }
    for (const k of KIND_ORDER) {
      map[k].sort((a, b) => a.hour - b.hour);
    }
    return map;
  }, [warnings]);

  const activeKinds = KIND_ORDER.filter((k) => warningsByKind[k].length > 0);
  const [filter, setFilter] = useState<ScheduleWarningKind | null>(null);
  const visibleKinds = filter && warningsByKind[filter].length > 0 ? [filter] : activeKinds;

  function handleRegenerate() {
    if (!onRegenerate) return;
    if (manuallyEdited) {
      const ok = window.confirm(
        'Discard your manual changes and regenerate the schedule from the rules?'
      );
      if (!ok) return;
    }
    onRegenerate();
  }

  return (
    <div className="space-y-4">
      <Card className="no-print border-accent/30 bg-accent/5">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-7 shrink-0 text-accent" aria-hidden />
            <div className="space-y-0.5">
              <h2 className="text-lg font-semibold tracking-tight">
                Your schedule is ready
              </h2>
              <p className="text-sm text-muted-foreground">
                {prettyDate && <span className="font-medium text-foreground">{prettyDate} · </span>}
                {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
                {warningCount > 0 ? ` · ${warningCount} ${warningCount === 1 ? 'thing' : 'things'} to check` : ' · no issues found'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back: Edit rules
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {onRegenerate && (
            <Button type="button" variant="ghost" onClick={handleRegenerate}>
              <RotateCcw className="size-4" aria-hidden />
              Regenerate from rules
            </Button>
          )}
          <Button type="button" onClick={() => window.print()} size="lg">
            <Printer className="size-4" aria-hidden />
            Print schedule
          </Button>
        </div>
      </div>

      <PrintHeader date={prettyDate} headcount={employees.length} />

      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-base">What the colours mean</CardTitle>
          <CardDescription>
            Each role has its own colour. Closed hours show faded cells.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Legend />
        </CardContent>
      </Card>

      <Card className="print-borderless schedule-print-card">
        <CardHeader className="no-print">
          <CardTitle className="flex items-center gap-1.5 text-base">
            Schedule
            {onEditBlock && (
              <HelpBubble label="Editing the schedule">
                Click any block to change what someone is doing for that hour. Job and break
                blocks are editable; off-shift time is locked. Changes save automatically.
              </HelpBubble>
            )}
          </CardTitle>
          <CardDescription>
            Time runs across the top in 15-minute steps. Each row is one employee.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScheduleGrid
            employees={employees}
            hours={hours}
            slots={slots}
            result={result}
            storeHours={storeHours}
            onEditBlock={onEditBlock}
          />
        </CardContent>
      </Card>

      {manuallyEdited && (
        <InfoAlert
          tone="info"
          icon={<Info className="size-4" aria-hidden />}
          title="This schedule has been manually edited"
          className="no-print"
        >
          Warnings below reflect the original algorithmic generation and may no longer match
          what is on the grid.
        </InfoAlert>
      )}

      {warningCount > 0 && (
        <Card className="no-print border-accent/30 bg-secondary/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-accent" aria-hidden />
              {warningCount} {warningCount === 1 ? 'thing' : 'things'} to check
            </CardTitle>
            <CardDescription>
              These are not blocking — the schedule will still print. Just things to be
              aware of.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilter(null)}
                className={
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ' +
                  (filter === null
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-foreground hover:bg-secondary')
                }
              >
                All
                <span className="font-mono tabular-nums">{warningCount}</span>
              </button>
              {activeKinds.map((kind) => {
                const isActive = filter === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setFilter(isActive ? null : kind)}
                    className={
                      'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ' +
                      (isActive
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20')
                    }
                    aria-pressed={isActive}
                  >
                    {KIND_LABEL[kind]}
                    <span className="font-mono tabular-nums">{warningsByKind[kind].length}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              {visibleKinds.map((kind) => {
                const items = warningsByKind[kind];
                const twoCol = items.length > 6;
                return (
                  <section key={kind} className="space-y-1.5">
                    {visibleKinds.length > 1 && (
                      <div className="flex items-baseline gap-2 border-b border-border pb-1">
                        <h4 className="text-xs font-semibold tracking-wide text-foreground uppercase">
                          {KIND_LABEL[kind]}
                        </h4>
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {items.length}
                        </span>
                      </div>
                    )}
                    <ul
                      className={
                        'text-sm ' +
                        (twoCol
                          ? 'grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2'
                          : 'space-y-0.5')
                      }
                    >
                      {items.map((w, i) => (
                        <li key={i} className="flex items-baseline gap-2">
                          <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                            {String(w.hour).padStart(2, '0')}:00
                          </span>
                          <span className="text-foreground">{w.message}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
