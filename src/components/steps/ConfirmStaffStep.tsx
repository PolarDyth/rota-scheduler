'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { HelpBubble } from '@/components/HelpBubble';
import type { BreakPeriod, Employee } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StepFooter } from '@/components/StepFooter';
import { cn } from '@/lib/utils';
import { timeToMinutes } from '@/lib/time';

interface Props {
  employees: Employee[];
  onChange: (next: Employee[]) => void;
  extractedDate?: string;
  rawWarnings: string[];
  onBack: () => void;
  onContinue: () => void;
}

interface RowIssue {
  kind: 'no-end' | 'empty-name' | 'break-outside';
  message: string;
}

function rowIssues(emp: Employee): RowIssue[] {
  const issues: RowIssue[] = [];
  if (!emp.name.trim()) {
    issues.push({ kind: 'empty-name', message: 'No name entered' });
  }
  if (emp.shiftEnd && emp.shiftStart && timeToMinutes(emp.shiftEnd) <= timeToMinutes(emp.shiftStart)) {
    issues.push({ kind: 'no-end', message: 'Shift end must be after start' });
  }
  for (const b of emp.breaks) {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    const ss = timeToMinutes(emp.shiftStart);
    const se = timeToMinutes(emp.shiftEnd);
    if (bs < ss || be > se) {
      issues.push({ kind: 'break-outside', message: 'Break outside shift' });
      break;
    }
  }
  return issues;
}

function ConfirmStaffRow({
  employee,
  selected,
  onToggleSelect,
  onChange,
}: {
  employee: Employee;
  selected: boolean;
  onToggleSelect: () => void;
  onChange: (next: Employee) => void;
}) {
  const update = (patch: Partial<Employee>) => onChange({ ...employee, ...patch });
  const issues = rowIssues(employee);

  const updateBreak = (idx: number, patch: Partial<BreakPeriod>) => {
    const breaks = employee.breaks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    update({ breaks });
  };
  const addBreak = () =>
    update({ breaks: [...employee.breaks, { start: '12:00', end: '12:30' }] });
  const removeBreak = (idx: number) =>
    update({ breaks: employee.breaks.filter((_, i) => i !== idx) });

  return (
    <TableRow data-selected={selected} className={cn('[&[data-selected=true]]:bg-secondary/40')}>
      <TableCell className="w-10 align-top">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect()}
          aria-label={`Select ${employee.name || 'row'}`}
        />
      </TableCell>
      <TableCell className="min-w-[12rem] align-top">
        <Input
          type="text"
          value={employee.name}
          onChange={(e) => update({ name: e.target.value })}
          className="min-w-[10rem]"
          aria-label="Employee name"
        />
        {employee.pdfTags.length > 0 && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            From PDF: {employee.pdfTags.join(' · ')}
          </p>
        )}
      </TableCell>
      <TableCell className="align-top">
        <Input
          type="time"
          value={employee.shiftStart}
          onChange={(e) => update({ shiftStart: e.target.value })}
          className="w-28"
          aria-label="Shift start"
        />
      </TableCell>
      <TableCell className="align-top">
        <Input
          type="time"
          value={employee.shiftEnd}
          onChange={(e) => update({ shiftEnd: e.target.value })}
          className="w-28"
          aria-label="Shift end"
        />
      </TableCell>
      <TableCell className="min-w-[18rem] align-top">
        <div className="flex flex-col gap-1.5">
          {employee.breaks.length === 0 && (
            <span className="text-xs italic text-muted-foreground">No breaks</span>
          )}
          {employee.breaks.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                type="time"
                value={b.start}
                onChange={(e) => updateBreak(i, { start: e.target.value })}
                className="h-8 w-24 text-xs"
                aria-label={`Break ${i + 1} start`}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={b.end}
                onChange={(e) => updateBreak(i, { end: e.target.value })}
                className="h-8 w-24 text-xs"
                aria-label={`Break ${i + 1} end`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeBreak(i)}
                aria-label="Remove break"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addBreak}
            className="w-fit justify-start px-2 text-xs"
          >
            <Plus className="size-3.5" aria-hidden />
            Add break
          </Button>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-col gap-1">
          {issues.length === 0 ? (
            <span className="text-xs text-muted-foreground">Looks good</span>
          ) : (
            issues.slice(0, 1).map((iss, i) => (
              <Badge
                key={i}
                variant="outline"
                className="w-fit gap-1 border-accent/50 bg-accent/10 text-accent"
              >
                <AlertTriangle className="size-3" aria-hidden />
                {iss.message}
              </Badge>
            ))
          )}
          {issues.length > 1 && (
            <span className="text-[10px] text-muted-foreground">
              +{issues.length - 1} more
            </span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ConfirmStaffStep({
  employees,
  onChange,
  extractedDate,
  rawWarnings,
  onBack,
  onContinue,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };
  const allSelected = employees.length > 0 && selected.size === employees.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(employees.map((e) => e.id)));
  };

  const update = (idx: number, next: Employee) => {
    onChange(employees.map((e, i) => (i === idx ? next : e)));
  };

  const deleteSelected = () => {
    onChange(employees.filter((e) => !selected.has(e.id)));
    setSelected(new Set());
  };

  const blockingCount = useMemo(() => {
    let count = 0;
    for (const emp of employees) {
      const issues = rowIssues(emp);
      if (issues.some((i) => i.kind === 'no-end' || i.kind === 'empty-name')) count++;
    }
    return count;
  }, [employees]);

  const canContinue = employees.length > 0 && blockingCount === 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Check who&apos;s working today
          {extractedDate ? ` — ${extractedDate}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          We found {employees.length} {employees.length === 1 ? 'person' : 'people'}. Please
          check each name, shift time, and break — fix anything that looks wrong before
          continuing.
        </p>
      </div>

      {rawWarnings.length > 0 && (
        <details className="group rounded-md border border-border bg-muted/50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            {rawWarnings.length} extraction note
            {rawWarnings.length === 1 ? '' : 's'} from the PDF
          </summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {rawWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff on shift</CardTitle>
          <CardDescription>
            Times are 24-hour. Breaks are unpaid — they show as grey on the final schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Shift start</TableHead>
                  <TableHead>Shift end</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Breaks
                      <HelpBubble label="Breaks" size="sm">
                        Unpaid rest breaks. Add as many as needed. Breaks show as grey cells
                        on the final schedule so staff know when they&apos;re off the floor.
                      </HelpBubble>
                    </span>
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e, i) => (
                  <ConfirmStaffRow
                    key={e.id}
                    employee={e}
                    selected={selected.has(e.id)}
                    onToggleSelect={() => toggle(e.id)}
                    onChange={(next) => update(i, next)}
                  />
                ))}
                {employees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No staff found. Go back and re-upload the PDF.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-accent/40 bg-secondary p-3 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear selection
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={deleteSelected}
              className="text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Remove
            </Button>
          </div>
        </div>
      )}

      <StepFooter
        onBack={onBack}
        onContinue={onContinue}
        backLabel="Back: Upload"
        continueLabel="Continue: Tag roles"
        continueDisabled={!canContinue}
        continueHint={
          blockingCount > 0
            ? `${blockingCount} row${blockingCount === 1 ? '' : 's'} need fixing before you can continue`
            : undefined
        }
      />
    </div>
  );
}
