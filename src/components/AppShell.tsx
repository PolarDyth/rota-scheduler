'use client';

import { FolderOpen, Upload, Download, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/Stepper';
import { AutosaveIndicator } from '@/components/AutosaveIndicator';
import { cn } from '@/lib/utils';
import type { Step } from '@/lib/flow';
import type { SaveStatus } from '@/app/page';

interface Props {
  current: Step;
  completed: Set<Step>;
  onStepClick: (step: Step) => void;
  onReset: () => void;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  canSave: boolean;
  canExport: boolean;
  onOpenLibrary: () => void;
  onSaveToLibrary: () => void;
  onImport: () => void;
  onExport: () => void;
  children: React.ReactNode;
}

export function AppShell({
  current,
  completed,
  onStepClick,
  onReset,
  saveStatus,
  lastSavedAt,
  canSave,
  canExport,
  onOpenLibrary,
  onSaveToLibrary,
  onImport,
  onExport,
  children,
}: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print border-b bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-[0.18em]">
              ROTA SCHEDULE
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Daily job planner
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <AutosaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onOpenLibrary}
                className="text-muted-foreground"
                title="Open a saved rota"
              >
                <FolderOpen className="size-3.5" aria-hidden />
                Open
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSaveToLibrary}
                disabled={!canSave}
                className="text-muted-foreground"
                title="Save current rota with a name"
              >
                <Save className="size-3.5" aria-hidden />
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onImport}
                className="text-muted-foreground"
                title="Import a rota from a .json file"
              >
                <Upload className="size-3.5" aria-hidden />
                Import
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onExport}
                disabled={!canExport}
                className="text-muted-foreground"
                title="Download current rota as a .json file"
              >
                <Download className="size-3.5" aria-hidden />
                Export
              </Button>
              {current !== 'upload' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  className="text-muted-foreground"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Start over
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {current !== 'upload' && (
        <div className="no-print border-b bg-background">
          <div className="mx-auto w-full max-w-5xl px-4">
            <Stepper current={current} completed={completed} onStepClick={onStepClick} />
          </div>
        </div>
      )}

      <main className={cn('mx-auto w-full max-w-5xl flex-1 px-4 py-8')}>{children}</main>
    </div>
  );
}
