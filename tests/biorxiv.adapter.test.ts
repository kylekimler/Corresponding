import { describe, expect, it, vi } from 'vitest';
import { biorxivAdapter } from '@/adapters/biorxiv/adapter';
import { mountBiorxivFixture } from '@/adapters/biorxiv/fixture';
import { isForbiddenControl } from '@/adapters/safety';
import { makeNAuthors, makeRoster } from './helpers/roster';

describe('bioRxiv repeated author dialog adapter', () => {
  it('detects the captured author-entry structure', () => {
    mountBiorxivFixture();
    const result = biorxivAdapter.detect(document);
    expect(result.platformId).toBe('biorxiv');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.evidence).toEqual(
      expect.arrayContaining(['submission_form', 'CA_continue', 'Add Author']),
    );
  });

  it('previews every author without opening or saving a dialog', () => {
    const harness = mountBiorxivFixture();
    const roster = makeRoster(makeNAuthors(3));
    const before = document.body.innerHTML;

    const preview = biorxivAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: true,
    });

    expect(preview.errors).toEqual([]);
    expect(preview.dryRun).toBe(true);
    expect(preview.plans.some((plan) => plan.authorSequence === 3)).toBe(true);
    expect(document.body.innerHTML).toBe(before);
    expect(harness.addClicks()).toBe(0);
    expect(harness.saveClicks()).toBe(0);
  });

  it('opens, fills, and saves exactly one dialog per author', async () => {
    const harness = mountBiorxivFixture();
    const roster = makeRoster(makeNAuthors(3, { correspondingIndex: 2 }));

    const report = await biorxivAdapter.fillAsync!(
      document,
      roster,
      { overwrite: false, dryRun: false },
    );

    expect(report.errors).toEqual([]);
    expect(harness.addClicks()).toBe(3);
    expect(harness.saveClicks()).toBe(3);
    expect(harness.continueClicks()).toBe(0);
    expect(harness.savedAuthors()).toEqual([
      expect.objectContaining({
        email: 'author1@example.org',
        firstName: 'Given1',
        lastName: 'Family1',
        affiliation: 'Inst 1',
        corresponding: false,
      }),
      expect.objectContaining({
        email: 'author2@example.org',
        firstName: 'Given2',
        corresponding: false,
      }),
      expect.objectContaining({
        email: 'author3@example.org',
        firstName: 'Given3',
        corresponding: true,
      }),
    ]);
    expect(biorxivAdapter.validate(document, roster)).toEqual(
      expect.objectContaining({
        ok: true,
        summary: expect.objectContaining({
          filledLike: 3,
          mismatchedCount: 0,
        }),
      }),
    );
  });

  it('uses an already-open empty dialog for the first author', async () => {
    const harness = mountBiorxivFixture({ dialogOpen: true });
    await biorxivAdapter.fillAsync!(
      document,
      makeRoster(makeNAuthors(2)),
      { overwrite: false, dryRun: false },
    );
    expect(harness.addClicks()).toBe(1);
    expect(harness.saveClicks()).toBe(2);
  });

  it('refuses to append when bioRxiv already contains authors', async () => {
    const harness = mountBiorxivFixture({ existingAuthors: 1 });
    const report = await biorxivAdapter.fillAsync!(
      document,
      makeRoster(makeNAuthors(2)),
      { overwrite: false, dryRun: false },
    );
    expect(report.errors.join(' ')).toMatch(/already contains 1 author/i);
    expect(harness.addClicks()).toBe(0);
    expect(harness.saveClicks()).toBe(0);
  });

  it('preflights required data before any mutation', async () => {
    const harness = mountBiorxivFixture();
    const authors = makeNAuthors(2);
    authors[1]!.email = undefined;
    const report = await biorxivAdapter.fillAsync!(
      document,
      makeRoster(authors),
      { overwrite: false, dryRun: false },
    );
    expect(report.errors.join(' ')).toMatch(/Author 2 is missing Email/);
    expect(harness.addClicks()).toBe(0);
    expect(harness.saveClicks()).toBe(0);
  });

  it('never clicks page continuation or any submit control', async () => {
    const harness = mountBiorxivFixture();
    const continuation = document.querySelector(
      'input[name="CA_continue"]',
    )!;
    expect(isForbiddenControl(continuation)).toBe(true);
    const clickSpy = vi.spyOn(continuation as HTMLElement, 'click');

    await biorxivAdapter.fillAsync!(
      document,
      makeRoster(makeNAuthors(1)),
      { overwrite: false, dryRun: false },
    );

    expect(clickSpy).not.toHaveBeenCalled();
    expect(harness.continueClicks()).toBe(0);
  });
});
