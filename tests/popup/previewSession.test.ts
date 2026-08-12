import { describe, expect, it } from 'vitest';
import type { FillReport } from '@/adapters/types';
import {
  createPreviewContext,
  previewMatchesContext,
  type PreviewSession,
  type TabTarget,
} from '@/popup/previewSession';

const report: FillReport = {
  platformId: 'nature-mts',
  dryRun: true,
  overwrite: false,
  plans: [],
  filled: 0,
  preserved: 0,
  overwritten: 0,
  skippedConflicts: 0,
  missingSource: 0,
  unmapped: 0,
  warnings: [],
  errors: [],
};

const roster = {
  id: 'roster-a',
  updatedAt: '2026-08-12T20:00:00.000Z',
};
const target: TabTarget = {
  tabId: 7,
  url: 'https://journal.example/submit',
};

function session(): PreviewSession {
  return {
    report,
    context: createPreviewContext(roster, false, target),
  };
}

describe('preview session validity', () => {
  it('matches only the roster version, overwrite setting, and exact tab target', () => {
    expect(previewMatchesContext(session(), roster, false, target)).toBe(true);
    expect(
      previewMatchesContext(
        session(),
        { ...roster, id: 'roster-b' },
        false,
        target,
      ),
    ).toBe(false);
    expect(
      previewMatchesContext(
        session(),
        { ...roster, updatedAt: '2026-08-12T20:01:00.000Z' },
        false,
        target,
      ),
    ).toBe(false);
    expect(previewMatchesContext(session(), roster, true, target)).toBe(false);
    expect(
      previewMatchesContext(session(), roster, false, { ...target, tabId: 8 }),
    ).toBe(false);
    expect(
      previewMatchesContext(session(), roster, false, {
        ...target,
        url: 'https://journal.example/review',
      }),
    ).toBe(false);
  });

  it('rejects absent and non-dry-run previews', () => {
    expect(previewMatchesContext(null, roster, false, target)).toBe(false);
    expect(
      previewMatchesContext(
        { ...session(), report: { ...report, dryRun: false } },
        roster,
        false,
        target,
      ),
    ).toBe(false);
  });
});
