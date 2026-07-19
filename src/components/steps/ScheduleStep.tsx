'use client';

import { CheckCircle2, Printer, AlertTriangle } from 'lucide-react';
import type {
  Employee,
  Hour,
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
import { Badge } from '@/components/ui/badge';
import { ScheduleGrid } from '@/components/ScheduleGrid';
import { Legend } from '@/components/Legend';
import { PrintHeader } from '@/components/PrintHeader';

interface Props {
  employees: Employee[];
  hours: Hour[];
  slots: Slot[];
  result: ScheduleResult;
  date?: string;
  dayName?: string;
  storeHours?: StoreHours;
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

export function ScheduleStep({
  employees,
  hours,
  slots,
  result,
  date,
  dayName,
  storeHours,
  onBack,
}: Props) {
  const prettyDate = dayName ? `${dayName} ${date ?? ''}`.trim() : date;
  const warningCount = result.warnings.length;

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

      <div className="no-print flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back: Edit rules
        </Button>
        <Button type="button" onClick={() => window.print()} size="lg">
          <Printer className="size-4" aria-hidden />
          Print schedule
        </Button>
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
          <CardTitle className="text-base">Schedule</CardTitle>
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
          />
        </CardContent>
      </Card>

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
          <CardContent>
            <ul className="space-y-2 text-sm">
              {result.warnings.map((w, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(w.hour).padStart(2, '0')}:00
                  </span>
                  <Badge
                    variant="outline"
                    className="border-accent/40 bg-accent/10 text-accent"
                  >
                    {KIND_LABEL[w.kind]}
                  </Badge>
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
