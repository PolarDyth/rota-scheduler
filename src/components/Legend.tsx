import { JOBS } from '@/lib/scheduler/jobs';
import type { JobId } from '@/lib/types';

const ORDER: JobId[] = [
  'tills',
  'hosting',
  'clickCollect',
  'repro',
  'standards',
  'delivery',
  'fittingMens',
  'fittingWomens',
  'lingerie',
  'bureau',
  'vm',
  'isf',
  'break',
  'off',
];

export function Legend() {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {ORDER.map((id) => (
        <span
          key={id}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1"
          style={{ background: JOBS[id].colour }}
        >
          <span className="font-medium text-foreground">{JOBS[id].label}</span>
        </span>
      ))}
    </div>
  );
}
