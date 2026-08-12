import { describe, expect, it } from 'vitest';
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
