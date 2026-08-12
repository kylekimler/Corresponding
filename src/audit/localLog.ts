/**
 * Optional local-only operation log.
 * Never records author names, emails, manuscript text, form values, cookies, or credentials.
 */

import type { FillReport } from '@/adapters/types';

const STORAGE_KEY = 'corresponding_audit_log_v1';

/** Matches common email patterns for redaction checks. */
const EMAIL_LIKE_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export interface AuditEntry {
  id: string;
  timestamp: string;
  operation?: 'preview' | 'fill';
  portalFamily: string;
  rosterId: string;
  fieldsProposed: number;
  filled: number;
  preserved: number;
  unresolved: number;
  conflicts: number;
}

export interface AuditLog {
  list(): Promise<AuditEntry[]>;
  append(entry: Omit<AuditEntry, 'id' | 'timestamp'> & { timestamp?: string }): Promise<AuditEntry>;
  clear(): Promise<void>;
}

function assertNoPii(entry: AuditEntry): void {
  const blob = JSON.stringify(entry);
  if (EMAIL_LIKE_RE.test(blob)) {
    throw new Error('Audit log refused to store email-like content');
  }
  if (/password|cookie|csrf|bearer\s/i.test(blob)) {
    throw new Error('Audit log refused to store credential-like content');
  }
}

/**
 * Build a privacy-safe audit entry from a fill report.
 * Only aggregate counts are stored — never names, emails, or field values.
 */
export function auditRecordFromFillReport(
  report: FillReport,
  rosterId: string,
  portalFamily: string = report.platformId,
  operation: 'preview' | 'fill' = report.dryRun ? 'preview' : 'fill',
): Omit<AuditEntry, 'id' | 'timestamp'> {
  const fieldsProposed = report.plans.filter(
    (p) => p.action === 'fill' || p.action === 'overwrite',
  ).length;

  return {
    operation,
    portalFamily,
    rosterId,
    fieldsProposed,
    filled: report.filled,
    preserved: report.preserved,
    unresolved: report.missingSource + report.unmapped,
    conflicts: report.skippedConflicts,
  };
}

/** For tests: verify serialized audit output contains no email-like substrings. */
export function serializedAuditHasNoEmailLikeContent(
  entries: AuditEntry[],
): boolean {
  return !EMAIL_LIKE_RE.test(JSON.stringify(entries));
}

export function createMemoryAuditLog(initial: AuditEntry[] = []): AuditLog {
  let entries = [...initial];
  return {
    async list() {
      return [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    },
    async append(partial) {
      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        timestamp: partial.timestamp ?? new Date().toISOString(),
        operation: partial.operation,
        portalFamily: partial.portalFamily,
        rosterId: partial.rosterId,
        fieldsProposed: partial.fieldsProposed,
        filled: partial.filled,
        preserved: partial.preserved,
        unresolved: partial.unresolved,
        conflicts: partial.conflicts,
      };
      assertNoPii(entry);
      entries = [entry, ...entries].slice(0, 200);
      return entry;
    },
    async clear() {
      entries = [];
    },
  };
}

type StorageLike = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

export function createChromeAuditLog(area?: StorageLike): AuditLog {
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
    async list() {
      const data = await store.get(STORAGE_KEY);
      return ((data[STORAGE_KEY] as AuditEntry[]) ?? []).slice();
    },
    async append(partial) {
      const entry: AuditEntry = {
        id: crypto.randomUUID(),
        timestamp: partial.timestamp ?? new Date().toISOString(),
        operation: partial.operation,
        portalFamily: partial.portalFamily,
        rosterId: partial.rosterId,
        fieldsProposed: partial.fieldsProposed,
        filled: partial.filled,
        preserved: partial.preserved,
        unresolved: partial.unresolved,
        conflicts: partial.conflicts,
      };
      assertNoPii(entry);
      const current = await this.list();
      await store.set({ [STORAGE_KEY]: [entry, ...current].slice(0, 200) });
      return entry;
    },
    async clear() {
      await store.set({ [STORAGE_KEY]: [] });
    },
  };
}
