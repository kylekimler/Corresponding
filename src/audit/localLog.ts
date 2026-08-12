import type { FillReport } from '@/adapters/types';

const STORAGE_KEY = 'journal_autofill_audit_v1';

/** Matches common email patterns for redaction checks. */
const EMAIL_LIKE_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export interface AuditRecord {
  timestamp: string;
  portalFamily: string;
  rosterId: string;
  fieldsProposed: number;
  filled: number;
  preserved: number;
  unresolved: number;
  conflicts: number;
}

export interface LocalAuditLog {
  list(): Promise<AuditRecord[]>;
  append(record: AuditRecord): Promise<void>;
  clear(): Promise<void>;
}

type MemoryBucket = { records: AuditRecord[] };

function assertNoSensitiveContent(record: AuditRecord): void {
  const serialized = JSON.stringify(record);
  if (EMAIL_LIKE_RE.test(serialized)) {
    throw new Error('Audit record must not contain email-like strings');
  }
}

function sanitizeRecord(record: AuditRecord): AuditRecord {
  const safe: AuditRecord = {
    timestamp: record.timestamp,
    portalFamily: record.portalFamily,
    rosterId: record.rosterId,
    fieldsProposed: record.fieldsProposed,
    filled: record.filled,
    preserved: record.preserved,
    unresolved: record.unresolved,
    conflicts: record.conflicts,
  };
  assertNoSensitiveContent(safe);
  return safe;
}

/**
 * Build a privacy-safe audit record from a fill report.
 * Only aggregate counts are stored — never names, emails, or field values.
 */
export function auditRecordFromFillReport(
  report: FillReport,
  rosterId: string,
  portalFamily: string = report.platformId,
): AuditRecord {
  const fieldsProposed = report.plans.filter(
    (p) => p.action === 'fill' || p.action === 'overwrite',
  ).length;

  return sanitizeRecord({
    timestamp: new Date().toISOString(),
    portalFamily,
    rosterId,
    fieldsProposed,
    filled: report.filled,
    preserved: report.preserved,
    unresolved: report.missingSource + report.unmapped,
    conflicts: report.skippedConflicts,
  });
}

async function readAll(
  area: chrome.storage.StorageArea | MemoryBucket,
): Promise<AuditRecord[]> {
  if ('get' in area && typeof area.get === 'function') {
    const data = await area.get(STORAGE_KEY);
    const list = (data[STORAGE_KEY] as AuditRecord[]) ?? [];
    return list.map(sanitizeRecord);
  }
  return (area as MemoryBucket).records.map(sanitizeRecord);
}

async function writeAll(
  area: chrome.storage.StorageArea | MemoryBucket,
  records: AuditRecord[],
): Promise<void> {
  if ('set' in area && typeof area.set === 'function') {
    await area.set({ [STORAGE_KEY]: records });
    return;
  }
  (area as MemoryBucket).records = records;
}

export function createLocalAuditLog(
  area?: chrome.storage.StorageArea | MemoryBucket,
): LocalAuditLog {
  const bucket: chrome.storage.StorageArea | MemoryBucket =
    area ??
    (typeof chrome !== 'undefined' && chrome.storage?.local
      ? chrome.storage.local
      : { records: [] });

  return {
    async list() {
      return readAll(bucket);
    },
    async append(record) {
      const safe = sanitizeRecord(record);
      const all = await readAll(bucket);
      all.push(safe);
      await writeAll(bucket, all);
    },
    async clear() {
      await writeAll(bucket, []);
    },
  };
}

export function createMemoryAuditLog(
  initial: AuditRecord[] = [],
): LocalAuditLog {
  return createLocalAuditLog({
    records: initial.map(sanitizeRecord),
  });
}

/** For tests: verify serialized audit output contains no email-like substrings. */
export function serializedAuditHasNoEmailLikeContent(
  records: AuditRecord[],
): boolean {
  return !EMAIL_LIKE_RE.test(JSON.stringify(records));
}
