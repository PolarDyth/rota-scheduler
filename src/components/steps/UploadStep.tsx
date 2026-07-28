'use client';

import { useRef, useState } from 'react';
import { UploadCloud, FileText, Loader2 } from 'lucide-react';
import type { ExtractedRota } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { InfoAlert } from '@/components/InfoAlert';
import { cn } from '@/lib/utils';

const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  onExtracted: (rota: ExtractedRota) => void;
}

export function UploadStep({ onExtracted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validateFile(file: File | undefined | null): file is File {
    if (!file) {
      setError('Please choose a PDF first.');
      return false;
    }
    if (file.size > MAX_BYTES) {
      setError('That file is too large. Please upload a PDF under 10 MB.');
      return false;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Expected a PDF file.');
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateFile(selectedFile)) return;

    setPending(true);
    setError(null);
    try {
      const { extractRota } = await import('@/lib/pdf/extractRota');
      const result = await extractRota(selectedFile);
      onExtracted(result);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(`The PDF could not be read (${detail}).`);
    } finally {
      setPending(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setError(null);
    setSelectedFile(file);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Upload today&apos;s rota</CardTitle>
          <CardDescription>
            Export the Schedule Editor PDF from the store system, then drag it below or click to browse. Staff names and shift times will be extracted automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <label
              htmlFor="pdf-file"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOver(false);
              }}
              onDrop={handleDrop}
              className={cn(
                'flex min-w-0 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed bg-muted/50 p-10 text-center transition-colors hover:border-accent hover:bg-muted',
                dragOver ? 'border-accent bg-accent/5' : 'border-border'
              )}
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-accent">
                <UploadCloud className="size-6" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col items-center gap-1">
                <span className="text-sm font-medium">
                  {selectedFile ? 'Choose a different file' : 'Click to choose a PDF or drag it here'}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">
                    {selectedFile?.name ?? 'Schedule Editor export'}
                  </span>
                </span>
              </span>
              <input
                id="pdf-file"
                ref={inputRef}
                type="file"
                name="pdf"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setError(null);
                  setSelectedFile(f ?? null);
                }}
              />
            </label>

            {error && (
              <InfoAlert tone="error" title="This file could not be read">
                {error}
              </InfoAlert>
            )}

            <Button
              type="submit"
              disabled={pending}
              size="lg"
              className="w-full"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Extracting rota…
                </>
              ) : (
                'Extract rota'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
