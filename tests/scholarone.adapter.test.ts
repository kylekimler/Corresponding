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
    // The 2026-08-17 capture exposed AUTHOR_INSTITUTION_1, so institution is
    // now written rather than left for manual entry.
    expect(
      preview.plans.some(
        (plan) =>
          plan.fieldId.endsWith('.institution') && plan.action === 'fill',
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
        namePrefix: 'Dr.',
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

  it('dismisses Institution not connected to Ringgold with OKAY and still commits', async () => {
    const harness = mountScholarOneFixture({
      emailLookupMs: 10,
      ringgoldOnInstitution: true,
    });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        namePrefix: 'Dr.',
        email: 'ada@example.org',
        sequence: 1,
        affiliations: [
          {
            institution: 'Analytical Engines Institute',
            city: 'London',
            country: 'United Kingdom',
            isPrimary: true,
          },
        ],
      }),
    ]);

    const report = await scholarOneAdapter.fillAsync!(document, roster, {
      overwrite: true,
      dryRun: false,
    });

    console.log('ScholarOne Ringgold OKAY', {
      errors: report.errors,
      warnings: report.warnings,
      okayClicks: harness.ringgoldOkayClicks(),
      errorCloseClicks: harness.errorCloseClicks(),
      saved: harness.savedAuthors(),
      ringgoldHidden: document.getElementById('ringgold-dialog')?.hidden,
    });
    expect(report.errors).toEqual([]);
    expect(harness.ringgoldOkayClicks()).toBeGreaterThan(0);
    expect(harness.savedAuthors()).toEqual([
      expect.objectContaining({
        email: 'ada@example.org',
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    ]);
    expect(document.getElementById('ringgold-dialog')?.hidden).toBe(true);
    expect(harness.submitClicks()).toBe(0);
  });

  it('dismisses the generic Please try again error with Close and still commits', async () => {
    const harness = mountScholarOneFixture({
      emailLookupMs: 10,
      errorOnInstitution: true,
    });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        namePrefix: 'Dr.',
        email: 'ada@example.org',
        sequence: 1,
        affiliations: [
          {
            institution: 'Analytical Engines Institute',
            city: 'London',
            country: 'United Kingdom',
            isPrimary: true,
          },
        ],
      }),
    ]);

    const report = await scholarOneAdapter.fillAsync!(document, roster, {
      overwrite: true,
      dryRun: false,
    });

    console.log('ScholarOne generic error Close', {
      errors: report.errors,
      warnings: report.warnings,
      okayClicks: harness.ringgoldOkayClicks(),
      errorCloseClicks: harness.errorCloseClicks(),
      saved: harness.savedAuthors(),
      errorHidden: document.getElementById('scholarone-error')?.hidden,
      email:
        (document.getElementById('AUTHOR_EMAIL_ADDRESS') as HTMLInputElement | null)
          ?.value,
    });
    expect(report.errors).toEqual([]);
    expect(harness.errorCloseClicks()).toBeGreaterThan(0);
    expect(harness.savedAuthors()).toHaveLength(1);
    expect(document.getElementById('scholarone-error')?.hidden).toBe(true);
  });

  it('fills Prefix, Institution, and City so Create New Author can save', async () => {
    const harness = mountScholarOneFixture({
      emailLookupMs: 10,
      requireCreateFields: true,
    });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        namePrefix: 'Dr.',
        email: 'ada@example.org',
        sequence: 1,
        affiliations: [
          {
            institution: 'Analytical Engines Institute',
            city: 'London',
            country: 'United Kingdom',
            isPrimary: true,
          },
        ],
      }),
    ]);

    const report = await scholarOneAdapter.fillAsync!(document, roster, {
      overwrite: true,
      dryRun: false,
    });

    const prefix = (
      document.getElementById('AUTHOR_SALUTATION') as HTMLSelectElement | null
    )?.value;
    const institution = (
      document.querySelector(
        'input[name="AUTHOR_INSTITUTION_1"]',
      ) as HTMLInputElement | null
    )?.value;
    const city = (document.getElementById('CITY_1') as HTMLInputElement | null)
      ?.value;
    console.log('ScholarOne create required fields', {
      errors: report.errors,
      prefix,
      institution,
      city,
      saved: harness.savedAuthors(),
      bannerHidden: document.getElementById('create-validation')?.hidden,
    });
    expect(report.errors).toEqual([]);
    expect(prefix).toBe('Dr.');
    expect(institution).toBe('Analytical Engines Institute');
    expect(city).toBe('London');
    expect(harness.savedAuthors()).toHaveLength(1);
    expect(document.getElementById('create-validation')?.hidden).toBe(true);
  });

  it('fills ExtJS Institution and City that are readonly, aria-hidden, and city-disabled until Country', async () => {
    const harness = mountScholarOneFixture({
      emailLookupMs: 10,
      requireCreateFields: true,
      extJsAffiliationWidgets: true,
    });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        namePrefix: 'Dr.',
        email: 'ada@example.org',
        sequence: 1,
        affiliations: [
          {
            institution: 'Analytical Engines Institute',
            city: 'London',
            country: 'United Kingdom',
            isPrimary: true,
          },
        ],
      }),
    ]);

    const report = await scholarOneAdapter.fillAsync!(document, roster, {
      overwrite: true,
      dryRun: false,
    });

    const institution = document.querySelector(
      'input[name="AUTHOR_INSTITUTION_1"]',
    ) as HTMLInputElement | null;
    const city = document.getElementById(
      'combobox-2001-inputEl',
    ) as HTMLInputElement | null;
    console.log('ScholarOne ExtJS affiliation widgets', {
      errors: report.errors,
      institution: institution?.value,
      institutionReadOnly: institution?.readOnly,
      institutionAriaHidden: institution?.getAttribute('aria-hidden'),
      city: city?.value,
      cityDisabled: city?.disabled,
      cityId: city?.id,
      saved: harness.savedAuthors(),
      bannerHidden: document.getElementById('create-validation')?.hidden,
    });
    expect(report.errors).toEqual([]);
    expect(institution?.readOnly).toBe(true);
    expect(institution?.getAttribute('aria-hidden')).toBe('true');
    expect(institution?.value).toBe('Analytical Engines Institute');
    expect(document.getElementById('CITY_1')).toBeNull();
    expect(city?.value).toBe('London');
    expect(city?.disabled).toBe(false);
    expect(harness.savedAuthors()).toHaveLength(1);
    expect(harness.savedAuthors()[0]).toEqual(
      expect.objectContaining({
        city: 'London',
        country: 'United Kingdom',
      }),
    );
    expect(document.getElementById('create-validation')?.hidden).toBe(true);
  });

  it('refuses to Save when Prefix is still None Selected', async () => {
    mountScholarOneFixture({
      emailLookupMs: 10,
      requireCreateFields: true,
    });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        email: 'ada@example.org',
        sequence: 1,
        affiliations: [
          {
            institution: 'Analytical Engines Institute',
            city: 'London',
            country: 'United Kingdom',
            isPrimary: true,
          },
        ],
      }),
    ]);

    await expect(
      scholarOneAdapter.fillAsync!(document, roster, {
        overwrite: true,
        dryRun: false,
      }),
    ).rejects.toThrow(/Prefix is required/i);
  });
});
