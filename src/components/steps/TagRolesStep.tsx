'use client';

import { useState } from 'react';
import { HelpBubble } from '@/components/HelpBubble';
import type { Department, Employee, SpecialisedRole } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface Props {
  employees: Employee[];
  onChange: (next: Employee[]) => void;
  onBack: () => void;
  onContinue: () => void;
}

const ROLE_OPTIONS: { value: SpecialisedRole | 'General'; label: string; description: string }[] = [
  { value: 'General', label: 'No specialist role', description: 'General team member; covers any role.' },
  { value: 'lingerie', label: 'Bra Fit', description: 'Lingerie fitting specialist.' },
  { value: 'bureau', label: 'Bureau', description: 'Bureau / travel money desk.' },
  { value: 'vm', label: 'Visual Merchandising', description: 'Displays, windows, and floor presentation.' },
  { value: 'isf', label: 'Stock Controller', description: 'Stock profiling.' },
  { value: 'tsm', label: 'TSM (Team Support Manager)', description: 'Reserved. Placed on a role only when no other cover is available.' },
];

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'menswear', label: 'Menswear' },
  { value: 'womenswear', label: 'Womenswear' },
  { value: 'kidswear', label: 'Kidswear' },
  { value: 'home', label: 'Home' },
  { value: 'beauty', label: 'Beauty' },
];

function TagRolesRow({
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

  return (
    <TableRow data-selected={selected} className={cn('[&[data-selected=true]]:bg-secondary/40')}>
      <TableCell className="w-10 align-top">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect()}
          aria-label={`Select ${employee.name}`}
        />
      </TableCell>
      <TableCell className="min-w-[12rem] align-top">
        <div className="flex items-center gap-2">
          {employee.specialisedRole && (
            <span
              className="size-2 shrink-0 rounded-full bg-accent"
              aria-label="Has specialist role"
            />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium">{employee.name}</span>
            <span className="text-[10px] text-muted-foreground">
              {employee.shiftStart}–{employee.shiftEnd}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <Select
          value={employee.specialisedRole ?? 'General'}
          onValueChange={(v) =>
            update({
              specialisedRole:
                v === 'General' ? undefined : (v as SpecialisedRole | undefined),
            })
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex h-8 items-center">
          <Switch
            checked={!!employee.specialisedPreferred}
            disabled={!employee.specialisedRole}
            onCheckedChange={(checked) => update({ specialisedPreferred: !!checked })}
            aria-label="Mark as preferred for specialist role"
          />
        </div>
      </TableCell>
      <TableCell className="align-top">
        <Select
          value={employee.department}
          onValueChange={(v) => update({ department: v as Department })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  );
}

export function TagRolesStep({ employees, onChange, onBack, onContinue }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDept, setBulkDept] = useState<Department | ''>('');
  const [bulkRole, setBulkRole] = useState<SpecialisedRole | 'General'>('General');

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

  const applyBulkDept = (dept: Department) => {
    onChange(
      employees.map((e) => (selected.has(e.id) ? { ...e, department: dept } : e))
    );
    setBulkDept('');
  };

  const applyBulkRole = (role: SpecialisedRole | 'General') => {
    onChange(
      employees.map((e) =>
        selected.has(e.id)
          ? { ...e, specialisedRole: role === 'General' ? undefined : role }
          : e
      )
    );
    setBulkRole('General');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-1.5 text-xl font-semibold tracking-tight">
          Assign roles &amp; departments
          <HelpBubble label="What are specialist roles?">
            <p className="mb-2">
              Specialist roles are specific jobs that require training. The scheduler assigns
              them to tagged staff first.
            </p>
            <ul className="space-y-1">
              {ROLE_OPTIONS.filter((r) => r.value !== 'General').map((role) => (
                <li key={role.value}>
                  <span className="font-medium text-foreground">{role.label}:</span>{' '}
                  {role.description}
                </li>
              ))}
            </ul>
          </HelpBubble>
        </h2>
        <p className="text-sm text-muted-foreground">
          Indicate which staff are assigned to specialist jobs today, and which department
          each person works in. This determines who can cover fitting rooms and which
          specialist roles are filled.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff</CardTitle>
          <CardDescription>
            {employees.length} {employees.length === 1 ? 'person' : 'people'} to assign.
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
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Specialist role
                      <HelpBubble label="Specialist role" size="sm">
                        A trained role that only this person can perform (Bra Fit, Bureau,
                        Visual Merchandising, or Stock Controller). The scheduler assigns
                        specialist roles to tagged staff first.
                      </HelpBubble>
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Preferred
                      <HelpBubble label="Preferred" size="sm">
                        Marks this person as the first choice for their specialist role
                        across the day. Use this when several people share a tag but one is
                        more experienced.
                      </HelpBubble>
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Department
                      <HelpBubble label="Department" size="sm">
                        Used to match staff to the correct fitting room (e.g. menswear staff
                        cover the mens fitting room). &quot;Any&quot; indicates they can cover
                        either.
                      </HelpBubble>
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e, i) => (
                  <TagRolesRow
                    key={e.id}
                    employee={e}
                    selected={selected.has(e.id)}
                    onToggleSelect={() => toggle(e.id)}
                    onChange={(next) => update(i, next)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-accent/40 bg-secondary p-3 text-sm">
          <Badge variant="outline" className="border-accent/50 bg-accent/10 text-accent">
            {selected.size} selected
          </Badge>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Set role:</span>
            <Select
              value={bulkRole}
              onValueChange={(v) => {
                const val = v as SpecialisedRole | 'General';
                setBulkRole(val);
                applyBulkRole(val);
              }}
            >
              <SelectTrigger size="sm" className="h-8 w-44">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.value === 'General' ? 'Clear role' : opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Set department:</span>
            <Select
              value={bulkDept}
              onValueChange={(v) => {
                const val = v as Department;
                setBulkDept(val);
                applyBulkDept(val);
              }}
            >
              <SelectTrigger size="sm" className="h-8 w-36">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
            className="ml-auto"
          >
            Clear
          </Button>
        </div>
      )}

      <StepFooter
        onBack={onBack}
        onContinue={onContinue}
        backLabel="Back: Staff"
        continueLabel="Continue: Staffing rules"
      />
    </div>
  );
}
