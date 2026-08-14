import { describe, expect, it } from 'vitest';
import { scholarOneAdapter } from '@/adapters/scholarone/adapter';
import { mountScholarOneFixture } from '@/adapters/scholarone/fixture';
import { isForbiddenControl } from '@/adapters/safety';
import { makeAuthor, makeNAuthors, makeRoster } from './helpers/roster';

describe('ScholarOne capture-backed adapter (Bioinformatics)', () => {
  it('detects Manuscript Central author-entry ids from the capture', () => {
    mountScholarOneFixture({ formOpen: true });
    const result = scholarOneAdapter.detect(document);
    expect(result.platformId).toBe('scholarone');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        'findAuthorEmailId',
        'searchAuthorId',
        'manuscriptcentral',
      ]),
    );
  });

  it('previews every author without searching or committing', () => {
    const harness = mountScholarOneFixture();
    const roster = makeRoster(makeNAuthors(3));
    const before = document.body.innerHTML;

    const preview = scholarOneAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: true,
    });

    expect(preview.errors).toEqual([]);
    expect(preview.dryRun).toBe(true);
    expect(preview.plans.some((plan) => plan.authorSequence === 3)).toBe(true);
    expect(
      preview.plans.some(
        (plan) =>
          plan.fieldId.endsWith('.institution') && plan.action === 'unmapped',
      ),
    ).toBe(true);
    expect(document.body.innerHTML).toBe(before);
    expect(harness.searchClicks()).toBe(0);
    expect(harness.addAuthorClicks()).toBe(0);
    expect(harness.submitClicks()).toBe(0);
  });

  it('email-looks-up, creates, and commits one author at a time', async () => {
    const harness = mountScholarOneFixture({ emailLookupMs: 20 });
    const roster = makeRoster(makeNAuthors(3, { correspondingIndex: 2 }));

    const report = await scholarOneAdapter.fillAsync!(document, roster, {
      overwrite: false,
      dryRun: false,
    });

    expect(report.errors).toEqual([]);
    expect(harness.searchClicks()).toBe(3);
    expect(harness.modalYesClicks()).toBe(3);
    expect(harness.submitClicks()).toBe(0);
    expect(harness.namesWrittenDuringLookup()).toBe(0);
    expect(harness.savedAuthors()).toEqual([
      expect.objectContaining({
        email: 'author1@example.org',
        firstName: 'Given1',
        lastName: 'Family1',
        city: 'City1',
        country: 'United States',
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
    expect(scholarOneAdapter.validate(document, roster)).toEqual(
      expect.objectContaining({
        ok: true,
        summary: expect.objectContaining({
          filledLike: 3,
          mismatchedCount: 0,
        }),
      }),
    );
  });

  it('uses an already-open add form for the first author', async () => {
    const harness = mountScholarOneFixture({ formOpen: true, emailLookupMs: 10 });
    await scholarOneAdapter.fillAsync!(
      document,
      makeRoster(makeNAuthors(2)),
      { overwrite: false, dryRun: false },
    );
    expect(harness.addAuthorClicks()).toBe(1);
    expect(harness.searchClicks()).toBe(2);
    expect(harness.savedAuthors()).toHaveLength(2);
  });

  it('keeps roster values when email search matches a linked account with the same identity', async () => {
    const harness = mountScholarOneFixture({
      emailLookupMs: 15,
      directory: {
        'author1@example.org': {
          firstName: 'Given1',
          lastName: 'Family1',
          city: 'Portal City',
          country: 'Germany',
        },
      },
    });
    const roster = makeRoster(makeNAuthors(1));

    await scholarOneAdapter.fillAsync!(document, roster, {
      overwrite: true,
      dryRun: false,
    });

    expect(harness.modalYesClicks()).toBe(0);
    expect(harness.savedAuthors()[0]).toEqual(
      expect.objectContaining({
        firstName: 'Given1',
        lastName: 'Family1',
        city: 'City1',
        country: 'United States',
      }),
    );
  });

  it('refuses to overwrite a conflicting linked ScholarOne account', async () => {
    mountScholarOneFixture({
      emailLookupMs: 15,
      directory: {
        'author1@example.org': {
          firstName: 'Other',
          lastName: 'Person',
          city: 'Portal City',
        },
      },
    });
    const roster = makeRoster(makeNAuthors(1));

    await expect(
      scholarOneAdapter.fillAsync!(document, roster, {
        overwrite: true,
        dryRun: false,
      }),
    ).rejects.toThrow(/conflicts with the roster/i);
  });

  it('refuses fill when required email is missing', () => {
    mountScholarOneFixture();
    const authors = makeNAuthors(1);
    authors[0]!.email = undefined;
    const report = scholarOneAdapter.fill(document, makeRoster(authors), {
      overwrite: false,
      dryRun: true,
    });
    expect(report.errors.some((error) => /missing Email/i.test(error))).toBe(
      true,
    );
  });

  it('never treats Save and Continue as a safe control', () => {
    mountScholarOneFixture({ formOpen: true });
    const submit = document.getElementById('btnSubmit');
    expect(submit).toBeTruthy();
    expect(isForbiddenControl(submit!)).toBe(true);
  });

  it('appends after existing authors without touching submit', async () => {
    const harness = mountScholarOneFixture({
      emailLookupMs: 10,
      existingAuthors: [
        {
          email: 'existing@example.org',
          firstName: 'Existing',
          lastName: 'Author',
          department: '',
          city: 'Boston',
          state: 'MA',
          country: 'United States',
          phone: '',
          corresponding: true,
        },
      ],
    });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'New',
        familyName: 'Person',
        email: 'new@example.org',
        sequence: 1,
        affiliations: [
          {
            institution: 'Inst',
            city: 'Cambridge',
            country: 'United States',
            isPrimary: true,
          },
        ],
      }),
    ]);

    await scholarOneAdapter.fillAsync!(document, roster, {
      overwrite: false,
      dryRun: false,
    });

    expect(harness.savedAuthors()).toHaveLength(2);
    expect(harness.savedAuthors()[1]).toEqual(
      expect.objectContaining({
        email: 'new@example.org',
        firstName: 'New',
        lastName: 'Person',
      }),
    );
    expect(harness.submitClicks()).toBe(0);
  });
});
