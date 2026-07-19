'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/Stepper';
import { cn } from '@/lib/utils';
import type { Step } from '@/lib/flow';

interface Props {
  current: Step;
  completed: Set<Step>;
  onStepClick: (step: Step) => void;
  onReset: () => void;
  children: React.ReactNode;
}

export function AppShell({ current, completed, onStepClick, onReset, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print border-b bg-background">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex flex-col">
            <span className="text-base font-semibold tracking-[0.18em]">
              ROTA SCHEDULE
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Daily job planner
            </span>
          </div>
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
