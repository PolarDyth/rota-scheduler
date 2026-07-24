import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractRota } from '../src/lib/pdf/extractRota';
import { generateSchedule } from '../src/lib/scheduler/generateSchedule';
import { TRADING_HOURS, defaultStaffingRules } from '../src/lib/scheduler/jobs';
import { storeHoursForDay } from '../src/lib/scheduler/storeHours';

const FILES = [
  'Sample Rota - Understaffed.pdf',
  'Sample Rota - Overstaffed.pdf',
  'Sample Rota - Break Heavy.pdf',
];

async function main() {
  for (const f of FILES) {
    const bytes = readFileSync(resolve(process.cwd(), f));
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const rota = await extractRota(ab);
    const result = generateSchedule(
      { employees: rota.employees, hours: TRADING_HOURS, staffing: defaultStaffingRules() },
      storeHoursForDay(rota.dayName)
    );

    console.log(`\n=== ${f} ===`);
    console.log(`  Date: ${rota.date}  Day: ${rota.dayName}`);
    console.log(`  Staff: ${rota.employees.length}  Parse warnings: ${rota.rawWarnings.length}`);
    const specialised = rota.employees.filter((e) => e.specialisedRole);
    console.log(`  Specialised: ${specialised.length} (${specialised.map((e) => e.specialisedRole).join(', ')})`);

    const grouped = new Map<string, number>();
    for (const w of result.warnings) grouped.set(w.kind, (grouped.get(w.kind) ?? 0) + 1);
    console.log(`  Schedule warnings (${result.warnings.length}):`);
    for (const [k, v] of grouped) console.log(`    ${k}: ${v}`);

    // Per-hour coverage
    const coverage: string[] = [];
    for (const h of TRADING_HOURS) {
      const onShift = rota.employees.filter((e) => {
        const s = parseInt(e.shiftStart.split(':')[0], 10);
        const e2 = parseInt(e.shiftEnd.split(':')[0], 10);
        return h >= s && h < e2;
      }).length;
      coverage.push(`${String(h).padStart(2, '0')}h=${onShift}`);
    }
    console.log(`  Coverage by hour:`);
    console.log(`    ${coverage.slice(0, 8).join('  ')}`);
    console.log(`    ${coverage.slice(8).join('  ')}`);
  }
}
main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
