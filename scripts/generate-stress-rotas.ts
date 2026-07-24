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
interface RosterPreset {
  filename: string;
  title: string;
  staff: SampleEmployee[];
}

const UNDERSTAFFED: SampleEmployee[] = [
  { name: 'Adler, Max',        shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '10:00', end: '10:30' }], tag: 'Stock Controller (A&A)', tagInHour: 9  },
  { name: 'Brennan, Tom',       shiftStart: '08:00', shiftEnd: '16:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'C&H Tilling',            tagInHour: 10 },
  { name: 'Carter, Lena',       shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '12:30', end: '13:00' }], tag: 'C&H Salesfloor',         tagInHour: 11 },
  { name: 'Dempsey, Owen',      shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'C&H Tilling',            tagInHour: 14 },
  { name: 'Espinoza, Rosa',     shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '13:30', end: '14:00' }], tag: 'Bra Fit',                tagInHour: 15 },
  { name: 'Fletcher, Gemma',    shiftStart: '12:00', shiftEnd: '20:00', breaks: [{ start: '15:00', end: '15:30' }], tag: 'C&H Tilling',            tagInHour: 16 },
  { name: 'Grant, Nathan',      shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '17:00', end: '17:30' }], tag: 'C&H Salesfloor',         tagInHour: 18 },
  { name: 'Hoffman, Iris',      shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'Bureau',                 tagInHour: 11 },
  { name: 'Inglis, Zoe',        shiftStart: '11:00', shiftEnd: '19:00', breaks: [{ start: '14:30', end: '15:00' }], tag: 'C&H Salesfloor',         tagInHour: 14 },
  { name: 'Jenkins, Mike',      shiftStart: '14:00', shiftEnd: '21:00', breaks: [{ start: '18:00', end: '18:30' }], tag: 'C&H Tilling',            tagInHour: 19 },
  { name: 'Khan, Aisha',        shiftStart: '06:00', shiftEnd: '10:00', breaks: [],                                    tag: 'C&H Salesfloor',         tagInHour: 7  },
  { name: 'Lombardi, Vince',    shiftStart: '17:00', shiftEnd: '21:00', breaks: [],                                    tag: 'C&H Tilling',            tagInHour: 19 },
];

