'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { JOBS } from '@/lib/scheduler/jobs';
import type { JobId } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  order: JobId[];
  onChange: (next: JobId[]) => void;
}

export function PriorityOrderEditor({ order, onChange }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <p className="mb-2 text-xs text-muted-foreground">
        Drag to reorder, or use the arrows. Jobs higher on the list fill first when there
        aren&apos;t enough people.
      </p>
      {order.map((job, i) => {
        const meta = JOBS[job];
        const isDragging = dragIndex === i;
        const isOver = overIndex === i && dragIndex !== null && dragIndex !== i;
        return (
          <div
            key={job}
            draggable
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (overIndex !== i) setOverIndex(i);
            }}
            onDragLeave={() => {
              if (overIndex === i) setOverIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
              setOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={cn(
              'flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm transition-colors',
              isDragging && 'opacity-40',
              isOver && 'border-accent bg-secondary'
            )}
          >
            <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="w-5 text-center font-mono text-xs text-muted-foreground">
              {i + 1}
            </span>
            <span
              className="inline-block size-3 shrink-0 rounded-sm border border-border"
              style={{ background: meta.colour }}
              aria-hidden
            />
            <span className="font-medium">{meta.label}</span>
            {meta.specialised && (
              <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent">
                specialist
              </Badge>
            )}
            <div className="ml-auto flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label={`Move ${meta.label} up`}
              >
                <ArrowUp className="size-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => move(i, i + 1)}
                disabled={i === order.length - 1}
                aria-label={`Move ${meta.label} down`}
              >
                <ArrowDown className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
