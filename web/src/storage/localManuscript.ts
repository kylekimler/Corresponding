import {
  parseManuscriptJsonSafe,
  serializeManuscript,
  type Manuscript,
} from '@/schema/manuscript';

export const LOCAL_MANUSCRIPT_KEY = 'corresponding_web_manuscript_v1';

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function loadLocalManuscript(
  storage: StorageLike | undefined = globalThis.localStorage,
): Manuscript | null {
  if (!storage) return null;
  try {
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
  if (!storage) return;
  storage.setItem(LOCAL_MANUSCRIPT_KEY, serializeManuscript(manuscript));
}

export function clearLocalManuscript(
  storage: StorageLike | undefined = globalThis.localStorage,
): void {
  if (!storage) return;
  storage.removeItem(LOCAL_MANUSCRIPT_KEY);
}
