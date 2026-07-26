export const STORAGE_VERSION = 2 as const;
export const STORAGE_KEY = 'rota-scheduler:v2';
export const LEGACY_V1_KEY = 'rota-flow-v1';

export interface LibraryEntry<TState> {
  id: string;
  name: string;
  date: string;
  savedAt: number;
  state: TState;
}

export interface Draft<TState> {
  state: TState;
  savedAt: number;
}

export interface PersistedState<TState> {
  version: typeof STORAGE_VERSION;
  draft: Draft<TState> | null;
  library: LibraryEntry<TState>[];
}

export interface ExportPayload<TState> {
  version: typeof STORAGE_VERSION;
  state: TState;
}
