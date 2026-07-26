// Smoke test for the persistence layer.
// Run via: npx tsx scripts/test-storage.ts
//
// Mocks localStorage/sessionStorage in Node, then exercises the full
// surface: draft round-trip, library add/load/delete, export/import,
// and the v1 → v2 migration path.

type MemEntry = { value: string };
function makeMemStorage() {
  const map = new Map<string, MemEntry>();
  return {
    getItem(k: string) {
      return map.has(k) ? map.get(k)!.value : null;
    },
    setItem(k: string, v: string) {
      map.set(k, { value: String(v) });
    },
    removeItem(k: string) {
      map.delete(k);
    },
    clear() {
      map.clear();
    },
  };
}

const localStorage = makeMemStorage();
const sessionStorage = makeMemStorage();
(globalThis as unknown as { window: unknown }).window = { localStorage, sessionStorage };

import {
  saveDraft,
  loadDraft,
  saveToLibrary,
  listLibrary,
  deleteLibraryEntry,
  renameLibraryEntry,
  duplicateLibraryEntryToDraft,
  exportRota,
  importRota,
} from '../src/lib/storage/storage';
import { migrateV1IfNeeded } from '../src/lib/storage/migrate';

interface FakeState {
  hello: string;
  n: number;
}

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function run() {
  console.log('Draft round-trip');
  const state: FakeState = { hello: 'world', n: 42 };
  let r = saveDraft(state);
  check('saveDraft ok', r.ok);
  const loaded = loadDraft<FakeState>();
  check('loaded state matches', loaded?.state?.hello === 'world' && loaded?.state?.n === 42, JSON.stringify(loaded));
  check('loaded has savedAt', typeof loaded?.savedAt === 'number');

  console.log('\nLibrary add / list / load / rename / delete');
  r = saveToLibrary('Saturday', '2026-07-25', state);
  check('saveToLibrary ok', r.ok);
  r = saveToLibrary('Sunday', '2026-07-26', { hello: 'two', n: 7 });
  check('second saveToLibrary ok', r.ok);
  const entries = listLibrary<FakeState>();
  check('library has 2 entries', entries.length === 2, `length=${entries.length}`);
  check('library sorted newest first', entries[0].name === 'Sunday', entries[0].name);
  const id0 = entries[1].id;
  renameLibraryEntry(id0, 'Saturday trade', '2026-07-25');
  const afterRename = listLibrary().find((e) => e.id === id0);
  check('rename applied', afterRename?.name === 'Saturday trade', afterRename?.name);

  console.log('\nDuplicate to draft');
  duplicateLibraryEntryToDraft(entries[0].id);
  const dup = loadDraft<FakeState>();
  check('duplicate wrote draft', dup?.state?.hello === 'two', JSON.stringify(dup?.state));

  console.log('\nDelete');
  const before = listLibrary().length;
  deleteLibraryEntry(entries[0].id);
  const after = listLibrary().length;
  check('delete removed one entry', after === before - 1, `before=${before} after=${after}`);

  console.log('\nExport / import round-trip');
  const payload = exportRota(state);
  const json = JSON.stringify(payload);
  const imported = importRota<FakeState>(json);
  check('import succeeded', imported.state?.hello === 'world', imported.error);
  check('import no warning', !imported.warning);

  console.log('\nImport malformed');
  const bad = importRota<FakeState>('not json');
  check('malformed rejected with error', !!bad.error && bad.state === null);
  const wrong = importRota<FakeState>(JSON.stringify({ version: 99, state: { x: 1 } }));
  check('wrong version flagged with warning', !!wrong.warning && wrong.state !== null);

  console.log('\nv1 → v2 migration');
  sessionStorage.setItem('rota-flow-v1', JSON.stringify({ step: 'confirm', legacy: true }));
  // Wipe v2 so migration is observable
  localStorage.removeItem('rota-scheduler:v2');
  const result = migrateV1IfNeeded();
  check('migration reported migrated=true', result.migrated);
  check('v1 key cleared', sessionStorage.getItem('rota-flow-v1') === null);
  const migrated = loadDraft<{ step: string; legacy: boolean }>();
  check('migrated state loaded into draft', migrated?.state?.step === 'confirm' && migrated?.state?.legacy === true, JSON.stringify(migrated));

  console.log('\nMigration no-op when no v1 key present');
  localStorage.removeItem('rota-scheduler:v2');
  sessionStorage.removeItem('rota-flow-v1');
  const noop = migrateV1IfNeeded();
  check('noop returns migrated=false', !noop.migrated);
}

run();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
