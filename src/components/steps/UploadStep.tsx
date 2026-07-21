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

const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  onExtracted: (rota: ExtractedRota) => void;
}

export function UploadStep({ onExtracted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Please choose a PDF first.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That file is too large. Please upload a PDF under 10 MB.');
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Expected a PDF file.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const { extractRota } = await import('@/lib/pdf/extractRota');
      const result = await extractRota(file);
      onExtracted(result);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(`We could not read that PDF (${detail}).`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Upload today&apos;s rota</CardTitle>
          <CardDescription>
            Export the Schedule Editor PDF from your store system, then choose it below.
            We&apos;ll read who&apos;s working and what their shifts are.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <label
              htmlFor="pdf-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border bg-muted/50 p-10 text-center transition-colors hover:border-accent hover:bg-muted"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-accent">
                <UploadCloud className="size-6" aria-hidden />
              </span>
              <span className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium">
                  {fileName ? 'Choose a different file' : 'Click to choose a PDF'}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="size-3.5" aria-hidden />
                  {fileName ?? 'Schedule Editor export'}
                </span>
              </span>
              <input
                id="pdf-file"
                ref={inputRef}
                type="file"
                name="pdf"
                accept="application/pdf,.pdf"
                required
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFileName(f?.name ?? null);
                }}
              />
            </label>

            {error && (
              <InfoAlert tone="error" title="We couldn&apos;t read that file">
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
