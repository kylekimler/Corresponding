import { describe, expect, it } from 'vitest';
import type { FillReport } from '@/adapters/types';
import {
  auditRecordFromFillReport,
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
  it('records aggregate counts without PII from fill reports', async () => {
    const log = createMemoryAuditLog();
    const report = sampleFillReportWithEmails();
    const record = auditRecordFromFillReport(report, 'roster-uuid-1');

    await log.append(record);
    const entries = await log.list();

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
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

  it('rejects records containing email-like strings', () => {
    expect(() =>
      createMemoryAuditLog([
        {
          timestamp: new Date().toISOString(),
          portalFamily: 'nature-mts',
          rosterId: 'bad@email.com',
          fieldsProposed: 0,
          filled: 0,
          preserved: 0,
          unresolved: 0,
          conflicts: 0,
        },
      ]),
    ).toThrow(/email-like/i);
  });

  it('supports list, append, and clear', async () => {
    const log = createMemoryAuditLog();
    const record = auditRecordFromFillReport(
      sampleFillReportWithEmails(),
      'roster-abc',
    );
    await log.append(record);
    expect(await log.list()).toHaveLength(1);
    await log.clear();
    expect(await log.list()).toHaveLength(0);
  });
});
