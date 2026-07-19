'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const infoAlertVariants = cva(
  'relative grid w-full gap-1 rounded-md border p-3 text-left text-sm',
  {
    variants: {
      tone: {
        info: 'border-border bg-secondary/60 text-foreground',
        warning: 'border-accent/40 bg-secondary text-foreground',
        error: 'border-destructive/40 bg-destructive/5 text-foreground',
        success: 'border-accent/40 bg-accent/5 text-foreground',
      },
    },
    defaultVariants: { tone: 'info' },
  }
);

interface Props
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof infoAlertVariants> {
  title?: string;
  icon?: React.ReactNode;
}

export function InfoAlert({ title, icon, tone, className, children, ...props }: Props) {
  return (
    <div role="note" className={cn(infoAlertVariants({ tone }), className)} {...props}>
      <div className="flex items-start gap-2.5">
        {icon && <span className="mt-0.5 shrink-0 text-accent">{icon}</span>}
        <div className="space-y-0.5">
          {title && <div className="text-sm font-semibold">{title}</div>}
          {children && <div className="text-sm text-muted-foreground">{children}</div>}
        </div>
      </div>
    </div>
  );
}
