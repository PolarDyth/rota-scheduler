import {
  STORAGE_KEY,
  STORAGE_VERSION,
  type Draft,
  type ExportPayload,
  type LibraryEntry,
  type PersistedState,
} from './schema';

function emptyState<TState>(): PersistedState<TState> {
  return { version: STORAGE_VERSION, draft: null, library: [] };
}

function read<TState>(): PersistedState<TState> {
  if (typeof window === 'undefined') return emptyState<TState>();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState<TState>();
    const parsed = JSON.parse(raw) as PersistedState<TState>;
    if (parsed?.version !== STORAGE_VERSION) return emptyState<TState>();
    if (!parsed.library) parsed.library = [];
    return parsed;
  } catch {
    return emptyState<TState>();
  }
}

function write<TState>(state: PersistedState<TState>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function loadPersisted<TState>(): PersistedState<TState> {
  return read<TState>();
}

export function loadDraft<TState>(): Draft<TState> | null {
  return read<TState>().draft;
}

export interface SaveResult {
  ok: boolean;
  quotaExceeded: boolean;
}

export function saveDraft<TState>(state: TState): SaveResult {
  const current = read<unknown>();
  const ok = write({
    ...current,
    draft: { state, savedAt: Date.now() },
  });
  return { ok, quotaExceeded: !ok };
}

export function clearDraft(): void {
  const current = read<unknown>();
  write({ ...current, draft: null });
}

export function listLibrary<TState>(): LibraryEntry<TState>[] {
  return read<TState>().library;
}

export function saveToLibrary<TState>(
  name: string,
  date: string,
  state: TState
): SaveResult {
  const current = read<unknown>();
  const entry: LibraryEntry<unknown> = {
    id: generateId(),
    name: name.trim() || 'Untitled',
    date,
    savedAt: Date.now(),
    state,
  };
  const ok = write({
    ...current,
    library: [entry, ...current.library],
  });
  return { ok, quotaExceeded: !ok };
}

export function deleteLibraryEntry(id: string): void {
  const current = read<unknown>();
  write({ ...current, library: current.library.filter((e) => e.id !== id) });
}

export function renameLibraryEntry(id: string, name: string, date: string): void {
  const current = read<unknown>();
  write({
    ...current,
    library: current.library.map((e) =>
      e.id === id
        ? { ...e, name: name.trim() || e.name, date: date || e.date }
        : e
    ),
  });
}

export function duplicateLibraryEntryToDraft(id: string): boolean {
  const current = read<unknown>();
  const entry = current.library.find((e) => e.id === id);
  if (!entry) return false;
  return write({
    ...current,
    draft: { state: entry.state, savedAt: Date.now() },
  });
}

export function loadLibraryEntry<TState>(id: string): TState | null {
  const entry = read<TState>().library.find((e) => e.id === id);
  return entry ? entry.state : null;
}

export function exportRota<TState>(state: TState): ExportPayload<TState> {
  return { version: STORAGE_VERSION, state };
}

export interface ImportResult<TState> {
  state: TState | null;
  error?: string;
  warning?: string;
}

export function importRota<TState>(json: string): ImportResult<TState> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { state: null, error: 'File is not valid JSON.' };
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { state: null, error: 'File is not a valid rota.' };
  }
  const obj = parsed as { version?: unknown; state?: unknown };
  if (obj.state === null || typeof obj.state !== 'object') {
    return { state: null, error: 'File has no rota data.' };
  }
  if (obj.version !== STORAGE_VERSION) {
    return {
      state: obj.state as TState,
      warning: `Saved by version ${String(obj.version)} (expected ${STORAGE_VERSION}); some data may not load correctly.`,
    };
  }
  return { state: obj.state as TState };
}
