'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Employee,
  ExtractedRota,
  JobId,
  ScheduleResult,
  StaffingRule,
  StoreHours,
} from '@/lib/types';
import { generateSchedule } from '@/lib/scheduler/generateSchedule';
import { TRADING_HOURS, TRADING_SLOTS, PRIORITY_ORDER, defaultStaffingRules } from '@/lib/scheduler/jobs';
import { storeHoursForDay } from '@/lib/scheduler/storeHours';
import {
  STEP_ORDER,
  type Step,
  nextStepAfter,
} from '@/lib/flow';
import { AppShell } from '@/components/AppShell';
import { UploadStep } from '@/components/steps/UploadStep';
import { ConfirmStaffStep } from '@/components/steps/ConfirmStaffStep';
import { TagRolesStep } from '@/components/steps/TagRolesStep';
import { StaffingRulesStep } from '@/components/steps/StaffingRulesStep';
import { ScheduleStep } from '@/components/steps/ScheduleStep';
import { Button } from '@/components/ui/button';
import { InfoAlert } from '@/components/InfoAlert';

interface FlowState {
  step: Step;
  extractedDate?: string;
  extractedDay?: string;
  rawWarnings: string[];
  employees: Employee[];
  staffing: StaffingRule[];
  priorityOrder: JobId[];
  maxRoleBlock: number;
  schedule: ScheduleResult | null;
  storeHours?: StoreHours;
  completedSteps: Step[];
}

const STORAGE_KEY = 'rota-flow-v1';

function migratePriorityOrder(saved: JobId[] | undefined): JobId[] {
  if (!saved || !Array.isArray(saved)) return [...PRIORITY_ORDER];
  const known = new Set(PRIORITY_ORDER);
  const seen = new Set<JobId>();
  const kept: JobId[] = [];
  for (const j of saved) {
    if (known.has(j) && !seen.has(j)) {
      seen.add(j);
      kept.push(j);
    }
  }
  const missing = PRIORITY_ORDER.filter((j) => !seen.has(j));
  return [...kept, ...missing];
}

function migrateStep(saved: unknown): Step {
  if (saved === 'review') return 'confirm';
  if (typeof saved === 'string' && STEP_ORDER.includes(saved as Step)) {
    return saved as Step;
  }
  return 'upload';
}

const INITIAL: FlowState = {
  step: 'upload',
  rawWarnings: [],
  employees: [],
  staffing: [],
  priorityOrder: [...PRIORITY_ORDER],
  maxRoleBlock: 2,
  schedule: null,
  completedSteps: [],
};

