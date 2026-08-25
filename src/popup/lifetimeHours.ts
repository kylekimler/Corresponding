/**
 * Local-only lifetime author-fill counter.
 * Never leaves the device. Example rosters and development fixtures must not
 * be recorded — those are practice, not researcher time saved.
 */

/** chrome.storage.local key. The popup footer is this device only.
 *  Eligible fills also POST an author count (no PII) to the hours worker. */
export const LIFETIME_AUTHORS_STORAGE_KEY = 'corresponding_lifetime_authors_v1';
const STORAGE_KEY = LIFETIME_AUTHORS_STORAGE_KEY;

type StorageLike = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

export interface LifetimeHoursStore {
  getAuthorsFilled(): Promise<number>;
  recordEligibleFill(authorCount: number): Promise<number>;
}

function readCount(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

export function createLifetimeHoursStore(area?: StorageLike): LifetimeHoursStore {
  const store: StorageLike =
    area ??
    (typeof chrome !== 'undefined' && chrome.storage?.local
      ? chrome.storage.local
      : {
          async get() {
            return {};
          },
          async set() {},
        });

  return {
    async getAuthorsFilled() {
      const data = await store.get(STORAGE_KEY);
      return readCount(data[STORAGE_KEY]);
    },
    async recordEligibleFill(authorCount: number) {
      const add = Math.max(0, Math.floor(authorCount));
      const current = await this.getAuthorsFilled();
      const next = current + add;
      await store.set({ [STORAGE_KEY]: next });
      return next;
    },
  };
}

export function createMemoryLifetimeHoursStore(
  initial = 0,
): LifetimeHoursStore {
  const data: Record<string, unknown> = { [STORAGE_KEY]: initial };
  return createLifetimeHoursStore({
    async get(key) {
      return { [key]: data[key] };
    },
    async set(items) {
      Object.assign(data, items);
    },
  });
}
