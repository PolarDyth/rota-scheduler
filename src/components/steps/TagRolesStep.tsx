'use client';

import { useState } from 'react';
import { Info, Star } from 'lucide-react';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { StepFooter } from '@/components/StepFooter';
import { cn } from '@/lib/utils';

interface Props {
  employees: Employee[];
  onChange: (next: Employee[]) => void;
  onBack: () => void;
  onContinue: () => void;
}

const ROLE_OPTIONS: { value: SpecialisedRole | 'General'; label: string; description: string }[] = [
  { value: 'General', label: 'No specialist role', description: 'General team member who covers any role.' },
  { value: 'lingerie', label: 'Bra Fit', description: 'Lingerie fitting specialist.' },
  { value: 'bureau', label: 'Bureau', description: 'Bureau / travel money desk.' },
  { value: 'vm', label: 'Visual Merchandising', description: 'Displays, windows, and floor presentation.' },
  { value: 'isf', label: 'Stock Controller', description: 'Stock profiling.' },
  { value: 'tsm', label: 'TSM (Team Support Manager)', description: 'Reserved. Only placed on a role when no one else can cover it.' },
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
    else setSelected(new Set(employees.map((e, i) => e.id + i)));
  };

  const update = (idx: number, next: Employee) => {
    onChange(employees.map((e, i) => (i === idx ? next : e)));
  };

  const applyBulkDept = (dept: Department) => {
    onChange(
      employees.map((e, i) => (selected.has(e.id + i) ? { ...e, department: dept } : e))
    );
    setBulkDept('');
  };

  const applyBulkRole = (role: SpecialisedRole | 'General') => {
    onChange(
      employees.map((e, i) =>
        selected.has(e.id + i)
          ? { ...e, specialisedRole: role === 'General' ? undefined : role }
          : e
      )
    );
    setBulkRole('General');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Tag roles &amp; departments</h2>
        <p className="text-sm text-muted-foreground">
          Pick which staff are doing specialist jobs today, and which department each person
          works in. This decides who can cover fitting rooms and which specialist roles get
          filled.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="size-4 text-accent" aria-hidden />
                Not sure what these mean?
              </CardTitle>
              <CardDescription>
                Specialist roles are specific jobs that need training. Tap to expand for a
                short description of each.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion multiple={false}>
            {ROLE_OPTIONS.filter((r) => r.value !== 'General').map((role) => (
              <AccordionItem key={role.value} value={role.value}>
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Star className="size-3.5 text-accent" aria-hidden />
                    {role.label}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {role.description}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff</CardTitle>
          <CardDescription>
            {employees.length} {employees.length === 1 ? 'person' : 'people'} to tag.
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
                        A trained role that only this person can do (Bra Fit, Bureau, Visual
                        Merchandising, or Stock Controller). The scheduler always assigns
                        specialist roles to tagged staff first.
                      </HelpBubble>
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Preferred?
                      <HelpBubble label="Preferred?" size="sm">
                        Marks this person as the first choice for their specialist role
                        across the day. Useful when several people share a tag but one is
                        more experienced.
                      </HelpBubble>
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Department
                      <HelpBubble label="Department" size="sm">
                        Used to match people to the right fitting room (e.g. menswear staff
                        cover the mens fitting room). &quot;Any&quot; means they can cover
                        either.
                      </HelpBubble>
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e, i) => (
                  <TagRolesRow
                    key={e.id + i}
                    employee={e}
                    selected={selected.has(e.id + i)}
                    onToggleSelect={() => toggle(e.id + i)}
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
