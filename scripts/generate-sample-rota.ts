import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

interface Break { start: string; end: string; }
interface SampleEmployee {
  name: string;
  shiftStart: string;
  shiftEnd: string;
  breaks: Break[];
  tag: string;
  tagInHour: number;
}

const ROSTER: SampleEmployee[] = [
  { name: 'Abernathy, Iris',    shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '10:00', end: '10:30' }], tag: 'Bra Fit',                tagInHour: 10 },
  { name: 'Brennan, Tom',       shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '09:00', end: '09:30' }], tag: 'C&H Salesfloor',         tagInHour: 9  },
  { name: 'Caldwell, Priya',    shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '09:30', end: '10:00' }], tag: 'Stock Controller (A&A)', tagInHour: 8  },
  { name: 'Delgado, Marco',     shiftStart: '06:00', shiftEnd: '10:00', breaks: [],                                    tag: 'C&H Salesfloor',         tagInHour: 7  },
  { name: 'Eaton, Felicity',    shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '10:30', end: '11:00' }], tag: 'VM',                     tagInHour: 10 },
  { name: 'Foster, Gwen',       shiftStart: '07:00', shiftEnd: '15:00', breaks: [{ start: '11:00', end: '11:30' }], tag: 'Bureau',                 tagInHour: 11 },
  { name: 'Grant, Nathan',      shiftStart: '08:00', shiftEnd: '16:00', breaks: [{ start: '11:30', end: '12:00' }], tag: 'C&H Tilling',            tagInHour: 12 },
  { name: 'Holloway, Yuki',     shiftStart: '08:15', shiftEnd: '14:00', breaks: [{ start: '10:45', end: '11:00' }], tag: 'C&H Salesfloor',         tagInHour: 11 },
  { name: 'Iqbal, Sana',        shiftStart: '08:30', shiftEnd: '16:30', breaks: [{ start: '12:00', end: '12:30' }], tag: 'C&H Salesfloor',         tagInHour: 12 },
  { name: 'Jensen, Mikkel',     shiftStart: '08:30', shiftEnd: '16:30', breaks: [{ start: '13:00', end: '13:30' }], tag: 'C&H Tilling 5',          tagInHour: 14 },
  { name: 'Khan, Aisha',        shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '12:45', end: '13:15' }], tag: 'Bureau',                 tagInHour: 14 },
  { name: 'Lindqvist, Elsa',    shiftStart: '09:30', shiftEnd: '13:15', breaks: [],                                    tag: 'C&H Salesfloor',         tagInHour: 12 },
  { name: 'Moreau, Colette',    shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '13:30', end: '14:00' }], tag: 'Bra Fit',                tagInHour: 15 },
  { name: 'Nakamura, Ren',      shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '14:00', end: '14:30' }], tag: 'Stock Controller (A&A)', tagInHour: 15 },
  { name: 'Okafor, Chidi',      shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'C&H Salesfloor',         tagInHour: 14 },
  { name: 'Petrov, Dimitri',    shiftStart: '11:30', shiftEnd: '20:30', breaks: [{ start: '15:00', end: '15:30' }, { start: '18:00', end: '18:15' }], tag: 'TSM', tagInHour: 13 },
  { name: 'Quill, Robyn',       shiftStart: '12:00', shiftEnd: '20:00', breaks: [{ start: '15:30', end: '16:00' }], tag: 'Beauty',                 tagInHour: 16 },
  { name: 'Russo, Elena',       shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '16:30', end: '17:00' }], tag: 'C&H Salesfloor',         tagInHour: 17 },
  { name: 'Silva, Diego',       shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '17:00', end: '17:30' }], tag: 'C&H Tilling',            tagInHour: 18 },
  { name: 'Tanaka, Hana',       shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '16:45', end: '17:15' }], tag: 'Bureau',                 tagInHour: 17 },
  { name: 'Underwood, Mae',     shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '16:45', end: '17:15' }], tag: 'VM',                     tagInHour: 18 },
  { name: 'Vasquez, Lola',      shiftStart: '17:00', shiftEnd: '21:00', breaks: [],                                    tag: 'C&H Salesfloor',         tagInHour: 19 },
  { name: 'Williams, Theo',     shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '12:30', end: '13:00' }], tag: 'C&H Fill',               tagInHour: 13 },
  { name: 'Xu, Mei',            shiftStart: '08:00', shiftEnd: '16:00', breaks: [{ start: '11:45', end: '12:15' }], tag: 'Bank Services',          tagInHour: 12 },
];