const OVERSTAFFED: SampleEmployee[] = [
  // Early openers
  { name: 'Abernathy, Iris',    shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '10:00', end: '10:30' }], tag: 'Stock Controller (A&A)', tagInHour: 9  },
  { name: 'Brennan, Tom',       shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '09:00', end: '09:30' }], tag: 'C&H Salesfloor',         tagInHour: 8  },
  { name: 'Caldwell, Priya',    shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '09:30', end: '10:00' }], tag: 'Stock Controller (A&A)', tagInHour: 8  },
  { name: 'Delgado, Marco',     shiftStart: '06:00', shiftEnd: '10:00', breaks: [],                                    tag: 'C&H Salesfloor',         tagInHour: 7  },
  { name: 'Eaton, Felicity',    shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '10:30', end: '11:00' }], tag: 'VM',                     tagInHour: 10 },
  { name: 'Elwood, Sam',        shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '10:00', end: '10:30' }], tag: 'C&H Salesfloor',         tagInHour: 9  },
  // Mid-early
  { name: 'Foster, Gwen',       shiftStart: '07:00', shiftEnd: '15:00', breaks: [{ start: '11:00', end: '11:30' }], tag: 'Bureau',                 tagInHour: 11 },
  { name: 'Grant, Nathan',      shiftStart: '08:00', shiftEnd: '16:00', breaks: [{ start: '11:30', end: '12:00' }], tag: 'C&H Tilling',            tagInHour: 12 },
  { name: 'Holloway, Yuki',     shiftStart: '08:00', shiftEnd: '16:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'C&H Salesfloor',         tagInHour: 12 },
  { name: 'Iqbal, Sana',        shiftStart: '08:30', shiftEnd: '16:30', breaks: [{ start: '12:30', end: '13:00' }], tag: 'C&H Salesfloor',         tagInHour: 13 },
  { name: 'Jensen, Mikkel',     shiftStart: '08:30', shiftEnd: '16:30', breaks: [{ start: '13:00', end: '13:30' }], tag: 'C&H Tilling 5',          tagInHour: 14 },
  { name: 'Joyce, Fiona',       shiftStart: '08:30', shiftEnd: '16:30', breaks: [{ start: '12:00', end: '12:30' }], tag: 'C&H Tilling',            tagInHour: 12 },
  // Mid-day
  { name: 'Khan, Aisha',        shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '12:45', end: '13:15' }], tag: 'Bureau',                 tagInHour: 14 },
  { name: 'Kowalski, Pavel',    shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'Bra Fit',                tagInHour: 14 },
  { name: 'Lindqvist, Elsa',    shiftStart: '09:30', shiftEnd: '13:15', breaks: [],                                    tag: 'C&H Salesfloor',         tagInHour: 12 },
  { name: 'Moreau, Colette',    shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '13:30', end: '14:00' }], tag: 'Bra Fit',                tagInHour: 15 },
  { name: 'Nakamura, Ren',      shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '14:00', end: '14:30' }], tag: 'Stock Controller (A&A)', tagInHour: 15 },
  { name: 'Okafor, Chidi',      shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'C&H Salesfloor',         tagInHour: 14 },
  { name: 'Olsen, Lars',        shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '14:30', end: '15:00' }], tag: 'C&H Tilling',            tagInHour: 15 },
  { name: 'Petrov, Dimitri',    shiftStart: '11:30', shiftEnd: '20:30', breaks: [{ start: '15:00', end: '15:30' }, { start: '18:00', end: '18:15' }], tag: 'TSM', tagInHour: 13 },
  { name: 'Parker, Theodora',   shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '13:15', end: '13:45' }], tag: 'VM',                     tagInHour: 14 },
  // Late
  { name: 'Quill, Robyn',       shiftStart: '12:00', shiftEnd: '20:00', breaks: [{ start: '15:30', end: '16:00' }], tag: 'Beauty',                 tagInHour: 16 },
  { name: 'Reyes, Mateo',       shiftStart: '12:00', shiftEnd: '20:00', breaks: [{ start: '16:00', end: '16:30' }], tag: 'C&H Salesfloor',         tagInHour: 17 },
  { name: 'Russo, Elena',       shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '16:30', end: '17:00' }], tag: 'C&H Salesfloor',         tagInHour: 17 },
  { name: 'Silva, Diego',       shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '17:00', end: '17:30' }], tag: 'C&H Tilling',            tagInHour: 18 },
  { name: 'Tanaka, Hana',       shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '16:45', end: '17:15' }], tag: 'Bureau',                 tagInHour: 17 },
  { name: 'Underwood, Mae',     shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '16:45', end: '17:15' }], tag: 'VM',                     tagInHour: 18 },
  { name: 'Ueda, Kenji',        shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '17:30', end: '18:00' }], tag: 'Stock Controller (A&A)', tagInHour: 18 },
  { name: 'Vasquez, Lola',      shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '18:00', end: '18:30' }], tag: 'C&H Tilling',            tagInHour: 19 },
  { name: 'Williams, Theo',     shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '12:30', end: '13:00' }], tag: 'C&H Fill',               tagInHour: 13 },
  { name: 'Winter, Holly',      shiftStart: '14:00', shiftEnd: '21:00', breaks: [{ start: '18:30', end: '19:00' }], tag: 'C&H Salesfloor',         tagInHour: 19 },
  { name: 'Xu, Mei',            shiftStart: '08:00', shiftEnd: '16:00', breaks: [{ start: '11:45', end: '12:15' }], tag: 'Bank Services',          tagInHour: 12 },
  { name: 'Yamamoto, Suki',     shiftStart: '14:00', shiftEnd: '21:00', breaks: [{ start: '17:45', end: '18:15' }], tag: 'Bra Fit',                tagInHour: 19 },
  { name: 'Zimmerman, Felix',   shiftStart: '17:00', shiftEnd: '21:00', breaks: [],                                    tag: 'C&H Salesfloor',         tagInHour: 19 },
  { name: 'Zhou, Lin',          shiftStart: '17:00', shiftEnd: '21:00', breaks: [],                                    tag: 'C&H Tilling',            tagInHour: 19 },
];

// ~22 staff, breaks deliberately clustered at 12:00-12:30 and 13:00-13:30 to force break-shift / break-cover.
const BREAK_HEAVY: SampleEmployee[] = [
  { name: 'Adler, Max',        shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'Stock Controller (A&A)', tagInHour: 9  },
  { name: 'Brennan, Tom',       shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'C&H Tilling',            tagInHour: 8  },
  { name: 'Caldwell, Priya',    shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'C&H Salesfloor',         tagInHour: 8  },
  { name: 'Delgado, Marco',     shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'Bra Fit',                tagInHour: 10 },
  { name: 'Eaton, Felicity',    shiftStart: '06:00', shiftEnd: '14:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'VM',                     tagInHour: 10 },
  { name: 'Foster, Gwen',       shiftStart: '08:00', shiftEnd: '16:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'Bureau',                 tagInHour: 11 },
  { name: 'Grant, Nathan',      shiftStart: '08:00', shiftEnd: '16:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'C&H Tilling',            tagInHour: 11 },
  { name: 'Holloway, Yuki',     shiftStart: '08:00', shiftEnd: '16:00', breaks: [{ start: '12:00', end: '12:30' }], tag: 'C&H Salesfloor',         tagInHour: 11 },
  { name: 'Iqbal, Sana',        shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'C&H Tilling',            tagInHour: 14 },
  { name: 'Jensen, Mikkel',     shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'C&H Tilling 5',          tagInHour: 14 },
  { name: 'Khan, Aisha',        shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'Bureau',                 tagInHour: 14 },
  { name: 'Lindqvist, Elsa',    shiftStart: '09:00', shiftEnd: '17:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'C&H Salesfloor',         tagInHour: 14 },
  { name: 'Moreau, Colette',    shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'Bra Fit',                tagInHour: 15 },
  { name: 'Nakamura, Ren',      shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'Stock Controller (A&A)', tagInHour: 15 },
  { name: 'Okafor, Chidi',      shiftStart: '10:00', shiftEnd: '18:00', breaks: [{ start: '13:00', end: '13:30' }], tag: 'C&H Salesfloor',         tagInHour: 14 },
  { name: 'Petrov, Dimitri',    shiftStart: '11:30', shiftEnd: '20:30', breaks: [{ start: '15:00', end: '15:30' }, { start: '18:00', end: '18:15' }], tag: 'TSM', tagInHour: 13 },
  { name: 'Quill, Robyn',       shiftStart: '12:00', shiftEnd: '20:00', breaks: [{ start: '16:00', end: '16:30' }], tag: 'Beauty',                 tagInHour: 16 },
  { name: 'Russo, Elena',       shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '17:00', end: '17:30' }], tag: 'C&H Salesfloor',         tagInHour: 17 },
  { name: 'Silva, Diego',       shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '17:00', end: '17:30' }], tag: 'C&H Tilling',            tagInHour: 18 },
  { name: 'Tanaka, Hana',       shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '17:00', end: '17:30' }], tag: 'Bureau',                 tagInHour: 17 },
  { name: 'Underwood, Mae',     shiftStart: '13:00', shiftEnd: '21:00', breaks: [{ start: '17:00', end: '17:30' }], tag: 'VM',                     tagInHour: 18 },
  { name: 'Vasquez, Lola',      shiftStart: '17:00', shiftEnd: '21:00', breaks: [],                                    tag: 'C&H Salesfloor',         tagInHour: 19 },
];

