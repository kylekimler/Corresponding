import { describe, expect, it } from 'vitest';
import type { FillReport } from '@/adapters/types';
import {
  auditRecordFromFillReport,
  createChromeAuditLog,
  createMemoryAuditLog,
  serializedAuditHasNoEmailLikeContent,
} from '@/audit/localLog';

function sampleFillReportWithEmails(): FillReport {
  return {
    platformId: 'nature-mts',
    dryRun: false,
    overwrite: false,
    plans: [
      {
        fieldId: 'contrib_auth_1_email',
        label: 'Author 1 email',
        authorSequence: 1,
        action: 'fill',
        currentValue: '',
        proposedValue: 'secret.author@university.edu',
        reason: 'from roster',
      },
      {
        fieldId: 'contrib_auth_1_first_nm',
        label: 'Author 1 first name',
        authorSequence: 1,
        action: 'fill',
        currentValue: '',
        proposedValue: 'Ada',
      },
      {
        fieldId: 'contrib_auth_2_email',
        label: 'Author 2 email',
        authorSequence: 2,
        action: 'skip_conflict',
        currentValue: 'existing@portal.org',
        proposedValue: 'other@example.org',
      },
      {
        fieldId: 'unmapped_field',
        label: 'Unknown',
        action: 'unmapped',
      },
    ],
    filled: 2,
    preserved: 1,
    overwritten: 0,
    skippedConflicts: 1,
    missingSource: 1,
    unmapped: 1,
    warnings: ['Author 1 missing ORCID'],
    errors: [],
  };
}

describe('local audit log', () => {
  it('stores counts without PII fields', async () => {
    const log = createMemoryAuditLog();
    const entry = await log.append({
      portalFamily: 'nature-mts',
      rosterId: 'roster-123',
      fieldsProposed: 40,
      filled: 32,
      preserved: 5,
      unresolved: 2,
      conflicts: 1,
    });
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toMatch(/@[a-z]/i);
    expect(serialized).not.toContain('password');
    expect(entry.filled).toBe(32);
    await log.clear();
    expect(await log.list()).toHaveLength(0);
  });

  it('records aggregate counts without PII from fill reports', async () => {
    const log = createMemoryAuditLog();
    const report = sampleFillReportWithEmails();
    const partial = auditRecordFromFillReport(report, 'roster-uuid-1');
    const entry = await log.append(partial);
    const entries = await log.list();

    expect(entries).toHaveLength(1);
    expect(entry).toMatchObject({
      operation: 'fill',
      portalFamily: 'nature-mts',
      rosterId: 'roster-uuid-1',
      fieldsProposed: 2,
      filled: 2,
      preserved: 1,
      unresolved: 2,
      conflicts: 1,
    });

    const serialized = JSON.stringify(entries);
    expect(serialized).not.toMatch(/@/);
    expect(serialized).not.toContain('Ada');
    expect(serialized).not.toContain('secret.author');
    expect(serializedAuditHasNoEmailLikeContent(entries)).toBe(true);
  });

  it('persists counts across Chrome audit log instances and stays clearable', async () => {
    const data: Record<string, unknown> = {};
    const area = {
      async get(key: string) {
        return { [key]: data[key] };
      },
      async set(items: Record<string, unknown>) {
        Object.assign(data, items);
      },
    };
    const report = sampleFillReportWithEmails();
    report.dryRun = true;

    const first = createChromeAuditLog(area);
    await first.append(auditRecordFromFillReport(report, 'roster-local-only'));

    const reopened = createChromeAuditLog(area);
    expect(await reopened.list()).toEqual([
      expect.objectContaining({
        operation: 'preview',
        rosterId: 'roster-local-only',
        fieldsProposed: 2,
      }),
    ]);
    expect(JSON.stringify(await reopened.list())).not.toContain(
      'secret.author@university.edu',
    );

    await reopened.clear();
    expect(await createChromeAuditLog(area).list()).toEqual([]);
  });

  it('rejects entries containing email-like strings in rosterId', async () => {
    const log = createMemoryAuditLog();
    await expect(
      log.append({
        portalFamily: 'nature-mts',
        rosterId: 'bad@email.com',
        fieldsProposed: 0,
        filled: 0,
        preserved: 0,
        unresolved: 0,
        conflicts: 0,
      }),
    ).rejects.toThrow(/email-like/i);
  });
});
