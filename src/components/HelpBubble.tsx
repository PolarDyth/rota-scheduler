'use client';

import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  label?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function HelpBubble({ label, children, className, size = 'md' }: Props) {
  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4';
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={label ? `Help: ${label}` : 'More information'}
            className={cn(
              'inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-none',
              className
            )}
          />
        }
      >
        <HelpCircle className={iconSize} aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-80 max-w-[calc(100vw-2rem)] text-sm leading-relaxed"
      >
        {label && (
          <p className="mb-1 font-medium text-foreground">{label}</p>
        )}
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
