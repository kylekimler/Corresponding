import {
  ROSTER_SCHEMA_VERSION,
  RosterSchema,
  type Roster,
} from '@/schema/author';
import { toCsv } from '@/import/csv';

const STORAGE_KEY = 'journal_autofill_rosters_v1';

export interface RosterStore {
  list(): Promise<Roster[]>;
  get(id: string): Promise<Roster | undefined>;
  save(roster: Roster): Promise<Roster>;
  rename(id: string, name: string): Promise<Roster>;
  remove(id: string): Promise<void>;
  duplicate(id: string, newName?: string): Promise<Roster>;
  exportJson(id: string): Promise<string>;
  exportCsv(id: string): Promise<string>;
  importRoster(roster: Roster): Promise<Roster>;
}

type MemoryBucket = { rosters: Roster[] };

function migrateRoster(raw: unknown): Roster {
  const parsed = RosterSchema.catch({
    id: crypto.randomUUID(),
    name: 'Recovered roster',
    authors: [],
    schemaVersion: ROSTER_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'manual' as const,
  }).parse({
    ...(typeof raw === 'object' && raw ? raw : {}),
    schemaVersion:
      typeof raw === 'object' &&
      raw &&
      'schemaVersion' in raw &&
      typeof (raw as { schemaVersion: unknown }).schemaVersion === 'number'
        ? (raw as { schemaVersion: number }).schemaVersion
        : ROSTER_SCHEMA_VERSION,
  });
  return parsed;
}

async function readAll(
  area: chrome.storage.StorageArea | MemoryBucket,
): Promise<Roster[]> {
  if ('get' in area && typeof area.get === 'function') {
    const data = await area.get(STORAGE_KEY);
    const list = (data[STORAGE_KEY] as unknown[]) ?? [];
    return list.map(migrateRoster);
  }
  return (area as MemoryBucket).rosters.map(migrateRoster);
}

async function writeAll(
  area: chrome.storage.StorageArea | MemoryBucket,
  rosters: Roster[],
): Promise<void> {
  if ('set' in area && typeof area.set === 'function') {
    await area.set({ [STORAGE_KEY]: rosters });
    return;
  }
  (area as MemoryBucket).rosters = rosters;
}

export function createRosterStore(
  area?: chrome.storage.StorageArea | MemoryBucket,
): RosterStore {
  const bucket: chrome.storage.StorageArea | MemoryBucket =
    area ??
    (typeof chrome !== 'undefined' && chrome.storage?.local
      ? chrome.storage.local
      : { rosters: [] });

  return {
    async list() {
      const all = await readAll(bucket);
      return all.sort((a, b) => a.name.localeCompare(b.name));
    },
    async get(id) {
      return (await readAll(bucket)).find((r) => r.id === id);
    },
    async save(roster) {
      const all = await readAll(bucket);
      const next = {
        ...roster,
        schemaVersion: ROSTER_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      };
      const idx = all.findIndex((r) => r.id === next.id);
      if (idx >= 0) all[idx] = next;
      else all.push(next);
      await writeAll(bucket, all);
      return next;
    },
    async rename(id, name) {
      const roster = await this.get(id);
      if (!roster) throw new Error(`Roster not found: ${id}`);
      return this.save({ ...roster, name });
    },
    async remove(id) {
      const all = (await readAll(bucket)).filter((r) => r.id !== id);
      await writeAll(bucket, all);
    },
    async duplicate(id, newName) {
      const roster = await this.get(id);
      if (!roster) throw new Error(`Roster not found: ${id}`);
      const copy: Roster = {
        ...structuredClone(roster),
        id: crypto.randomUUID(),
        name: newName ?? `${roster.name} (copy)`,
        source: 'duplicate',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authors: roster.authors.map((a) => ({
          ...structuredClone(a),
          id: crypto.randomUUID(),
        })),
      };
      return this.save(copy);
    },
    async exportJson(id) {
      const roster = await this.get(id);
      if (!roster) throw new Error(`Roster not found: ${id}`);
      return `${JSON.stringify(roster, null, 2)}\n`;
    },
    async exportCsv(id) {
      const roster = await this.get(id);
      if (!roster) throw new Error(`Roster not found: ${id}`);
      const headers = [
        'sequence',
        'givenName',
        'middleName',
        'familyName',
        'email',
        'orcid',
        'isCorresponding',
        'institution',
        'city',
        'country',
      ];
      const rows = roster.authors.map((a) => {
        const aff = a.affiliations.find((x) => x.isPrimary) ?? a.affiliations[0];
        return [
          String(a.sequence),
          a.givenName,
          a.middleName ?? '',
          a.familyName,
          a.email ?? '',
          a.orcid ?? '',
          a.isCorresponding ? 'yes' : 'no',
          aff?.institution ?? '',
          aff?.city ?? '',
          aff?.country ?? '',
        ];
      });
      return toCsv(headers, rows);
    },
    async importRoster(roster) {
      return this.save({
        ...roster,
        id: roster.id || crypto.randomUUID(),
        schemaVersion: ROSTER_SCHEMA_VERSION,
      });
    },
  };
}

export function createMemoryRosterStore(
  initial: Roster[] = [],
): RosterStore {
  return createRosterStore({ rosters: structuredClone(initial) });
}
