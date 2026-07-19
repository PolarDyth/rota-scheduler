import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractRota } from '../src/lib/pdf/extractRota';
import { generateSchedule } from '../src/lib/scheduler/generateSchedule';
import { TRADING_HOURS, TRADING_SLOTS, JOBS, formatSlot, defaultStaffingRules } from '../src/lib/scheduler/jobs';
import { storeHoursForDay } from '../src/lib/scheduler/storeHours';

async function main() {
  const pdfPath = resolve(process.cwd(), 'Schedule Editor.pdf');
  const bytes = readFileSync(pdfPath);
  const rota = await extractRota(bytes.buffer as ArrayBuffer);

  const tagged = rota.employees.map((e, i) => {
    if (i === 0) return { ...e, department: 'menswear' as const };
    if (i === 1) return { ...e, department: 'womenswear' as const };
    return e;
  });

  const result = generateSchedule(
    {
      employees: tagged,
      hours: TRADING_HOURS,
      staffing: defaultStaffingRules(),
    },
    storeHoursForDay(rota.dayName)
  );

  console.log('Schedule generated.', 'Store hours:', JSON.stringify(storeHoursForDay(rota.dayName)));
  console.log(`Warnings: ${result.warnings.length}`);
  const grouped = new Map<string, number>();
  for (const w of result.warnings) {
    grouped.set(w.kind, (grouped.get(w.kind) ?? 0) + 1);
  }
  for (const [k, v] of grouped) console.log(`  ${k}: ${v}`);

  console.log('--- sample warnings ---');
  for (const w of result.warnings.slice(0, 8)) {
    console.log(`  ${String(w.hour).padStart(2)}h [${w.kind}] ${w.message}`);
  }

  console.log('--- full schedules (first 4 employees) ---');
  const focus = ['Bennett, Kim', 'Dunn, Karen', ...tagged.slice(0, 2).map(e => e.name)];
  for (const name of focus) {
    const e = tagged.find(t => t.name === name);
    if (!e) continue;
    const row = result.schedule[e.id] ?? {};
    const segments: string[] = [];
    let prev: string | null = null;
    let runStart: number | null = null;
    for (const slot of TRADING_SLOTS) {
      const job = row[slot];
      const label = job ? JOBS[job].short : '·';
      if (label !== prev) {
        if (prev !== null && runStart !== null) {
          segments.push(`${formatSlot(runStart)}+${prev}`);
        }
        prev = label;
        runStart = slot;
      }
    }
    if (prev !== null && runStart !== null) segments.push(`${formatSlot(runStart)}+${prev}`);
    console.log(`  ${e.name.padEnd(24)} ${segments.join('  ')}`);
  }

  let hourTransitions = 0;
  let sameJobHours = 0;
  for (const e of tagged) {
    const row = result.schedule[e.id] ?? {};
    let prev: string | null = null;
    for (const h of TRADING_HOURS) {
      const slot = h * 60;
      const job = row[slot];
      if (!job || job === 'break' || job === 'off') {
        prev = null;
        continue;
      }
      if (job === prev) sameJobHours++;
      else hourTransitions++;
      prev = job;
    }
  }
  console.log(`Hour-to-hour: ${hourTransitions} transitions, ${sameJobHours} repeats`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
