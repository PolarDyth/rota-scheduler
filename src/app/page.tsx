'use client';

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from 'next/navigation';
import type {
  Employee,
  ExtractedRota,
  JobId,
  ScheduleResult,
  Slot,
  StaffingRule,
  StoreHours,
} from '@/lib/types';
import { generateSchedule } from '@/lib/scheduler/generateSchedule';
import { moveBreak, swapWorkBlocks, type BlockRef } from '@/lib/scheduler/swapBlock';
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
import {
  clearDraft,
  deleteLibraryEntry,
  duplicateLibraryEntryToDraft,
  exportRota,
  importRota,
  loadDraft,
  loadLibraryEntry,
  listLibrary,
  renameLibraryEntry,
  saveDraft,
  saveToLibrary,
} from '@/lib/storage/storage';
import { migrateV1IfNeeded } from '@/lib/storage/migrate';
import type { LibraryEntry } from '@/lib/storage/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SaveRotaDialog } from '@/components/SaveRotaDialog';
import { LibraryDialog } from '@/components/LibraryDialog';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Feedback =
  | { tone: 'warning' | 'error' | 'success'; title: string; message: string }
  | null;

type PendingReplace =
  | { kind: 'load'; id: string; name: string }
  | { kind: 'import'; state: FlowState; warning?: string }
  | null;

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'rota';
}

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
  scheduleManuallyEdited: boolean;
  storeHours?: StoreHours;
  completedSteps: Step[];
}

const AUTOSAVE_DEBOUNCE_MS = 300;

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
  scheduleManuallyEdited: false,
  completedSteps: [],
};

