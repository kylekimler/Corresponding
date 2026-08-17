import { afterEach, describe, expect, it } from 'vitest';
import { editorialManagerAdapter } from '@/adapters/editorial-manager/adapter';
import { mountEditorialManagerFixture } from '@/adapters/editorial-manager/fixture';
import { findAddAnotherAuthorControl } from '@/adapters/editorial-manager/documents';
import { summarizePreview } from '@/popup/previewSummary';
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

describe('Editorial Manager contributor-role requirement', () => {
  it('reports the missing CRediT role without abandoning the fill', () => {
    mountEditorialManagerFixture();

    const report = editorialManagerAdapter.fill(
      document,
      makeRoster([author(1), author(2)]),
      { overwrite: true, dryRun: false },
    );

    const credit = report.requirements?.find(
      (issue) => issue.code === 'credit_roles_required',
    );
    expect(credit).toEqual(
      expect.objectContaining({ field: 'Contributor Roles', blocksFill: true }),
    );
    // Values the portal does accept are still written, so the person only has
    // to add the roles by hand rather than retype the author.
    expect(report.filled + report.overwritten).toBeGreaterThan(0);
    expect(report.errors).toEqual([]);
  });

  it('reports nothing extra once every author declares a role', () => {
    mountEditorialManagerFixture();

    const report = editorialManagerAdapter.fill(
      document,
      makeRoster([author(1, ['conceptualization'])]),
      { overwrite: true, dryRun: true },
    );

    expect(report.requirements).toEqual([]);
    expect(report.errors).toEqual([]);
    expect(report.plans.length).toBeGreaterThan(0);
  });

  it('finds Add Another Author when it is an icon with a title', () => {
    mountEditorialManagerFixture();
    // Editorial Manager's toolbar uses icons, so the label is in title/alt.
    const toolbar = document.createElement('div');
    toolbar.innerHTML =
      '<a id="save-and-add"><img title="Save and Add Another Author" alt="" /></a>';
    document.body.append(toolbar);

    const control = findAddAnotherAuthorControl(document);

    // The click must land on the anchor, not the inner image.
    expect(control?.id).toBe('save-and-add');
  });

  it('names the Authors list page when the form is in another window', () => {
    document.body.innerHTML = `
      <button id="StepIndicator_stepManuscriptDataButton">Manuscript Data</button>
      <textarea id="txtFullTitle"></textarea>
    `;
    Object.defineProperty(document, 'title', {
      configurable: true,
      value: 'Add/Edit/Remove Authors',
    });

    const report = editorialManagerAdapter.fill(
      document,
      makeRoster([author(1, ['methodology'])]),
      { overwrite: true, dryRun: true },
    );

    expect(report.errors.join(' ')).toMatch(/Authors list page/);
    expect(report.errors.join(' ')).toMatch(/Add New Author window/);
  });

  it('opens Click here to select roles and ticks the declared CRediT box', async () => {
    const form = mountEditorialManagerFixture({
      rolesCollapsed: true,
      includeAddAnotherAuthor: false,
    });

    await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster([author(1, ['methodology'])]),
      { overwrite: true, dryRun: false },
    );

    const methodology = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find((box) => /methodology/i.test(box.closest('label')?.textContent ?? ''));
    expect(methodology?.checked).toBe(true);
    expect(form.getElementById('contributor-roles-panel')?.hidden).toBe(false);
  });

  it('reports the portal warning when a save is refused for missing roles', async () => {
    const form = mountEditorialManagerFixture({
      warnIfNoRole: true,
      includeAddAnotherAuthor: false,
    });

    const report = await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster([author(1)]),
      { overwrite: true, dryRun: false },
    );

    const warningEl = form.getElementById('roles-warning');
    console.log('EM roles warning fill', {
      errors: report.errors,
      warnings: report.warnings,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement | null)
        ?.value,
      warningHidden: warningEl?.hidden,
      warningRole: warningEl?.getAttribute('role'),
      dialogCount: form.querySelectorAll('[role="dialog"]').length,
      warningQuery: form.querySelectorAll('[id*="warning"]').length,
      warningText: warningEl?.textContent?.trim(),
      ticked: Array.from(
        form.querySelectorAll<HTMLInputElement>(
          'input[type="checkbox"][id^="ContributorRole_"]',
        ),
      ).filter((box) => box.checked).length,
    });

    expect(report.errors.join(' ')).toMatch(
      /Please select at least one Contributor Role/i,
    );
    expect(form.getElementById('roles-warning')?.hidden).toBe(false);
  });

  it('surfaces the requirement to the popup as an explained notice', () => {
    mountEditorialManagerFixture();
    const roster = makeRoster([author(1), author(2)]);

    const report = editorialManagerAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: true,
    });
    const summary = summarizePreview(report, null, roster.authors.length);

    expect(summary.requirementNotices.join(' ')).toMatch(
      /Contributor Roles is missing for all 2 authors.*at least one CRediT role/,
    );
  });
});
