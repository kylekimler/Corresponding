import { describe, expect, it } from 'vitest';
import type { FillReport } from '@/adapters/types';
import {
  SECONDS_PER_AUTHOR,
  countFilledAuthors,
  countsTowardLifetime,
  formatFillDelight,
  formatLifetimeHours,
  formatSavedDuration,
} from '@/popup/timeSaved';
import { createMemoryLifetimeHoursStore } from '@/popup/lifetimeHours';

function reportForAuthors(count: number): FillReport {
  return {
    platformId: 'nature-mts',
    dryRun: false,
    overwrite: true,
    plans: Array.from({ length: count }, (_, i) => ({
      fieldId: `contrib_auth_${i + 1}_first_nm`,
      label: `Author ${i + 1} first name`,
      authorSequence: i + 1,
      action: 'fill' as const,
      proposedValue: `Given${i + 1}`,
    })),
    filled: count,
    preserved: 0,
    overwritten: 0,
    skippedConflicts: 0,
    missingSource: 0,
    unmapped: 0,
    warnings: [],
    errors: [],
  };
}

describe('time saved delight', () => {
  it('uses about 40 seconds per author', () => {
    expect(SECONDS_PER_AUTHOR).toBe(40);
    expect(formatFillDelight(73)).toBe(
      '73 authors filled. You just got 49 minutes of your life back.',
    );
  });

  it('keeps short fills in seconds and longer ones in minutes', () => {
    expect(formatFillDelight(1)).toBe(
      '1 author filled. You just got 40 seconds of your life back.',
    );
    expect(formatFillDelight(2)).toBe(
      '2 authors filled. You just got 1 minute of your life back.',
    );
    expect(formatSavedDuration(0)).toBe('0 seconds');
  });

  it('counts unique filled author sequences, not fields', () => {
    const report = reportForAuthors(3);
    report.plans.push({
      fieldId: 'contrib_auth_1_email',
      label: 'Author 1 email',
      authorSequence: 1,
      action: 'fill',
      proposedValue: 'a@example.org',
    });
    expect(countFilledAuthors(report)).toBe(3);
  });

  it('falls back to validation filledLike when plans have no author sequences', () => {
    expect(countFilledAuthors(reportForAuthors(0), 6)).toBe(6);
    expect(countFilledAuthors(reportForAuthors(0))).toBe(0);
    expect(formatFillDelight(0)).toBeUndefined();
  });

  it('formats the lifetime hours line with grouped digits', () => {
    expect(formatLifetimeHours(0)).toBe('Lifetime researcher hours saved: 0');
    expect(formatLifetimeHours(73)).toBe('Lifetime researcher hours saved: 0.8');
    expect(formatLifetimeHours(1_123_290)).toBe(
      'Lifetime researcher hours saved: 12,481',
    );
  });

  it('never counts example rosters or development fixtures toward lifetime hours', async () => {
    expect(
      countsTowardLifetime({
        rosterSource: 'csv',
        isDevelopmentFixture: false,
      }),
    ).toBe(true);
    expect(
      countsTowardLifetime({
        rosterSource: 'sample',
        isDevelopmentFixture: false,
      }),
    ).toBe(false);
    expect(
      countsTowardLifetime({
        rosterSource: 'csv',
        isDevelopmentFixture: true,
      }),
    ).toBe(false);

    const store = createMemoryLifetimeHoursStore();
    expect(await store.getAuthorsFilled()).toBe(0);
    // Practice fills are not recorded by the popup; the store only accepts
    // eligible increments.
    expect(await store.recordEligibleFill(0)).toBe(0);
    expect(await store.recordEligibleFill(73)).toBe(73);
    expect(await store.recordEligibleFill(2)).toBe(75);
  });
});
