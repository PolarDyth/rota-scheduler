import type {
  Employee,
  ExtractedRota,
  BreakPeriod,
  SpecialisedRole,
} from '../types';
import { lookupTag } from './tagMap';

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Row {
  y: number;
  items: TextItem[];
}

interface HourColumn {
  hour: number;
  xLeft: number;
  xRight: number;
}

const SHIFT_RE = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g;
const TIME_ONLY_RE = /^\d{1,2}:\d{2}$/;
const DAY_RE = /^[A-Z][a-z]+day\b/;
const NOISE_TOKENS = new Set(['B', 'BB', '']);
const NAME_COLUMN_X = 60;

export async function extractRota(input: File | ArrayBuffer): Promise<ExtractedRota> {
  // Install Node-side stubs for DOMMatrix/ImageData/Path2D *before* pdfjs-dist
  // evaluates its module-load constant `new DOMMatrix()`. Dynamic import guarantees
  // ordering regardless of how Turbopack chunks the static imports below.
  await import('./polyfills');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const buffer = input instanceof File ? await input.arrayBuffer() : input;
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    throw new Error('Not a valid PDF file (missing %PDF- header).');
  }
  const doc = await pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
  }).promise;

  const employees: Employee[] = [];
  const rawWarnings: string[] = [];
  let date: string | undefined;
  let dayName: string | undefined;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    const items: TextItem[] = (content.items as any[])
      .filter((it) => typeof it.str === 'string' && it.str.trim().length > 0)
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width,
        height: it.height,
      }));

    if (!date) {
      const dateItem = items.find((it) => DAY_RE.test(it.str));
      if (dateItem) {
        const m = dateItem.str.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
        if (m) date = m[1];
        const dm = dateItem.str.match(/^([A-Z][a-z]+day)/);
        if (dm) dayName = dm[1];
      }
    }

    const hourItems = items.filter((it) => TIME_ONLY_RE.test(it.str.trim()));
    const yCounts = new Map<number, number>();
    for (const it of hourItems) {
      const key = Math.round(it.y);
      yCounts.set(key, (yCounts.get(key) ?? 0) + 1);
    }
    let headerY = 0;
    let headerCount = 0;
    for (const [y, c] of yCounts) {
      if (c > headerCount) {
        headerY = y;
        headerCount = c;
      }
    }
    if (headerCount < 3) {
      rawWarnings.push(`Page ${p}: hour header not found`);
      continue;
    }

    const headerHourItems = hourItems
      .filter((it) => Math.abs(it.y - headerY) < 2)
      .sort((a, b) => a.x - b.x);
    const hourColumns: HourColumn[] = headerHourItems.map((it, i) => {
      const hour = parseInt(it.str.split(':')[0], 10);
      const next = headerHourItems[i + 1];
      const prev = headerHourItems[i - 1];
      const xLeft = prev ? (prev.x + it.x) / 2 : it.x - 20;
      const xRight = next ? (it.x + next.x) / 2 : it.x + 40;
      return { hour, xLeft, xRight };
    });

    const footerItem = items.find((it) => it.str.trim() === 'Required');
    const footerY = footerItem ? footerItem.y : -Infinity;

    const dataItems = items.filter(
      (it) =>
        it.y < headerY - 5 &&
        it.y > footerY + 2 &&
        !NOISE_TOKENS.has(it.str.trim())
    );

    const sorted = [...dataItems].sort((a, b) => b.y - a.y);
    const rows: Row[] = [];
    let current: Row | null = null;
    let lastY = Infinity;
    for (const it of sorted) {
      if (!current || lastY - it.y > 5) {
        current = { y: it.y, items: [] };
        rows.push(current);
      }
      current.items.push(it);
      lastY = it.y;
    }

    const employeeRows = rows.filter((r) =>
      r.items.some((it) => it.x < NAME_COLUMN_X && /[A-Za-z]/.test(it.str))
    );

    let idx = 0;
    for (const row of employeeRows) {
      const emp = parseEmployee(row, hourColumns, idx++);
      if (emp) {
        employees.push(emp);
        if (!emp.shiftStart || !emp.shiftEnd) {
          rawWarnings.push(
            `"${emp.name}": no shift detected — please enter manually.`
          );
        }
      }
    }
  }

  await doc.destroy();
  return { date, dayName, employees, rawWarnings };
}

function parseEmployee(
  row: Row,
  hourColumns: HourColumn[],
  idx: number
): Employee | null {
  const items = [...row.items].sort((a, b) => b.y - a.y || a.x - b.x);

  const nameItems = items.filter((it) => it.x < NAME_COLUMN_X);
  const name =
    nameItems
      .map((it) => it.str.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim() || `Unknown ${idx + 1}`;

  const allText = items.map((it) => it.str).join(' ');
  const matches = [...allText.matchAll(SHIFT_RE)].map((m) => ({
    start: m[1],
    end: m[2],
    duration:
      timeToMinutes(m[2]) - timeToMinutes(m[1]),
  }));

  let shiftStart = '';
  let shiftEnd = '';
  let breaks: BreakPeriod[] = [];

  if (matches.length > 0) {
    const sorted = [...matches].sort((a, b) => b.duration - a.duration);
    const shift = sorted[0];
    shiftStart = normalizeTime(shift.start);
    shiftEnd = normalizeTime(shift.end);
    breaks = sorted.slice(1).map((m) => ({
      start: normalizeTime(m.start),
      end: normalizeTime(m.end),
    }));
  }

  const pdfTags: string[] = [];
  let specialisedRole: SpecialisedRole | undefined;

  for (const col of hourColumns) {
    const cellItems = items.filter((it) => it.x >= col.xLeft && it.x < col.xRight);
    const cellText = cellItems
      .map((it) => it.str.trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!cellText) continue;

    const tag = lookupTag(cellText);
    if (tag?.ignore) continue;
    if (tag?.specialised) {
      specialisedRole = tag.specialised;
      if (tag.label && !pdfTags.includes(tag.label)) pdfTags.push(tag.label);
    } else if (tag?.label) {
      if (!pdfTags.includes(tag.label)) pdfTags.push(tag.label);
    } else if (cellText.length > 2 && !pdfTags.includes(cellText)) {
      pdfTags.push(cellText);
    }
  }

  const slug = slugify(name);
  return {
    id: slug ? `${slug}-${idx}` : `emp-${idx}`,
    name,
    shiftStart,
    shiftEnd,
    breaks,
    specialisedRole,
    department: 'any',
    pdfTags,
  };
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function normalizeTime(t: string): string {
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
