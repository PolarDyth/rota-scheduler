import { LEGACY_V1_KEY, STORAGE_KEY, STORAGE_VERSION } from './schema';

export interface MigrationResult {
  migrated: boolean;
  state?: unknown;
}

export function migrateV1IfNeeded(): MigrationResult {
  if (typeof window === 'undefined') return { migrated: false };
  try {
    const legacy = window.sessionStorage.getItem(LEGACY_V1_KEY);
    if (!legacy) return { migrated: false };
    const parsed = JSON.parse(legacy);
    const v2 = {
      version: STORAGE_VERSION,
      draft: { state: parsed, savedAt: Date.now() },
      library: [],
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v2));
    window.sessionStorage.removeItem(LEGACY_V1_KEY);
    return { migrated: true, state: parsed };
  } catch {
    return { migrated: false };
  }
}