const PRESETS: RosterPreset[] = [
  { filename: 'Sample Rota - Understaffed.pdf', title: 'Wednesday - 24/06/2026', staff: UNDERSTAFFED },
  { filename: 'Sample Rota - Overstaffed.pdf',  title: 'Thursday - 25/06/2026',  staff: OVERSTAFFED  },
  { filename: 'Sample Rota - Break Heavy.pdf',  title: 'Friday - 26/06/2026',    staff: BREAK_HEAVY  },
];

// Layout constants — matches the real Schedule Editor.pdf so extractRota parses cleanly.
const HOUR_X: Record<number, number> = {
  6: 145.7, 7: 174.2, 8: 202.7, 9: 231.2, 10: 259.7, 11: 288.3, 12: 316.7,
  13: 345.1, 14: 373.6, 15: 402.1, 16: 430.6, 17: 459.1, 18: 487.6, 19: 516.1, 20: 544.7,
};
const HOUR_Y = 753.4;
const ROW_TOP_Y = 737.6;
const ROW_STEP = 16;
const TITLE_Y = 785.5;
const NAME_X = 33;
const SHIFT_X = 68.8;
const BREAK_X = 105.7;
const INK = rgb(0.06, 0.09, 0.13);

function tagXForHour(hour: number): number {
  const x = HOUR_X[hour];
  const prev = HOUR_X[hour - 1];
  return prev ? (prev + x) / 2 : x - 20;
}

async function renderPreset(preset: RosterPreset) {
  const doc = await PDFDocument.create();
  doc.setTitle(preset.filename);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.setFontColor(INK);

  const titleWidth = font.widthOfTextAtSize(preset.title, 12);
  page.drawText(preset.title, { x: (595 - titleWidth) / 2, y: TITLE_Y, size: 12, font });

  page.drawText('Employee', { x: 32,  y: 757.1, size: 9, font });
  page.drawText('Scheduled', { x: 68, y: 757.1, size: 9, font });
  page.drawText('Breaks',    { x: 110, y: 753.4, size: 9, font });
  for (let h = 6; h <= 20; h++) {
    page.drawText(`${String(h).padStart(2, '0')}:00`, { x: HOUR_X[h], y: HOUR_Y, size: 8, font });
  }

  // Sorted by shift start time (stable sort preserves insertion order for ties).
  const sorted = [...preset.staff].sort((a, b) => a.shiftStart.localeCompare(b.shiftStart));
  sorted.forEach((emp, i) => {
    const y = ROW_TOP_Y - i * ROW_STEP;
    page.drawText(emp.name, { x: NAME_X, y, size: 9, font });
    page.drawText(`${emp.shiftStart}-${emp.shiftEnd}`, { x: SHIFT_X, y, size: 8, font });
    emp.breaks.forEach((b, bi) => {
      page.drawText(`${b.start}-${b.end}`, { x: BREAK_X, y: y - bi * 4, size: 8, font });
    });
    page.drawText(emp.tag, { x: tagXForHour(emp.tagInHour), y: y - 4, size: 7, font });
  });

  const footerY = ROW_TOP_Y - (preset.staff.length + 1) * ROW_STEP;
  page.drawText('Required', { x: 32, y: footerY, size: 9, font });

  const out = await doc.save();
  const dest = resolve(process.cwd(), preset.filename);
  writeFileSync(dest, out);
  console.log(`Wrote ${preset.filename} (${preset.staff.length} staff)`);
}

async function main() {
  for (const preset of PRESETS) await renderPreset(preset);
}
main().catch((err) => { console.error(err); process.exit(1); });
