'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  onSave: (name: string, date: string) => void;
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function SaveRotaDialog({ open, onOpenChange, defaultDate, onSave }: Props) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(defaultDate || todayIso());

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form when dialog opens
      setName('');
       
      setDate(defaultDate || todayIso());
    }
  }, [open, defaultDate]);

  function submit() {
    const trimmed = name.trim();
    onSave(trimmed || 'Untitled', date || todayIso());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Save current rota</DialogTitle>
          <DialogDescription>
            Saves a snapshot of the current rota to this browser. Use Export to move it to another PC.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rota-name">Name</Label>
            <Input
              id="rota-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Saturday trade"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rota-date">Date</Label>
            <Input
              id="rota-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
