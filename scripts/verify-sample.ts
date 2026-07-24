import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractRota } from '../src/lib/pdf/extractRota';

async function main() {
  const target = process.argv[2] ?? 'Sample Rota.pdf';
  const bytes = readFileSync(resolve(process.cwd(), target));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const result = await extractRota(buffer);

  console.log(`File: ${target}`);
  console.log(`Date: ${result.date}  Day: ${result.dayName}`);
  console.log(`Employees: ${result.employees.length}`);
  console.log(`Warnings: ${result.rawWarnings.length}`);
  if (result.rawWarnings.length) {
    console.log('--- warnings ---');
    for (const w of result.rawWarnings) console.log('  -', w);
  }
  console.log('--- employees ---');
  for (const e of result.employees) {
    const brk = e.breaks.map((b) => `${b.start}-${b.end}`).join(', ') || '(no break)';
    const role = e.specialisedRole ? ` [${e.specialisedRole}]` : '';
    const tags = e.pdfTags.length ? ` tags: ${e.pdfTags.join('; ')}` : '';
    console.log(
      `  ${e.name.padEnd(24)} ${e.shiftStart}-${e.shiftEnd}  breaks: ${brk}${role}${tags}`
    );
  }
}
main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