// Hour-column layout — matches the real Schedule Editor.pdf so extractRota parses cleanly.
const HOUR_X: Record<number, number> = {
  6: 145.7, 7: 174.2, 8: 202.7, 9: 231.2, 10: 259.7, 11: 288.3, 12: 316.7,
  13: 345.1, 14: 373.6, 15: 402.1, 16: 430.6, 17: 459.1, 18: 487.6, 19: 516.1, 20: 544.7,
};
const HOUR_Y = 753.4;
const ROW_TOP_Y = 737.6;
const ROW_STEP = 16;
const TITLE_Y = 785.5;
const FOOTER_Y = 340;
const NAME_X = 33;
const SHIFT_X = 68.8;
const BREAK_X = 105.7;
const INK = rgb(0.06, 0.09, 0.13);

function tagXForHour(hour: number): number {
  // Place tag at left boundary of this hour's column (midpoint with prev hour marker).
  const x = HOUR_X[hour];
  const prev = HOUR_X[hour - 1];
  return prev ? (prev + x) / 2 : x - 20;
}

async function main() {
  const doc = await PDFDocument.create();
  doc.setTitle('Sample Rota');
  doc.setProducer('rota-scheduler (pdf-lib)');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const tagFont = await doc.embedFont(StandardFonts.Helvetica);

  const page = doc.addPage([595, 842]);
  page.setFontColor(INK);

  // Title
  const title = 'Monday - 15/06/2026';
  const titleWidth = font.widthOfTextAtSize(title, 12);
  page.drawText(title, { x: (595 - titleWidth) / 2, y: TITLE_Y, size: 12, font });

  // Column header labels
  page.drawText('Employee', { x: 32,  y: 757.1, size: 9, font });
  page.drawText('Scheduled', { x: 68, y: 757.1, size: 9, font });
  page.drawText('Breaks',    { x: 110, y: 753.4, size: 9, font });

  // Hour markers
  for (let h = 6; h <= 20; h++) {
    const label = `${String(h).padStart(2, '0')}:00`;
    page.drawText(label, { x: HOUR_X[h], y: HOUR_Y, size: 8, font });
  }

  // Employee rows — sorted by shift start time (stable sort preserves insertion order for ties).
  const sorted = [...ROSTER].sort((a, b) => a.shiftStart.localeCompare(b.shiftStart));
  sorted.forEach((emp, i) => {
    const y = ROW_TOP_Y - i * ROW_STEP;
    page.drawText(emp.name, { x: NAME_X, y, size: 9, font });
    page.drawText(`${emp.shiftStart}-${emp.shiftEnd}`, { x: SHIFT_X, y, size: 8, font });
    emp.breaks.forEach((b, bi) => {
      page.drawText(`${b.start}-${b.end}`, { x: BREAK_X, y: y - bi * 4, size: 8, font });
    });
    page.drawText(emp.tag, { x: tagXForHour(emp.tagInHour), y: y - 4, size: 7, font: tagFont });
  });

  // Footer
  page.drawText('Required', { x: 32, y: FOOTER_Y, size: 9, font });

  const out = await doc.save();
  const dest = resolve(process.cwd(), 'Sample Rota.pdf');
  writeFileSync(dest, out);
  console.log(`Wrote ${dest} (${ROSTER.length} staff)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
