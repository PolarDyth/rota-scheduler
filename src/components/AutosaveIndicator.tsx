'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import type { SaveStatus } from '@/app/page';
import { cn } from '@/lib/utils';

interface Props {
  status: SaveStatus;
  lastSavedAt: number | null;
}

function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, Math.floor((now - ts) / 1000));
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function AutosaveIndicator({ status, lastSavedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status === 'saving') return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [status]);

  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <span
        className="no-print inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span
        className="no-print inline-flex items-center gap-1.5 text-xs text-destructive"
        role="status"
        aria-live="polite"
        title="Couldn't save to browser storage — it may be full."
      >
        <AlertTriangle className="size-3" aria-hidden />
        Save failed
      </span>
    );
  }

  return (
    <span
      className="no-print inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Check className="size-3 text-accent" aria-hidden />
      <span className={cn('tabular-nums')}>
        Saved{lastSavedAt ? ` ${relativeTime(lastSavedAt, now)}` : ''}
      </span>
    </span>
  );
}
