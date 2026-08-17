import { afterEach, describe, expect, it } from 'vitest';
import { editorialManagerAdapter } from '@/adapters/editorial-manager/adapter';
import { mountEditorialManagerFixture } from '@/adapters/editorial-manager/fixture';
import { CREDIT_ROLES } from '@/schema/credit';
import {
  findAddAnotherAuthorControl,
  findRolesCollapseSave,
  findSelectRolesControl,
} from '@/adapters/editorial-manager/documents';
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

  it('opens the Edit Contributor Roles pencil, ticks, then collapses with the roles floppy', async () => {
    const form = mountEditorialManagerFixture({
      rolesCollapsed: true,
      includeAddAnotherAuthor: false,
    });
    const pencil = form.getElementById('EditButton') as HTMLInputElement;
    const rolesFloppy = form.querySelector(
      'input[title="Collapse and Save Changes"]',
    ) as HTMLInputElement;
    const authorSave = form.querySelector(
      '[data-toolname="AuthorSave"]',
    ) as HTMLButtonElement;
    let pencilClicks = 0;
    let collapseClicks = 0;
    let authorSaveClicks = 0;
    pencil.addEventListener('click', () => {
      pencilClicks += 1;
    });
    rolesFloppy.addEventListener('click', () => {
      collapseClicks += 1;
    });
    authorSave.addEventListener('click', () => {
      authorSaveClicks += 1;
    });

    await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster([author(1, ['methodology'])]),
      { overwrite: true, dryRun: false },
    );

    const boxes = Array.from(
      form.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"][id^="ContributorRole_"]',
      ),
    );
    const methodology = boxes.find((box) =>
      /methodology/i.test(box.closest('label')?.textContent ?? ''),
    );
    console.log('EM credit pencil/floppy', {
      pencilClicks,
      collapseClicks,
      authorSaveClicks,
      boxCount: boxes.length,
      ids: boxes.map((box) => box.id),
      methodology: methodology?.checked,
      panelHidden: form.getElementById('contributor-roles-panel')?.hidden,
    });
    expect(findSelectRolesControl(form)?.id).toBe('EditButton');
    expect(findRolesCollapseSave(form)?.getAttribute('title')).toBe(
      'Collapse and Save Changes',
    );
    expect(pencilClicks).toBeGreaterThan(0);
    expect(collapseClicks).toBeGreaterThan(0);
    expect(authorSaveClicks).toBeGreaterThan(0);
    expect(CREDIT_ROLES).toHaveLength(14);
    expect(boxes).toHaveLength(14);
    expect(boxes.map((box) => box.id)).toEqual(
      CREDIT_ROLES.map((_, index) => `ContributorRole_${index}`),
    );
    expect(methodology?.checked).toBe(true);
    // The roles floppy collapses the grid; it is not the author save.
    expect(form.getElementById('contributor-roles-panel')?.hidden).toBe(true);
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

  it('picks an exact institution typeahead match and does not guess a neighbour', async () => {
    const form = mountEditorialManagerFixture({ includeAddAnotherAuthor: false });
    const rosterAuthor = author(1, ['methodology']);
    rosterAuthor.affiliations[0] = {
      ...rosterAuthor.affiliations[0]!,
      institution: 'University of London',
      isPrimary: true,
    };
    let picked = '';
    let valueWhenPicked = '';
    form.getElementById('institution-suggestions')?.addEventListener('click', (event) => {
      picked = (event.target as HTMLElement).textContent?.trim() ?? '';
      valueWhenPicked =
        (form.getElementById('Institution') as HTMLInputElement).value;
    });

    const report = await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster([rosterAuthor]),
      { overwrite: true, dryRun: false },
    );

    console.log('EM institution typeahead', {
      errors: report.errors,
      warnings: report.warnings,
      picked,
      valueWhenPicked,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
    });
    expect(report.errors).toEqual([]);
    expect(picked).toBe('University of London');
    expect(valueWhenPicked).toBe('University of London');
    expect(
      (form.getElementById('authorsCount') as HTMLInputElement).value,
    ).toBe('1');
  });

  it('confirms the unidentified-institution warning with OK, never Cancel', async () => {
    const form = mountEditorialManagerFixture({
      warnUnidentifiedInstitution: true,
      includeAddAnotherAuthor: false,
    });
    const ok = form.getElementById('institution-warning-ok') as HTMLButtonElement;
    const cancel = form.getElementById(
      'institution-warning-cancel',
    ) as HTMLButtonElement;
    let okClicks = 0;
    let cancelClicks = 0;
    ok.addEventListener('click', () => {
      okClicks += 1;
    });
    cancel.addEventListener('click', () => {
      cancelClicks += 1;
    });

    const report = await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster([author(1, ['methodology'])]),
      { overwrite: true, dryRun: false },
    );

    console.log('EM institution warning', {
      errors: report.errors,
      warnings: report.warnings,
      okClicks,
      cancelClicks,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
      warningHidden: form.getElementById('institution-warning')?.hidden,
    });
    expect(report.errors).toEqual([]);
    expect(okClicks).toBeGreaterThan(0);
    expect(cancelClicks).toBe(0);
    expect(
      (form.getElementById('authorsCount') as HTMLInputElement).value,
    ).toBe('1');
  });

  it('saves with Save This Author, then Add Another Author reopens the dialog', async () => {
    const form = mountEditorialManagerFixture();
    const save = form.querySelector(
      '[data-toolname="AuthorSave"]',
    ) as HTMLButtonElement;
    const add = form.querySelector('button.fl-add-btn') as HTMLButtonElement;
    let saveClicks = 0;
    let addClicks = 0;
    save.addEventListener('click', () => {
      saveClicks += 1;
    });
    add.addEventListener('click', () => {
      addClicks += 1;
    });

    const report = await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster([
        author(1, ['methodology']),
        author(2, ['investigation']),
        author(3, ['software']),
      ]),
      { overwrite: true, dryRun: false },
    );

    console.log('EM save-and-add', {
      errors: report.errors,
      warnings: report.warnings,
      saveClicks,
      addClicks,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
      dialogHidden: form.getElementById('author-dialog')?.hidden,
    });
    expect(report.errors).toEqual([]);
    expect(saveClicks).toBe(3);
    expect(addClicks).toBe(2);
    expect(
      (form.getElementById('authorsCount') as HTMLInputElement).value,
    ).toBe('3');
  });

  it('writes Zipcode from the roster postal code and blurs so Knockout sees it', () => {
    const form = mountEditorialManagerFixture({ includeAddAnotherAuthor: false });
    const zip = form.getElementById('Zipcode') as HTMLInputElement;
    let blurs = 0;
    let valueAtBlur = '';
    zip.addEventListener('blur', () => {
      blurs += 1;
      valueAtBlur = zip.value;
    });

    const report = editorialManagerAdapter.fill(
      document,
      makeRoster([author(1, ['methodology'])]),
      { overwrite: true, dryRun: false },
    );

    console.log('EM zip fill', {
      valueAtBlur,
      afterSave: zip.value,
      blurs,
      plan: report.plans.find((p) => p.fieldId === 'Zipcode'),
    });
    // Save clears the form; the value that Knockout would have seen is the blur.
    expect(valueAtBlur).toBe('02115');
    expect(blurs).toBeGreaterThan(0);
    expect(report.plans.some((p) => p.fieldId === 'Zipcode' && p.action === 'fill')).toBe(
      true,
    );
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
