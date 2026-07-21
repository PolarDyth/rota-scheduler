'use server';

import { headers } from 'next/headers';
import { extractRota } from '@/lib/pdf/extractRota';
import type { ExtractedRota } from '@/lib/types';

const MAX_BYTES = 10 * 1024 * 1024;
const PARSE_TIMEOUT_MS = 15_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const rateBuckets = new Map<string, number[]>();

async function clientKey(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    return h.get('x-real-ip') ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = (rateBuckets.get(key) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateBuckets.set(key, arr);
    return true;
  }
  arr.push(now);
  rateBuckets.set(key, arr);
  return false;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const e = new Error('PDF parse timed out');
      e.name = 'TimeoutError';
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function uploadPdf(
  formData: FormData
): Promise<ExtractedRota | { error: string }> {
  const ipKey = await clientKey();
  if (isRateLimited(ipKey)) {
    return { error: 'Too many uploads. Please wait a minute and try again.' };
  }

  const file = formData.get('pdf');
  if (!(file instanceof File)) {
    return { error: 'No file uploaded.' };
  }
  if (file.size > MAX_BYTES) {
    return { error: 'That file is too large. Please upload a PDF under 10 MB.' };
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { error: 'Expected a PDF file.' };
  }

  try {
    return await withTimeout(extractRota(file), PARSE_TIMEOUT_MS);
  } catch (err) {
    console.error('uploadPdf failed:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return {
      error:
        err instanceof Error && err.name === 'TimeoutError'
          ? 'The PDF took too long to read. Please try a smaller or simpler file.'
          : `We could not read that PDF (${detail}). Please check it is exported from Schedule Editor.`,
    };
  }
}
