import { afterEach, describe, expect, it } from 'vitest';
import { editorialManagerAdapter } from '@/adapters/editorial-manager/adapter';
import {
  mountEditorialManagerFixture,
  readAuthorForm,
} from '@/adapters/editorial-manager/fixture';
import { defaultRegistry } from '@/adapters/registry';
import { makeAuthor, makeNAuthors, makeRoster } from './helpers/roster';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Editorial Manager author-form adapter', () => {
  it('detects the captured FirstName/LastName/Email form inside an iframe', () => {
    mountEditorialManagerFixture();
    const detected = editorialManagerAdapter.detect(document);
    expect(detected.platformId).toBe('editorial-manager');
    expect(detected.confidence).toBeGreaterThanOrEqual(0.5);
    expect(detected.evidence).toEqual(
      expect.arrayContaining(['FirstName', 'LastName', 'Email']),
    );
    expect(defaultRegistry.detect(document).platformId).toBe(
      'editorial-manager',
    );
  });

  it('does not detect the EM chrome shell as a fillable author form', () => {
    document.body.innerHTML =
      '<select id="RoleDropdown"><option>Author</option></select>';
    expect(editorialManagerAdapter.detect(document).platformId).toBe('unknown');
  });

  it('preview does not mutate author or manuscript fields', () => {
    const form = mountEditorialManagerFixture();
    const before = form.body.innerHTML;
    const roster = makeRoster(makeNAuthors(2));
    const report = editorialManagerAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: true,
    });
    expect(report.dryRun).toBe(true);
    expect(form.body.innerHTML).toBe(before);
    expect(readAuthorForm(form).title).toBe('');
    expect(readAuthorForm(form).firstName).toBe('');
  });

  it('fills the open author form in the iframe and leaves manuscript fields empty', () => {
    const form = mountEditorialManagerFixture({ includeAddAnotherAuthor: false });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        middleName: 'A',
        familyName: 'Lovelace',
        email: 'ada@example.org',
        sequence: 1,
        isCorresponding: true,
        affiliations: [
          {
            institution: 'Manton Cell Discovery Network',
            department: 'Computation',
            city: 'Cambridge',
            state: 'MA',
            country: 'United States',
            isPrimary: true,
          },
        ],
      }),
    ]);
    const report = editorialManagerAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: false,
    });
    console.log('EM single-author fill', {
      errors: report.errors,
      warnings: report.warnings,
      filled: report.filled,
      actions: report.plans.map((p) => `${p.fieldId}:${p.action}`),
      after: readAuthorForm(form),
      savePresent: Boolean(form.getElementById('SaveButton')),
    });
    expect(report.errors).toEqual([]);
    expect(report.filled).toBeGreaterThan(0);
    expect(readAuthorForm(form).title).toBe('');
    expect(readAuthorForm(form).abstract).toBe('');
    expect(readAuthorForm(form).authorsCount).toBe(1);
    expect(form.getElementById('txtFullTitle')).toBeTruthy();
  });

  it('saves one author at a time and uses Add Another Author for the rest', () => {
    const form = mountEditorialManagerFixture();
    const roster = makeRoster(makeNAuthors(3));
    const report = editorialManagerAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: false,
    });
    expect(report.errors).toEqual([]);
    expect(readAuthorForm(form).authorsCount).toBe(3);
    expect(readAuthorForm(form).firstName).toBe('');
    expect(readAuthorForm(form).title).toBe('');
  });

  it('preserves a non-empty given name when overwrite is false', () => {
    const form = mountEditorialManagerFixture({
      existing: { firstName: 'Already' },
      includeAddAnotherAuthor: false,
    });
    const roster = makeRoster(makeNAuthors(1));
    editorialManagerAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: false,
    });
    expect(
      (form.getElementById('FirstName') as HTMLInputElement).value,
    ).toBe('Already');
  });

  it('refuses to overwrite a conflicting identity already in the form', () => {
    const form = mountEditorialManagerFixture({
      existing: {
        firstName: 'Portal',
        lastName: 'Person',
        email: 'portal@journal.example',
      },
      includeAddAnotherAuthor: false,
    });
    const roster = makeRoster(makeNAuthors(1));
    const before = readAuthorForm(form);
    const report = editorialManagerAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    console.log('EM conflict fill', {
      errors: report.errors,
      warnings: report.warnings,
      skippedConflicts: report.skippedConflicts,
      plans: report.plans.map((p) => `${p.fieldId}:${p.action}:${p.reason ?? ''}`),
      after: readAuthorForm(form),
    });
    expect(report.skippedConflicts).toBeGreaterThan(0);
    expect(readAuthorForm(form).firstName).toBe(before.firstName);
    expect(readAuthorForm(form).email).toBe(before.email);
    expect(readAuthorForm(form).authorsCount).toBe(0);
  });

  it('never clicks manuscript step controls', () => {
    const form = mountEditorialManagerFixture();
    let stepped = false;
    form
      .getElementById('StepIndicator_stepManuscriptDataButton')
      ?.addEventListener('click', () => {
        stepped = true;
      });
    editorialManagerAdapter.fill(document, makeRoster(makeNAuthors(1)), {
      overwrite: false,
      dryRun: false,
    });
    expect(stepped).toBe(false);
  });
});
