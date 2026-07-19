'use client';

import { useActionState, useRef, useState } from 'react';
import { UploadCloud, FileText, Loader2 } from 'lucide-react';
import { uploadPdf } from '@/app/actions/uploadPdf';
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

interface Props {
  onExtracted: (rota: ExtractedRota) => void;
}

export function UploadStep({ onExtracted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [state, action, pending] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await uploadPdf(formData);
      if ('error' in result) {
        return { error: result.error };
      }
      onExtracted(result);
      return null;
    },
    null
  );

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
          <form action={action} className="space-y-5">
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

            {state?.error && (
              <InfoAlert tone="error" title="We couldn&apos;t read that file">
                {state.error}. Please check it&apos;s a PDF exported from Schedule Editor and
                try again.
              </InfoAlert>
            )}

            <Button type="submit" disabled={pending} size="lg" className="w-full">
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
