'use client';

import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { HelpBubble } from '@/components/HelpBubble';
import { JOBS, UNLIMITED, newRuleId } from '@/lib/scheduler/jobs';
import type { JobId, StaffingRule } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PriorityOrderEditor } from '@/components/PriorityOrderEditor';
import { StepFooter } from '@/components/StepFooter';

interface Props {
  rules: StaffingRule[];
  onChange: (next: StaffingRule[]) => void;
  priorityOrder: JobId[];
  onPriorityChange: (next: JobId[]) => void;
  maxRoleBlock: number;
  onMaxRoleBlockChange: (next: number) => void;
  onBack: () => void;
  onGenerate: () => void;
}

const GROUPS: { id: string; label: string; description: string; jobs: JobId[] }[] = [
  {
    id: 'customer',
    label: 'Customer-facing',
    description: 'Tills, hosting, and click & collect.',
    jobs: ['tills', 'hosting', 'clickCollect'],
  },
  {
    id: 'fitting',
    label: 'Fitting rooms',
    description: 'Mens and womens fitting room cover.',
    jobs: ['fittingMens', 'fittingWomens'],
  },
  {
    id: 'floor',
    label: 'Floor',
    description: 'Delivery, repro, and standards.',
    jobs: ['delivery', 'repro', 'standards'],
  },
  {
    id: 'specialist',
    label: 'Specialist',
    description: 'Specialist roles filled by tagged staff.',
    jobs: ['lingerie', 'bureau', 'vm', 'isf'],
  },
];

export function StaffingRulesStep({
  rules,
  onChange,
  priorityOrder,
  onPriorityChange,
  maxRoleBlock,
  onMaxRoleBlockChange,
  onBack,
  onGenerate,
}: Props) {
  const updateRule = (id: string, patch: Partial<StaffingRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const deleteRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };
  const addRule = (job: JobId) => {
    onChange([
      ...rules,
      { id: newRuleId(), job, start: '10:00', end: '18:00', count: 1 },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Set staffing rules</h2>
        <p className="text-sm text-muted-foreground">
          Set how many staff each role needs at different times of day. These rules
          determine which jobs are filled first when staffing is limited.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rotation settings</CardTitle>
          <CardDescription>How long staff remain on each job before rotating.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-sm font-medium">
              <Label htmlFor="max-role-block">Maximum hours on the same role:</Label>
              <HelpBubble label="Maximum hours on the same role" size="sm">
                The longest a staff member will remain on the same job before being rotated
                to a different one. Set 0 to allow them to remain all day. Specialist roles
                are exempt — tagged staff remain on their role.
              </HelpBubble>
            </span>
            <Input
              id="max-role-block"
              type="number"
              min={0}
              max={8}
              value={Number.isFinite(maxRoleBlock) ? maxRoleBlock : 0}
              onChange={(e) =>
                onMaxRoleBlockChange(Math.max(0, Number(e.target.value) || 0))
              }
              className="h-8 w-20"
            />
            <span className="text-xs text-muted-foreground">
              Set 0 for no limit. Specialist roles are exempt.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff by role</CardTitle>
          <CardDescription>
            Each role shows the time windows where cover is required. Add as many windows
            as needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="customer">
            <TabsList className="w-full justify-start overflow-x-auto">
              {GROUPS.map((group) => (
                <TabsTrigger
                  key={group.id}
                  value={group.id}
                  className="data-[state=active]:bg-foreground data-[state=active]:text-background"
                >
                  {group.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {GROUPS.map((group) => (
              <TabsContent key={group.id} value={group.id} className="mt-4">
                <p className="mb-3 text-xs text-muted-foreground">{group.description}</p>
                <div className="space-y-4">
                  {group.jobs.map((job) => {
                    const jobRules = rules.filter((r) => r.job === job);
                    const meta = JOBS[job];
                    return (
                      <div
                        key={job}
                        className="rounded-md border border-border p-3"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className="inline-block size-3 rounded-sm border border-border"
                            style={{ background: meta.colour }}
                            aria-hidden
                          />
                          <span className="text-sm font-medium">{meta.label}</span>
                        </div>
                        <div className="space-y-1.5">
                          {jobRules.length === 0 && (
                            <p className="text-xs italic text-muted-foreground">
                              No windows set — this role will not be staffed.
                            </p>
                          )}
                          {jobRules.map((r) => {
                            const unlimited = r.count === UNLIMITED;
                            return (
                              <div
                                key={r.id}
                                className="flex flex-wrap items-center gap-2 text-sm"
                              >
                                <Input
                                  type="time"
                                  value={r.start}
                                  onChange={(e) =>
                                    updateRule(r.id, { start: e.target.value })
                                  }
                                  className="h-8 w-24 text-xs"
                                  aria-label="Window start"
                                />
                                <span className="text-muted-foreground">–</span>
                                <Input
                                  type="time"
                                  value={r.end}
                                  onChange={(e) =>
                                    updateRule(r.id, { end: e.target.value })
                                  }
                                  className="h-8 w-24 text-xs"
                                  aria-label="Window end"
                                />
                                <Separator orientation="vertical" className="h-6" />
                                <Input
                                  type="number"
                                  min={1}
                                  max={9}
                                  value={unlimited ? '' : r.count}
                                  disabled={unlimited}
                                  onChange={(e) =>
                                    updateRule(r.id, {
                                      count: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  className="h-8 w-14 text-xs"
                                  aria-label="People needed"
                                />
                                <span className="text-xs text-muted-foreground">people</span>
                                <Separator orientation="vertical" className="h-6" />
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Label className="flex items-center gap-1.5">
                                    <Switch
                                      size="sm"
                                      checked={unlimited}
                                      onCheckedChange={(checked) =>
                                        updateRule(r.id, {
                                          count: checked ? UNLIMITED : 1,
                                        })
                                      }
                                    />
                                    No max
                                  </Label>
                                  <HelpBubble label="No max" size="sm">
                                    Fills this role with as many eligible staff as possible
                                    during the window, instead of a fixed number. Useful for
                                    specialist roles such as Stock Controller.
                                  </HelpBubble>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => deleteRule(r.id)}
                                  aria-label="Delete window"
                                  className="ml-auto text-destructive hover:bg-destructive/5"
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                </Button>
                              </div>
                            );
                          })}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addRule(job)}
                            className="px-2 text-xs"
                          >
                            <Plus className="size-3.5" aria-hidden />
                            Add window
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Accordion multiple={false}>
        <AccordionItem value="priority" className="rounded-md border border-border px-4">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            <span className="flex items-center gap-2">
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
              Advanced: priority order
            </span>
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <p className="mb-3 text-xs text-muted-foreground">
              When staffing is constrained, higher-priority roles fill first. Specialist
              roles are always assigned to tagged staff regardless of order — reordering
              them affects warning sequence only.
            </p>
            <PriorityOrderEditor order={priorityOrder} onChange={onPriorityChange} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <StepFooter
        onBack={onBack}
        onContinue={onGenerate}
        backLabel="Back: Roles"
        continueLabel="Generate schedule"
      />
    </div>
  );
}
