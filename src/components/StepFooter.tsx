'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  onBack?: () => void;
  onContinue?: () => void;
  backLabel?: string;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueHint?: string;
  className?: string;
}

export function StepFooter({
  onBack,
  onContinue,
  backLabel = 'Back',
  continueLabel = 'Continue',
  continueDisabled,
  continueHint,
  className,
}: Props) {
  return (
    <div className={cn('no-print flex items-center justify-between gap-3 pt-4', className)}>
      <div className="flex-1">
        {onBack && (
          <Button type="button" variant="ghost" onClick={onBack}>
            <ChevronLeft className="size-4" aria-hidden />
            {backLabel}
          </Button>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled}
          size="lg"
        >
          {continueLabel}
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        {continueHint && (
          <span className="text-xs text-muted-foreground">{continueHint}</span>
        )}
      </div>
    </div>
  );
}
