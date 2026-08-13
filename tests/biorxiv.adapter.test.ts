import { describe, expect, it, vi } from 'vitest';
import { biorxivAdapter } from '@/adapters/biorxiv/adapter';
import { mountBiorxivFixture } from '@/adapters/biorxiv/fixture';
import { isForbiddenControl } from '@/adapters/safety';
import { makeNAuthors, makeRoster } from './helpers/roster';

const normalizeText = (value: string | null | undefined) =>
  (value ?? '').replace(/\s+/g, ' ').trim();

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
    const harness = mountBiorxivFixture({
      addRemountDelayMs: 20,
      addLabelAfterSave: 'Add Another Author',
    });
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
    expect(report.errors.join(' ')).toMatch(/already lists 1 author/i);
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

  it('finds Add Author when a Material icon ligature precedes the label', async () => {
    const harness = mountBiorxivFixture({
      addIconLigature: 'person_add',
      addRemountDelayMs: 20,
      addLabelAfterSave: 'Add Another Author',
    });

    const report = await biorxivAdapter.fillAsync!(
      document,
      makeRoster(makeNAuthors(3)),
      { overwrite: false, dryRun: false },
    );

    expect(report.errors).toEqual([]);
    expect(harness.addClicks()).toBe(3);
    expect(harness.savedAuthors()).toHaveLength(3);
  });

  it('ignores a hidden decoy Add Author inside a closed dialog', async () => {
    const harness = mountBiorxivFixture({
      addIconLigature: 'person_add',
      hiddenDecoyAddButton: true,
    });
    const decoy = document.getElementById('decoy-add-author') as HTMLElement;
    const decoyClicks = vi.spyOn(decoy, 'click');

    await biorxivAdapter.fillAsync!(document, makeRoster(makeNAuthors(2)), {
      overwrite: false,
      dryRun: false,
    });

    expect(decoyClicks).not.toHaveBeenCalled();
    expect(harness.savedAuthors()).toHaveLength(2);
  });

  it('does not carry a previous author into a reused dialog', async () => {
    const harness = mountBiorxivFixture({ staleValuesOnReopen: true });
    const authors = makeNAuthors(3);
    authors[0]!.middleName = 'Mathison';

    const report = await biorxivAdapter.fillAsync!(
      document,
      makeRoster(authors),
      { overwrite: false, dryRun: false },
    );

    expect(report.errors).toEqual([]);
    const saved = harness.savedAuthors();
    expect(saved.map((author) => author.firstName)).toEqual([
      'Given1',
      'Given2',
      'Given3',
    ]);
    expect(saved.map((author) => author.email)).toEqual([
      'author1@example.org',
      'author2@example.org',
      'author3@example.org',
    ]);
    // Author 1's middle name must not leak into authors 2 and 3.
    expect(saved.map((author) => author.middleName)).toEqual([
      'Mathison',
      '',
      '',
    ]);
  });

  it('survives an asynchronous dialog reset after reopening', async () => {
    const harness = mountBiorxivFixture({ resetDelayMs: 60 });

    await biorxivAdapter.fillAsync!(document, makeRoster(makeNAuthors(2)), {
      overwrite: false,
      dryRun: false,
    });

    expect(harness.savedAuthors().map((author) => author.lastName)).toEqual([
      'Family1',
      'Family2',
    ]);
  });

  it('refuses to save a dialog that rejects roster values', async () => {
    const harness = mountBiorxivFixture();
    const firstName = document.querySelector(
      'input[name="firstName"]',
    ) as HTMLInputElement;
    // Simulate a portal that discards programmatic input.
    Object.defineProperty(firstName, 'value', {
      get: () => '',
      set: () => {},
      configurable: true,
    });

    await expect(
      biorxivAdapter.fillAsync!(document, makeRoster(makeNAuthors(1)), {
        overwrite: false,
        dryRun: false,
      }),
    ).rejects.toThrow(/did not accept the roster value/i);
    expect(harness.saveClicks()).toBe(0);
  });

  it('waits for each author to be committed before adding the next', async () => {
    const harness = mountBiorxivFixture({
      commitDelayMs: 150,
      errorOnEarlyAdd: true,
      addIconLigature: 'person_add',
    });

    const report = await biorxivAdapter.fillAsync!(
      document,
      makeRoster(makeNAuthors(3)),
      { overwrite: false, dryRun: false },
    );

    expect(report.errors).toEqual([]);
    expect(harness.savedAuthors().map((author) => author.firstName)).toEqual([
      'Given1',
      'Given2',
      'Given3',
    ]);
    expect(
      normalizeText(document.getElementById('portal-error')?.textContent),
    ).toBe('');
  });

  it('confirms commits past a hidden import-preview table', async () => {
    const harness = mountBiorxivFixture({
      hiddenImportTable: true,
      rowActionControls: true,
      commitDelayMs: 120,
      errorOnEarlyAdd: true,
      addIconLigature: 'person_add',
    });

    const report = await biorxivAdapter.fillAsync!(
      document,
      makeRoster(makeNAuthors(3)),
      { overwrite: false, dryRun: false },
    );

    expect(report.errors).toEqual([]);
    expect(harness.savedAuthors()).toHaveLength(3);
    expect(report.warnings.join(' ')).not.toMatch(/Could not read/i);
  });

  // Exercises the deliberate slow path: full confirm timeout, then settle.
  it('continues when the author list cannot be counted at all', async () => {
    const harness = mountBiorxivFixture();
    // Author rows render somewhere Corresponding cannot count.
    document.getElementById('author-rows')!.remove();

    const report = await biorxivAdapter.fillAsync!(
      document,
      makeRoster(makeNAuthors(1)),
      { overwrite: false, dryRun: false },
    );

    expect(report.errors).toEqual([]);
    expect(harness.savedAuthors()).toHaveLength(1);
    expect(report.warnings.join(' ')).toMatch(
      /Could not read bioRxiv's author list for 1 of 1/i,
    );
  }, 15_000);

  it('re-enters an author when a late re-render wipes the dialog', async () => {
    const harness = mountBiorxivFixture({
      lateResetMs: 120,
      wipeOnFirstSave: true,
      validateOnSave: true,
      rowActionControls: true,
    });

    const report = await biorxivAdapter.fillAsync!(
      document,
      makeRoster(makeNAuthors(2)),
      { overwrite: false, dryRun: false },
    );

    expect(report.errors).toEqual([]);
    expect(harness.savedAuthors().map((author) => author.firstName)).toEqual([
      'Given1',
      'Given2',
    ]);
    // The wiped attempt was retried rather than saved empty.
    expect(harness.saveClicks()).toBeGreaterThan(2);
  });

  it('stops and surfaces a bioRxiv error banner instead of continuing', async () => {
    const harness = mountBiorxivFixture({ commitDelayMs: 50 });
    const banner = document.getElementById('portal-error')!;
    document.getElementById('save-author')!.addEventListener('click', () => {
      banner.textContent = 'Author does not exists hash do not match';
      banner.style.display = 'block';
    });

    await expect(
      biorxivAdapter.fillAsync!(document, makeRoster(makeNAuthors(3)), {
        overwrite: false,
        dryRun: false,
      }),
    ).rejects.toThrow(/Author does not exists hash do not match/i);
    expect(harness.addClicks()).toBe(1);
  });

  it('explains how to recover when authors already exist', () => {
    mountBiorxivFixture({ existingAuthors: 3 });
    const report = biorxivAdapter.fill(document, makeRoster(makeNAuthors(2)), {
      overwrite: false,
      dryRun: true,
    });
    expect(report.errors.join(' ')).toMatch(
      /already lists 3 authors.*Delete controls/i,
    );
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
