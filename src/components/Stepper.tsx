'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STEPS, type Step, stepIndex } from '@/lib/flow';

interface Props {
  current: Step;
  completed: Set<Step>;
  onStepClick: (step: Step) => void;
}

export function Stepper({ current, completed, onStepClick }: Props) {
  const currentIdx = stepIndex(current);

  return (
    <nav aria-label="Progress" className="no-print w-full overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2 py-4">
        {STEPS.map((step, idx) => {
          const isCurrent = step.id === current;
          const isComplete = completed.has(step.id);
          const isPast = idx < currentIdx;
          const reachable = isComplete || isCurrent || isPast;
          const clickable = reachable && !isCurrent;

          return (
            <li key={step.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(step.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'group flex items-center gap-2 px-2 py-1 text-left transition-colors',
                  clickable && 'cursor-pointer hover:opacity-80',
                  !reachable && 'cursor-not-allowed opacity-50'
                )}
              >
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center border text-xs font-semibold transition-colors',
                    isCurrent && 'border-accent bg-accent text-accent-foreground',
                    isComplete && !isCurrent && 'border-accent bg-accent text-accent-foreground',
                    isPast && !isComplete && 'border-foreground bg-foreground text-background',
                    !reachable && 'border-border bg-background text-muted-foreground'
                  )}
                >
                  {isComplete && !isCurrent ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium whitespace-nowrap',
                    isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.short}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <span
                  className={cn(
                    'h-px w-6 shrink-0 transition-colors md:w-10',
                    idx < currentIdx ? 'bg-accent' : 'bg-border'
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
