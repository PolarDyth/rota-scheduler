import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractRota } from '../src/lib/pdf/extractRota';

async function main() {
  const pdfPath = resolve(process.cwd(), 'Schedule Editor.pdf');
  const bytes = readFileSync(pdfPath);
  const result = await extractRota(bytes.buffer as ArrayBuffer);

  console.log('Date:', result.date, 'Day:', result.dayName);
  console.log('Employees:', result.employees.length);
  console.log('Warnings:', result.rawWarnings.length);
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
      `  ${e.name.padEnd(28)} ${e.shiftStart}-${e.shiftEnd}  breaks: ${brk}${role}${tags}`
    );
  }
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