function Flow() {
  const router = useRouter();
  const [state, setState] = useState<FlowState>(INITIAL);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry<unknown>[]>([]);
  const [pendingReplace, setPendingReplace] = useState<PendingReplace>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      migrateV1IfNeeded();
      const draft = loadDraft<FlowState>();
      if (draft) {
        const parsed = { ...INITIAL, ...draft.state };
        parsed.priorityOrder = migratePriorityOrder(parsed.priorityOrder);
        parsed.step = migrateStep(parsed.step);
        if (typeof parsed.maxRoleBlock !== 'number' || !Number.isFinite(parsed.maxRoleBlock)) {
          parsed.maxRoleBlock = 2;
        }
        if (!Array.isArray(parsed.completedSteps)) {
          parsed.completedSteps = parsed.step === 'upload' ? [] : [parsed.step];
        }
        if (typeof parsed.scheduleManuallyEdited !== 'boolean') {
          parsed.scheduleManuallyEdited = false;
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot restore from localStorage on mount
        setState(parsed);
         
        setLastSavedAt(draft.savedAt);
        syncUrl(parsed.step);
      }
    } catch {
       
      setRestoreFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only restore; syncUrl identity is unstable but the call is one-shot
  }, []);

  useEffect(() => {
    if (state.step === 'upload' && state.employees.length === 0) {
      clearDraft();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync autosave status to UI
      setSaveStatus('idle');
      return;
    }
     
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const result = saveDraft(state);
      if (result.ok) {
         
        setSaveStatus('saved');
         
        setLastSavedAt(Date.now());
      } else {
         
        setSaveStatus('error');
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  function showFeedback(f: NonNullable<Feedback>) {
    setFeedback(f);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 6000);
  }

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
      scheduleManuallyEdited: false,
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
      scheduleManuallyEdited: false,
      storeHours,
      completedSteps: completed,
    }));
    syncUrl('schedule');
  }

  function handleEditBlock(empId: string, startSlot: Slot, length: number, newJob: JobId) {
    setState((s) => {
      if (!s.schedule) return s;
      const schedule = structuredClone(s.schedule.schedule);
      const row = { ...(schedule[empId] ?? {}) };
      for (let i = 0; i < length; i++) {
        const slot = startSlot + i * 15;
        row[slot] = newJob;
      }
      schedule[empId] = row;
      return {
        ...s,
        schedule: { ...s.schedule, schedule },
        scheduleManuallyEdited: true,
      };
    });
  }

  function handleSwapBlocks(source: BlockRef, target: BlockRef) {
    setState((s) => {
      if (!s.schedule) return s;
      const schedule = swapWorkBlocks(s.schedule.schedule, source, target);
      return {
        ...s,
        schedule: { ...s.schedule, schedule },
        scheduleManuallyEdited: true,
      };
    });
  }

  function handleMoveBreak(empId: string, oldStart: Slot, newStart: Slot) {
    setState((s) => {
      if (!s.schedule) return s;
      const result = moveBreak(s.schedule.schedule, s.employees, empId, oldStart, newStart);
      if (!result.moved) return s;
      // Merge new warnings: drop prior breakShifted for same employee+hour, then append new ones.
      const existing = s.schedule.warnings.filter(
        (w) =>
          !(
            w.kind === 'breakShifted' &&
            w.hour === result.warnings[0]?.hour &&
            w.employeeIds?.[0] === empId
          )
      );
      return {
        ...s,
        schedule: {
          ...s.schedule,
          schedule: result.schedule,
          warnings: [...existing, ...result.warnings],
        },
        scheduleManuallyEdited: true,
      };
    });
  }

  function handleReset() {
    setState(INITIAL);
    clearDraft();
    setLastSavedAt(null);
    setSaveStatus('idle');
    syncUrl('upload');
  }

  function applyLoadedState(loaded: FlowState, sourceLabel: string) {
    const next = { ...INITIAL, ...loaded };
    next.priorityOrder = migratePriorityOrder(next.priorityOrder);
    next.step = migrateStep(next.step);
    if (typeof next.maxRoleBlock !== 'number' || !Number.isFinite(next.maxRoleBlock)) {
      next.maxRoleBlock = 2;
    }
    if (!Array.isArray(next.completedSteps)) {
      next.completedSteps = next.step === 'upload' ? [] : [next.step];
    }
    if (typeof next.scheduleManuallyEdited !== 'boolean') {
      next.scheduleManuallyEdited = false;
    }
    setState(next);
    setLastSavedAt(Date.now());
    setSaveStatus('saved');
    syncUrl(next.step);
    showFeedback({
      tone: 'success',
      title: `${sourceLabel} loaded`,
      message: 'You can keep editing — changes save automatically.',
    });
  }

  function hasUnsavedWork(s: FlowState): boolean {
    return s.employees.length > 0 || s.schedule !== null;
  }

  function handleOpenLibrary() {
    setLibraryEntries(listLibrary());
    setLibraryDialogOpen(true);
  }

  function handleSaveToLibraryOpen() {
    setSaveDialogOpen(true);
  }

  function handleSaveToLibraryConfirm(name: string, date: string) {
    const result = saveToLibrary(name, date, state);
    if (result.ok) {
      setLibraryEntries(listLibrary());
      showFeedback({
        tone: 'success',
        title: 'Saved to library',
        message: `"${name}" is now in your saved rotas on this browser.`,
      });
    } else {
      showFeedback({
        tone: 'error',
        title: "Couldn't save",
        message: 'Browser storage is full. Try deleting older saved rotas.',
      });
    }
  }

  function handleLoadRequest(id: string) {
    const entry = listLibrary().find((e) => e.id === id);
    if (!entry) return;
    if (hasUnsavedWork(state)) {
      setPendingReplace({ kind: 'load', id, name: entry.name });
    } else {
      const loaded = loadLibraryEntry<FlowState>(id);
      if (loaded) applyLoadedState(loaded, `"${entry.name}"`);
    }
  }

  function handleDuplicate(id: string) {
    if (!duplicateLibraryEntryToDraft(id)) return;
    const draft = loadDraft<FlowState>();
    if (draft) applyLoadedState(draft.state, 'Duplicated rota');
  }

  function handleRename(id: string, name: string, date: string) {
    renameLibraryEntry(id, name, date);
    setLibraryEntries(listLibrary());
  }

  function handleDelete(id: string) {
    deleteLibraryEntry(id);
    setLibraryEntries(listLibrary());
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      showFeedback({
        tone: 'error',
        title: 'Could not read file',
        message: 'Try again with a different .json file.',
      });
      return;
    }
    const result = importRota<FlowState>(text);
    if (result.error) {
      showFeedback({ tone: 'error', title: 'Import failed', message: result.error });
      return;
    }
    if (!result.state) return;
    if (hasUnsavedWork(state)) {
      setPendingReplace({
        kind: 'import',
        state: result.state,
        warning: result.warning,
      });
    } else {
      applyLoadedState(result.state, 'Imported rota');
      if (result.warning) {
        showFeedback({ tone: 'warning', title: 'Imported with warning', message: result.warning });
      }
    }
  }

  function handleExport() {
    const payload = exportRota(state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = state.extractedDate || todayIso();
    const name = slugify(state.extractedDay || 'rota');
    a.download = `rota-${date}-${name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback({
      tone: 'success',
      title: 'Exported',
      message: `Saved "${a.download}" to your downloads.`,
    });
  }

  function confirmPendingReplace() {
    if (!pendingReplace) return;
    if (pendingReplace.kind === 'load') {
      const loaded = loadLibraryEntry<FlowState>(pendingReplace.id);
      if (loaded) applyLoadedState(loaded, `"${pendingReplace.name}"`);
    } else {
      applyLoadedState(pendingReplace.state, 'Imported rota');
      if (pendingReplace.warning) {
        showFeedback({ tone: 'warning', title: 'Imported with warning', message: pendingReplace.warning });
      }
    }
    setPendingReplace(null);
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
      saveStatus={saveStatus}
      lastSavedAt={lastSavedAt}
      canSave={state.employees.length > 0 || state.schedule !== null}
      canExport={state.employees.length > 0 || state.schedule !== null}
      onOpenLibrary={handleOpenLibrary}
      onSaveToLibrary={handleSaveToLibraryOpen}
      onImport={handleImportClick}
      onExport={handleExport}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileSelected}
      />

      {feedback && (
        <div className="mb-4">
          <InfoAlert tone={feedback.tone} title={feedback.title}>
            {feedback.message}
          </InfoAlert>
        </div>
      )}

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
          manuallyEdited={state.scheduleManuallyEdited}
          onEditBlock={handleEditBlock}
          onSwapBlocks={handleSwapBlocks}
          onMoveBreak={handleMoveBreak}
          onRegenerate={handleGenerate}
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

      <SaveRotaDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultDate={state.extractedDate || ''}
        onSave={handleSaveToLibraryConfirm}
      />

      <LibraryDialog
        open={libraryDialogOpen}
        onOpenChange={setLibraryDialogOpen}
        entries={libraryEntries}
        onLoad={handleLoadRequest}
        onDuplicate={handleDuplicate}
        onRename={handleRename}
        onDelete={handleDelete}
      />

      <Dialog
        open={pendingReplace !== null}
        onOpenChange={(o) => {
          if (!o) setPendingReplace(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Replace current draft?</DialogTitle>
            <DialogDescription>
              {pendingReplace?.kind === 'load' && (
                <>Loading &ldquo;{pendingReplace.name}&rdquo; will overwrite the rota you&apos;re currently editing. This cannot be undone.</>
              )}
              {pendingReplace?.kind === 'import' && (
                <>Importing will overwrite the rota you&apos;re currently editing. This cannot be undone.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingReplace(null)}>
              Cancel
            </Button>
            <Button onClick={confirmPendingReplace}>Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
