import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { editorialManagerAdapter } from '@/adapters/editorial-manager/adapter';
import { mountEmPopupValidationHarness } from '@/adapters/editorial-manager/fixture';
import { countFilledAuthors } from '@/popup/timeSaved';
import { makeAuthor, makeRoster } from '../helpers/roster';

afterEach(() => {
  document.body.innerHTML = '';
});

function author(sequence: number, creditRoles: string[] = []) {
  return makeAuthor({
    givenName: `Given${sequence}`,
    familyName: `Family${sequence}`,
    email: `author${sequence}@example.org`,
    sequence,
    creditRoles: creditRoles as never,
    affiliations: [
      {
        institution: 'Example Institute',
        department: 'Example Department',
        city: 'Boston',
        postalCode: '02115',
        country: 'United States',
        isPrimary: true,
      },
    ],
  });
}

function trackFirstName(input: HTMLInputElement): string[] {
  const values: string[] = [];
  const proto = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  );
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() {
      return proto?.get?.call(this) ?? '';
    },
    set(next: string) {
      proto?.set?.call(this, next);
      values.push(String(next));
    },
  });
  return values;
}

describe('Editorial Manager popup + validation harness', () => {
  it('keeps the HTML playground on the same observed field IDs', () => {
    const html = readFileSync(
      resolve(process.cwd(), 'fixtures/em-popup-validation.html'),
      'utf8',
    );
    for (const id of [
      'FirstName',
      'LastName',
      'Email',
      'Institution',
      'Department',
      'City',
      'Zipcode',
      'CountryCode',
      'CorrespondingAuthorCheckbox',
      'authorsCount',
      'current-author-list',
      'validation-issues',
      'validation-issues-ok',
      'ContributorRole_0',
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('data-toolname="AuthorSave"');
    expect(html).toContain('fl-add-btn');
    expect(html).toContain('Current Author List');
    expect(html).toContain('Validation found issues');
  });

  it('fills three authors without saving the late-flip identity', async () => {
    const form = mountEmPopupValidationHarness();
    const first = form.getElementById('FirstName') as HTMLInputElement;
    const save = form.querySelector(
      '[data-toolname="AuthorSave"]',
    ) as HTMLButtonElement;
    const firstNameWrites = trackFirstName(first);
    const namesAtSave: string[] = [];
    save.addEventListener(
      'click',
      () => {
        namesAtSave.push(first.value);
      },
      true,
    );

    const roster = makeRoster([
      author(1, ['methodology']),
      author(2, ['investigation']),
      author(3, ['supervision']),
    ]);
    const report = await editorialManagerAdapter.fillAsync!(document, roster, {
      overwrite: false,
      dryRun: false,
    });

    const given1Writes = firstNameWrites.filter((value) => value === 'Given1');
    const given2DuringFirst = firstNameWrites
      .slice(0, firstNameWrites.lastIndexOf('Given1') + 1)
      .includes('Given2');
    console.log('EM popup validation harness', {
      errors: report.errors,
      warnings: report.warnings,
      namesAtSave,
      firstNameWrites,
      given1Writes,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
      filledAuthors: countFilledAuthors(report, 3),
    });

    expect(report.errors).toEqual([]);
    expect(namesAtSave).toEqual(['Given1', 'Given2', 'Given3']);
    expect(namesAtSave[0]).not.toBe('Given3');
    expect(given1Writes.length).toBeLessThanOrEqual(2);
    expect(given2DuringFirst).toBe(false);
    expect(
      (form.getElementById('authorsCount') as HTMLInputElement).value,
    ).toBe('3');
    expect(countFilledAuthors(report, 3)).toBe(3);
  }, 20_000);
});
