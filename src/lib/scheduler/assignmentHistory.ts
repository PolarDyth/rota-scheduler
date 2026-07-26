import type { Employee, Hour, JobId } from '../types';

export const HISTORY_LEN = 6;

export function orderByLeastRecent(
  candidates: Employee[],
  job: JobId,
  history: Map<string, JobId[]>,
  hour: Hour
): Employee[] {
  const indexed = candidates.map((emp, originalIdx) => ({ emp, originalIdx }));
  indexed.sort((a, b) => {
    const sa = scoreFor(a.emp.id, job, history);
    const sb = scoreFor(b.emp.id, job, history);
    if (sb !== sa) return sb - sa;
    const ta = (history.get(a.emp.id) ?? []).length;
    const tb = (history.get(b.emp.id) ?? []).length;
    if (ta !== tb) return ta - tb;
    const ra = (a.originalIdx + hour) % candidates.length;
    const rb = (b.originalIdx + hour) % candidates.length;
    return ra - rb;
  });
  return indexed.map((x) => x.emp);
}

export function scoreFor(empId: string, job: JobId, history: Map<string, JobId[]>): number {
  const h = history.get(empId) ?? [];
  if (h.length === 0) return 1000;
  if (h[0] === job) return 2000;
  const idx = h.indexOf(job);
  return idx === -1 ? 1000 : h.length - idx;
}

export function wouldExceedMaxBlock(
  empId: string,
  job: JobId,
  history: Map<string, JobId[]>,
  maxBlock: number
): boolean {
  if (maxBlock <= 0) return false;
  const h = history.get(empId) ?? [];
  if (h.length === 0 || h[0] !== job) return false;
  let count = 1;
  for (let i = 1; i < h.length; i++) {
    if (h[i] === job) count++;
    else break;
  }
  return count + 1 > maxBlock;
}
