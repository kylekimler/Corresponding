import { describe, expect, it } from 'vitest';
import type { FillReport } from '@/adapters/types';
import { natureMtsAdapter } from '@/adapters/nature-mts/adapter';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { summarizePreview } from '@/popup/previewSummary';
import { makeNAuthors, makeRoster } from '../helpers/roster';

describe('preview summary + no DOM mutation', () => {
  it('summarizes portal mappings and proves dry-run does not mutate', () => {
    mountNatureMtsFixture({ slots: 3 });
    const before = document.body.innerHTML;
    const roster = makeRoster(makeNAuthors(3));
    const detect = natureMtsAdapter.detect(document);
    const report = natureMtsAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: true,
    });
    expect(document.body.innerHTML).toBe(before);
    expect(report.dryRun).toBe(true);

    const summary = summarizePreview(report, detect);
    expect(summary.headline).toMatch(/Preview ready/i);
    expect(summary.portalLabel).toMatch(/Nature/i);
    expect(summary.totalMappings).toBeGreaterThan(0);
    expect(summary.exactMappings).toBeGreaterThan(0);
    expect(summary.dryRun).toBe(true);
    expect(summary.filled + summary.overwritten).toBeGreaterThan(0);
    expect(summary.authorGroups).toHaveLength(3);
    expect(
      summary.authorGroups.every(
        (group) => group.selectorConfidence === 'exact',
      ),
    ).toBe(true);
    expect(
      summary.authorGroups.some(
        (group) => group.completeness === 'needs-attention',
      ),
    ).toBe(true);
  });

  it('labels semantic and unresolved author blocks without promoting confidence', () => {
    const report: FillReport = {
      platformId: 'unknown',
      dryRun: true,
      overwrite: false,
      plans: [
        {
          fieldId: 'author-1-given',
          label: 'Author 1 given name',
          authorSequence: 1,
          action: 'fill',
          proposedValue: 'Ada',
        },
        {
          fieldId: 'author-2-email',
          label: 'Author 2 email',
          authorSequence: 2,
          action: 'unmapped',
          reason: 'Low confidence',
        },
      ],
      filled: 1,
      preserved: 0,
      overwritten: 0,
      skippedConflicts: 0,
      missingSource: 0,
      unmapped: 1,
      warnings: [],
      errors: [],
    };

    const summary = summarizePreview(report);
    expect(summary.authorGroups).toEqual([
      expect.objectContaining({
        authorSequence: 1,
        selectorConfidence: 'semantic',
        completeness: 'complete',
      }),
      expect.objectContaining({
        authorSequence: 2,
        selectorConfidence: 'unresolved',
        completeness: 'needs-attention',
        unresolved: 1,
      }),
    ]);
  });

  it('separates exact selector confidence from incomplete author data', () => {
    const report: FillReport = {
      platformId: 'nature-mts',
      dryRun: true,
      overwrite: false,
      plans: [
        {
          fieldId: 'contrib_auth_1_first_nm',
          label: 'Author 1 given name',
          authorSequence: 1,
          action: 'fill',
          proposedValue: 'Ada',
        },
        {
          fieldId: 'contrib_auth_1_email',
          label: 'Author 1 email',
          authorSequence: 1,
          action: 'missing_source',
          reason: 'Roster email is missing',
        },
      ],
      filled: 1,
      preserved: 0,
      overwritten: 0,
      skippedConflicts: 0,
      missingSource: 1,
      unmapped: 0,
      warnings: [],
      errors: [],
    };

    expect(summarizePreview(report).authorGroups[0]).toEqual(
      expect.objectContaining({
        selectorConfidence: 'exact',
        completeness: 'needs-attention',
        unresolved: 1,
      }),
    );
  });

  it('keeps DOM frozen across 75-author preview', () => {
    mountNatureMtsFixture({ slots: 75 });
    const roster = makeRoster(makeNAuthors(75));
    const first = () =>
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement)
        .value;
    expect(first()).toBe('');
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: true });
    expect(first()).toBe('');
    expect(
      (document.getElementById('contrib_auth_75_last_nm') as HTMLInputElement)
        .value,
    ).toBe('');
  });
});