function Flow() {
  const router = useRouter();
  const [state, setState] = useState<FlowState>(INITIAL);
  const [restoreFailed, setRestoreFailed] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FlowState;
        parsed.priorityOrder = migratePriorityOrder(parsed.priorityOrder);
        parsed.step = migrateStep(parsed.step);
        if (typeof parsed.maxRoleBlock !== 'number' || !Number.isFinite(parsed.maxRoleBlock)) {
          parsed.maxRoleBlock = 2;
        }
        if (!Array.isArray(parsed.completedSteps)) {
          parsed.completedSteps = parsed.step === 'upload' ? [] : [parsed.step];
        }
        setState(parsed);
        syncUrl(parsed.step);
      }
    } catch {
      setRestoreFailed(true);
    }
  }, []);

  useEffect(() => {
    try {
      if (state.step === 'upload') {
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      // ignore
    }
  }, [state]);

  function syncUrl(step: Step) {
    const q = new URLSearchParams(window.location.search);
    if (step === 'upload') {
      q.delete('step');
    } else {
      q.set('step', step);
    }
    const qs = q.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  function goTo(step: Step, patch: Partial<FlowState> = {}) {
    setState((s) => ({ ...s, ...patch, step }));
    syncUrl(step);
  }

  function markComplete(step: Step): Step[] {
    return state.completedSteps.includes(step)
      ? state.completedSteps
      : [...state.completedSteps, step];
  }

  function handleExtracted(rota: ExtractedRota) {
    const storeHours = storeHoursForDay(rota.dayName);
    setState({
      step: 'confirm',
      extractedDate: rota.date,
      extractedDay: rota.dayName,
      rawWarnings: rota.rawWarnings,
      employees: rota.employees,
      staffing: defaultStaffingRules(),
      priorityOrder: [...PRIORITY_ORDER],
      maxRoleBlock: 2,
      schedule: null,
      storeHours,
      completedSteps: ['upload'],
    });
    syncUrl('confirm');
  }

  function handleConfirmContinue() {
    const next = nextStepAfter('confirm')!;
    const completed = markComplete('confirm');
    setState((s) => ({ ...s, step: next, completedSteps: completed }));
    syncUrl(next);
  }

  function handleTagContinue() {
    const next = nextStepAfter('tag')!;
    const completed = markComplete('tag');
    setState((s) => ({ ...s, step: next, completedSteps: completed }));
    syncUrl(next);
  }

  function handleGenerate() {
    const storeHours = storeHoursForDay(state.extractedDay);
    const result = generateSchedule(
      {
        employees: state.employees,
        hours: TRADING_HOURS,
        staffing: state.staffing,
        priorityOrder: state.priorityOrder,
        maxRoleBlock: state.maxRoleBlock,
      },
      storeHours
    );
    const completed = Array.from(new Set([...markComplete('rules'), 'schedule'])) as Step[];
    setState((s) => ({
      ...s,
      step: 'schedule',
      schedule: result,
      storeHours,
      completedSteps: completed,
    }));
    syncUrl('schedule');
  }

  function handleReset() {
    setState(INITIAL);
    sessionStorage.removeItem(STORAGE_KEY);
    syncUrl('upload');
  }

  function handleStepClick(target: Step) {
    if (target === state.step) return;
    if (target === 'upload') return;
    if (!state.completedSteps.includes(target) && target !== state.step) return;
    goTo(target);
  }

  const currentStep: Step = state.step;
  const completedSet = new Set(state.completedSteps);

  return (
    <AppShell
      current={currentStep}
      completed={completedSet}
      onStepClick={handleStepClick}
      onReset={handleReset}
    >
      {restoreFailed && (
        <InfoAlert tone="warning" title="We couldn&apos;t restore your last session">
          Your previously uploaded rota wasn&apos;t readable, so we&apos;ve started fresh.
          Please re-upload the Schedule Editor PDF to continue.
        </InfoAlert>
      )}

      {currentStep === 'upload' && <UploadStep onExtracted={handleExtracted} />}

      {currentStep === 'confirm' && (
        <ConfirmStaffStep
          employees={state.employees}
          onChange={(employees) => setState((s) => ({ ...s, employees }))}
          extractedDate={state.extractedDate}
          rawWarnings={state.rawWarnings}
          onBack={() => goTo('upload')}
          onContinue={handleConfirmContinue}
        />
      )}

      {currentStep === 'tag' && (
        <TagRolesStep
          employees={state.employees}
          onChange={(employees) => setState((s) => ({ ...s, employees }))}
          onBack={() => goTo('confirm')}
          onContinue={handleTagContinue}
        />
      )}

      {currentStep === 'rules' && (
        <StaffingRulesStep
          rules={state.staffing}
          onChange={(staffing) => setState((s) => ({ ...s, staffing }))}
          priorityOrder={state.priorityOrder}
          onPriorityChange={(priorityOrder) => setState((s) => ({ ...s, priorityOrder }))}
          maxRoleBlock={state.maxRoleBlock}
          onMaxRoleBlockChange={(maxRoleBlock) => setState((s) => ({ ...s, maxRoleBlock }))}
          onBack={() => goTo('tag')}
          onGenerate={handleGenerate}
        />
      )}

      {currentStep === 'schedule' && state.schedule && (
        <ScheduleStep
          employees={state.employees}
          hours={TRADING_HOURS}
          slots={TRADING_SLOTS}
          result={state.schedule}
          date={state.extractedDate}
          dayName={state.extractedDay}
          storeHours={state.storeHours}
          onBack={() => goTo('rules')}
        />
      )}

      {currentStep === 'schedule' && !state.schedule && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No schedule generated. Go back to staffing rules and click Generate.
          </p>
          <Button type="button" variant="outline" onClick={() => goTo('rules')}>
            Back: Staffing rules
          </Button>
        </div>
      )}
    </AppShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <Flow />
    </Suspense>
  );
}
