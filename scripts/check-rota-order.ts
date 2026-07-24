import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractRota } from '../src/lib/pdf/extractRota';

const FILES = [
  'Sample Rota.pdf',
  'Sample Rota - Understaffed.pdf',
  'Sample Rota - Overstaffed.pdf',
  'Sample Rota - Break Heavy.pdf',
];

async function main() {
  for (const f of FILES) {
    const bytes = readFileSync(resolve(process.cwd(), f));
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const rota = await extractRota(ab);
    console.log(`\n=== ${f} ===`);
    let prev = '';
    let ok = true;
    for (const e of rota.employees) {
      const flag = prev && e.shiftStart < prev ? '  <-- OUT OF ORDER' : '';
      if (flag) ok = false;
      console.log(`  ${e.shiftStart}-${e.shiftEnd}  ${e.name}${flag}`);
      prev = e.shiftStart;
    }
    console.log(ok ? 'ORDER OK' : 'ORDER BROKEN');
  }
}
main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
