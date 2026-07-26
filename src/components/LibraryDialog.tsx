'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Pencil, Search, Trash2 } from 'lucide-react';
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
import type { LibraryEntry } from '@/lib/storage/schema';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: LibraryEntry<unknown>[];
  onLoad: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string, date: string) => void;
  onDelete: (id: string) => void;
}

function relativeTime(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return 'just now';
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function LibraryDialog({
  open,
  onOpenChange,
  entries,
  onLoad,
  onDuplicate,
  onRename,
  onDelete,
}: Props) {
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameDate, setRenameDate] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset transient UI state when dialog closes
      setQuery('');
       
      setRenamingId(null);
       
      setDeletingId(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) || e.date.toLowerCase().includes(q)
    );
  }, [entries, query]);

  const showSearch = entries.length > 8;

  function startRename(e: LibraryEntry<unknown>) {
    setRenamingId(e.id);
    setRenameName(e.name);
    setRenameDate(e.date);
  }

  function confirmRename() {
    if (renamingId) {
      onRename(renamingId, renameName, renameDate);
      setRenamingId(null);
    }
  }

  function confirmDelete() {
    if (deletingId) {
      onDelete(deletingId);
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Open a saved rota</DialogTitle>
          <DialogDescription>
            Saved rotas live in this browser only. Use Export to move one to another PC.
          </DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No saved rotas yet. Click <span className="font-semibold">Save</span> in the header to add your first.
          </div>
        ) : (
          <>
            {showSearch && (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or date"
                  className="pl-7"
                />
              </div>
            )}
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-popover text-left text-[10px] tracking-wider text-muted-foreground uppercase">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">Name</th>
                    <th className="px-2 py-1.5 font-semibold">Date</th>
                    <th className="px-2 py-1.5 font-semibold">Saved</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const isRenaming = renamingId === e.id;
                    const isDeleting = deletingId === e.id;
                    return (
                      <tr key={e.id} className="border-t">
                        <td className="px-2 py-2 align-top">
                          {isRenaming ? (
                            <Input
                              value={renameName}
                              onChange={(ev) => setRenameName(ev.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                            />
                          ) : (
                            <div className="font-medium text-foreground">{e.name}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top">
                          {isRenaming ? (
                            <Input
                              type="date"
                              value={renameDate}
                              onChange={(ev) => setRenameDate(ev.target.value)}
                              className="h-7 text-sm"
                            />
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">{e.date}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top text-xs text-muted-foreground">
                          {relativeTime(e.savedAt)}
                        </td>
                        <td className="px-2 py-2 align-top">
                          {isRenaming ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => setRenamingId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={confirmRename}
                              >
                                Save
                              </Button>
                            </div>
                          ) : isDeleting ? (
                            <div className="flex justify-end items-center gap-1">
                              <span className="mr-1 text-[11px] text-destructive">Delete?</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => setDeletingId(null)}
                              >
                                No
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-xs"
                                onClick={confirmDelete}
                              >
                                Yes
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-0.5">
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  onLoad(e.id);
                                  onOpenChange(false);
                                }}
                              >
                                Load
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                title="Copy into draft as new working copy"
                                onClick={() => {
                                  onDuplicate(e.id);
                                  onOpenChange(false);
                                }}
                              >
                                <Copy className="size-3" aria-hidden />
                                <span className="sr-only">Duplicate</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                title="Rename"
                                onClick={() => startRename(e)}
                              >
                                <Pencil className="size-3" aria-hidden />
                                <span className="sr-only">Rename</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/5"
                                title="Delete"
                                onClick={() => setDeletingId(e.id)}
                              >
                                <Trash2 className="size-3" aria-hidden />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-6 text-center text-xs text-muted-foreground">
                        No rotas match &ldquo;{query}&rdquo;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
