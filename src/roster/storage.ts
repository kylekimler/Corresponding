import {
  ROSTER_SCHEMA_VERSION,
  RosterSchema,
  type Roster,
} from '@/schema/author';
import { toCsv } from '@/import/csv';

const STORAGE_KEY = 'journal_autofill_rosters_v1';
const QUARANTINE_KEY = 'journal_autofill_rosters_quarantine_v1';

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
  /** Opaque invalid documents preserved so they are never silently deleted. */
  listQuarantined(): Promise<QuarantinedRoster[]>;
}

export interface QuarantinedRoster {
  id: string;
  reason: string;
  quarantinedAt: string;
  raw: unknown;
}

type MemoryBucket = {
  rosters: Roster[];
  quarantine?: QuarantinedRoster[];
};

export interface MigrateRosterResult {
  roster: Roster | null;
  quarantined: boolean;
  reason?: string;
}

/**
 * Safely migrate a stored roster. Never silently wipe authors.
 * Invalid documents are quarantined (returned as null) rather than emptied.
 */
export function migrateRosterSafe(raw: unknown): MigrateRosterResult {
  const result = RosterSchema.safeParse({
    ...(typeof raw === 'object' && raw ? raw : {}),
    schemaVersion:
      typeof raw === 'object' &&
      raw &&
      'schemaVersion' in raw &&
      typeof (raw as { schemaVersion: unknown }).schemaVersion === 'number'
        ? (raw as { schemaVersion: number }).schemaVersion
        : ROSTER_SCHEMA_VERSION,
  });
  if (result.success) {
    return { roster: result.data, quarantined: false };
  }

  // Attempt author-level salvage: keep valid authors, drop invalid ones.
  if (raw && typeof raw === 'object' && Array.isArray((raw as { authors?: unknown }).authors)) {
    const base = raw as Record<string, unknown>;
    const authorsRaw = base.authors as unknown[];
    const salvaged = authorsRaw
      .map((a) => RosterSchema.shape.authors.element.safeParse(a))
      .filter((r) => r.success)
      .map((r) => r.data);

    if (salvaged.length > 0) {
      const repaired = RosterSchema.safeParse({
        id: typeof base.id === 'string' ? base.id : crypto.randomUUID(),
        name: typeof base.name === 'string' ? base.name : 'Repaired roster',
        authors: salvaged,
        schemaVersion: ROSTER_SCHEMA_VERSION,
        createdAt:
          typeof base.createdAt === 'string'
            ? base.createdAt
            : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: base.source ?? 'manual',
        projectMetadata: base.projectMetadata,
      });
      if (repaired.success) {
        return {
          roster: repaired.data,
          quarantined: false,
          reason: `Salvaged ${salvaged.length}/${authorsRaw.length} authors`,
        };
      }
    }
  }

  return {
    roster: null,
    quarantined: true,
    reason: result.error.issues.map((i) => i.message).join('; '),
  };
}

function quarantineId(raw: unknown): string {
  if (raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string') {
    return (raw as { id: string }).id;
  }
  return `unknown-${crypto.randomUUID()}`;
}

async function readRawList(
  area: chrome.storage.StorageArea | MemoryBucket,
): Promise<unknown[]> {
  if ('get' in area && typeof area.get === 'function') {
    const data = await area.get(STORAGE_KEY);
    return ((data[STORAGE_KEY] as unknown[]) ?? []);
  }
  return (area as MemoryBucket).rosters as unknown[];
}

async function readQuarantine(
  area: chrome.storage.StorageArea | MemoryBucket,
): Promise<QuarantinedRoster[]> {
  if ('get' in area && typeof area.get === 'function') {
    const data = await area.get(QUARANTINE_KEY);
    return ((data[QUARANTINE_KEY] as QuarantinedRoster[]) ?? []);
  }
  return (area as MemoryBucket).quarantine ?? [];
}

async function writeQuarantine(
  area: chrome.storage.StorageArea | MemoryBucket,
  items: QuarantinedRoster[],
): Promise<void> {
  if ('set' in area && typeof area.set === 'function') {
    await area.set({ [QUARANTINE_KEY]: items });
    return;
  }
  (area as MemoryBucket).quarantine = items;
}

async function readAll(
  area: chrome.storage.StorageArea | MemoryBucket,
): Promise<{ rosters: Roster[]; quarantine: QuarantinedRoster[] }> {
  const rawList = await readRawList(area);
  const existingQuarantine = await readQuarantine(area);
  const out: Roster[] = [];
  const quarantine = [...existingQuarantine];
  let quarantineChanged = false;

  for (const raw of rawList) {
    const migrated = migrateRosterSafe(raw);
    if (migrated.roster) {
      out.push(migrated.roster);
      continue;
    }
    const id = quarantineId(raw);
    if (!quarantine.some((q) => q.id === id)) {
      quarantine.push({
        id,
        reason: migrated.reason ?? 'Invalid roster document',
        quarantinedAt: new Date().toISOString(),
        raw,
      });
      quarantineChanged = true;
    }
  }

  if (quarantineChanged) {
    await writeQuarantine(area, quarantine);
  }

  return { rosters: out, quarantine };
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
      const { rosters } = await readAll(bucket);
      return rosters.sort((a, b) => a.name.localeCompare(b.name));
    },
    async get(id) {
      return (await readAll(bucket)).rosters.find((r) => r.id === id);
    },
    async listQuarantined() {
      return (await readAll(bucket)).quarantine;
    },
    async save(roster) {
      const parsed = RosterSchema.safeParse({
        ...roster,
        schemaVersion: ROSTER_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
      });
      if (!parsed.success) {
        throw new Error(
          `Refusing to save invalid roster: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
        );
      }
      const next = parsed.data;
      const { rosters: all } = await readAll(bucket);
      const idx = all.findIndex((r) => r.id === next.id);
      if (idx >= 0) all[idx] = next;
      else all.push(next);
      await writeAll(bucket, all);
      // Drop matching quarantine entry if a valid roster replaces it.
      const quarantine = (await readQuarantine(bucket)).filter((q) => q.id !== next.id);
      await writeQuarantine(bucket, quarantine);
      return next;
    },
    async rename(id, name) {
      const roster = await this.get(id);
      if (!roster) throw new Error(`Roster not found: ${id}`);
      return this.save({ ...roster, name });
    },
    async remove(id) {
      const { rosters: all } = await readAll(bucket);
      await writeAll(
        bucket,
        all.filter((r) => r.id !== id),
      );
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
