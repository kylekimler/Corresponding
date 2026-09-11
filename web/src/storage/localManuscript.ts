import {
  parseManuscriptJsonSafe,
  serializeManuscript,
  type Manuscript,
} from '@/schema/manuscript';

export const LOCAL_MANUSCRIPT_KEY = 'corresponding_web_manuscript_v1';
export const MANUSCRIPT_HISTORY_KEY = 'corresponding_web_history_v1';

export function listLocalManuscripts(storage?: StorageLike): Manuscript[] {
  try {
    storage ??= globalThis.localStorage;
    if (!storage) return [];
    const raw: unknown = JSON.parse(storage.getItem(MANUSCRIPT_HISTORY_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      const parsed = parseManuscriptJsonSafe(item).manuscript;
      return parsed ? [parsed] : [];
    });
  } catch { return []; }
}

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function loadLocalManuscript(
  storage?: StorageLike,
): Manuscript | null {
  try {
    storage ??= globalThis.localStorage;
    if (!storage) return null;
    const raw = storage.getItem(LOCAL_MANUSCRIPT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parseManuscriptJsonSafe(parsed).manuscript;
  } catch {
    return null;
  }
}

export function saveLocalManuscript(
  manuscript: Manuscript,
  storage: StorageLike | undefined = globalThis.localStorage,
): void {
  if (!storage) throw new Error('Local storage is unavailable');
  const previous = loadLocalManuscript(storage);
  if (previous && previous.id !== manuscript.id) {
    const history = listLocalManuscripts(storage).filter((item) => item.id !== previous.id);
    storage.setItem(MANUSCRIPT_HISTORY_KEY, JSON.stringify([previous, ...history]));
  }
  storage.setItem(LOCAL_MANUSCRIPT_KEY, serializeManuscript(manuscript));
}

export function clearLocalManuscript(
  storage: StorageLike | undefined = globalThis.localStorage,
): void {
  if (!storage) return;
  storage.removeItem(LOCAL_MANUSCRIPT_KEY);
}
