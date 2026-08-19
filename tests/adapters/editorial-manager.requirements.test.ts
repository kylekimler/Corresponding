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

    expect(report.errors.join(' ')).toMatch(/Authors list/);
    expect(report.errors.join(' ')).toMatch(/Add New Author/);
  });

  it('detects the Manuscript Data authors list without an open form', () => {
    document.body.innerHTML = `
      <button id="StepIndicator_stepManuscriptDataButton">Manuscript Data</button>
      <button type="button" class="fl-add-btn">Add New Author</button>
    `;
    Object.defineProperty(document, 'title', {
      configurable: true,
      value: 'Add/Edit/Remove Authors',
    });
    const detected = editorialManagerAdapter.detect(document);
    console.log('EM authors-list detect', detected);
    expect(detected.platformId).toBe('editorial-manager');
    expect(detected.evidence).toEqual(
      expect.arrayContaining(['authors-list', 'fl-add-btn']),
    );
    expect(findAddAnotherAuthorControl(document)?.textContent).toMatch(
      /Add New Author/,
    );
  });

  it('starts from the authors list: Add Author, save, Add Author, next author', async () => {
    const form = mountEditorialManagerFixture({
      startOnAuthorsList: true,
      addAuthorLabel: 'Add New Author',
    });
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

    expect(form.getElementById('author-dialog')?.hidden).toBe(true);

    const report = await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster([
        author(1, ['methodology']),
        author(2, ['investigation']),
      ]),
      { overwrite: true, dryRun: false },
    );

    console.log('EM authors-list start', {
      errors: report.errors,
      warnings: report.warnings,
      saveClicks,
      addClicks,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
      dialogHidden: form.getElementById('author-dialog')?.hidden,
    });
    expect(report.errors).toEqual([]);
    expect(addClicks).toBe(2);
    expect(saveClicks).toBe(2);
    expect(
      (form.getElementById('authorsCount') as HTMLInputElement).value,
    ).toBe('2');
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

  it('ignores the Institution typeahead, keeps the typed name, refills City, and saves', async () => {
    const form = mountEditorialManagerFixture({ includeAddAnotherAuthor: false });
    const rosterAuthor = author(1, ['methodology']);
    rosterAuthor.affiliations[0] = {
      institution: 'Analytical Engines Institute',
      department: 'Computing Laboratory',
      city: 'London',
      postalCode: 'NW1 2BE',
      country: 'United Kingdom',
      isPrimary: true,
    };
    let suggestionClicks = 0;
    form.getElementById('institution-suggestions')?.addEventListener('click', () => {
      suggestionClicks += 1;
    });
    const atSave = { institution: '', city: '', department: '' };
    form
      .querySelector('[data-toolname="AuthorSave"]')
      ?.addEventListener(
        'click',
        () => {
          atSave.institution = (
            form.getElementById('Institution') as HTMLInputElement
          ).value;
          atSave.city = (form.getElementById('City') as HTMLInputElement).value;
          atSave.department = (
            form.getElementById('Department') as HTMLInputElement
          ).value;
        },
        true,
      );

    const report = await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster([rosterAuthor]),
      { overwrite: true, dryRun: false },
    );

    console.log('EM institution free text', {
      errors: report.errors,
      warnings: report.warnings,
      suggestionClicks,
      atSave,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
      listHidden: form.getElementById('institution-suggestions')?.hidden,
    });
    expect(report.errors).toEqual([]);
    expect(suggestionClicks).toBe(0);
    expect(atSave.institution).toBe('Analytical Engines Institute');
    expect(atSave.city).toBe('London');
    expect(atSave.department).toBe('Computing Laboratory');
    expect(
      (form.getElementById('authorsCount') as HTMLInputElement).value,
    ).toBe('1');
  });

  it('clicks Save This Author after closing the overlay, then OK on the alertdialog', async () => {
    const form = mountEditorialManagerFixture({
      warnUnidentifiedInstitution: true,
      includeAddAnotherAuthor: false,
    });
    const rosterAuthor = author(1, ['methodology']);
    rosterAuthor.affiliations[0] = {
      institution: 'Analytical Engines Institute',
      department: 'Computing Laboratory',
      city: 'London',
      postalCode: 'NW1 2BE',
      country: 'United Kingdom',
      isPrimary: true,
    };
    let saveClicks = 0;
    let okClicks = 0;
    let cancelClicks = 0;
    form
      .querySelector('[data-toolname="AuthorSave"]')
      ?.addEventListener('click', () => {
        saveClicks += 1;
      });
    form.getElementById('institution-warning-ok')?.addEventListener('click', () => {
      okClicks += 1;
    });
    form
      .getElementById('institution-warning-cancel')
      ?.addEventListener('click', () => {
        cancelClicks += 1;
      });

    const report = await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster([rosterAuthor]),
      { overwrite: true, dryRun: false },
    );

    const warning = form.getElementById('institution-warning');
    console.log('EM save overlay then alertdialog OK', {
      errors: report.errors,
      warnings: report.warnings,
      saveClicks,
      okClicks,
      cancelClicks,
      warningRole: warning?.getAttribute('role'),
      warningHidden: warning?.hidden,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
    });
    expect(report.errors).toEqual([]);
    expect(saveClicks).toBeGreaterThan(0);
    expect(okClicks).toBeGreaterThan(0);
    expect(cancelClicks).toBe(0);
    expect(warning?.getAttribute('role')).toBe('alertdialog');
    expect(
      (form.getElementById('authorsCount') as HTMLInputElement).value,
    ).toBe('1');
  });

  it('clicks parent-page Proceed anyway OK when Fill ran in the form iframe', async () => {
    const form = mountEditorialManagerFixture({
      warnUnidentifiedInstitution: true,
      dialogsOnParent: true,
    });
    expect(form.getElementById('institution-warning')).toBeNull();
    const parentWarning = document.getElementById('institution-warning');
    expect(parentWarning?.getAttribute('role')).toBe('alertdialog');

    let okClicks = 0;
    let cancelClicks = 0;
    document.getElementById('institution-warning-ok')?.addEventListener('click', () => {
      okClicks += 1;
    });
    document
      .getElementById('institution-warning-cancel')
      ?.addEventListener('click', () => {
        cancelClicks += 1;
      });

    const report = await editorialManagerAdapter.fillAsync!(
      form,
      makeRoster([author(1, ['methodology']), author(2, ['supervision'])]),
      { overwrite: true, dryRun: false },
    );

    console.log('EM parent-page institution OK', {
      errors: report.errors,
      warnings: report.warnings,
      okClicks,
      cancelClicks,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
      warningHidden: parentWarning?.hidden,
    });
    expect(report.errors).toEqual([]);
    expect(okClicks).toBeGreaterThan(0);
    expect(cancelClicks).toBe(0);
    expect(
      (form.getElementById('authorsCount') as HTMLInputElement).value,
    ).toBe('2');
  });

  it('retries the live ui-button-text-only Warning OK three times', async () => {
    const form = mountEditorialManagerFixture({
      warnUnidentifiedInstitution: true,
      dialogsOnParent: true,
    });
    const ok = document.getElementById(
      'institution-warning-ok',
    ) as HTMLButtonElement;
    expect(ok.className).toContain('ui-button-text-only');
    expect(ok.querySelector('.ui-button-text')?.textContent).toBe('OK');

    let okClicks = 0;
    let cancelClicks = 0;
    ok.addEventListener('click', () => {
      okClicks += 1;
    });
    document
      .getElementById('institution-warning-cancel')
      ?.addEventListener('click', () => {
        cancelClicks += 1;
      });

    const report = await editorialManagerAdapter.fillAsync!(
      form,
      makeRoster([author(1, ['methodology']), author(2, ['supervision'])]),
      { overwrite: true, dryRun: false },
    );

    console.log('EM Warning OK retries', {
      errors: report.errors,
      warnings: report.warnings,
      okClicks,
      cancelClicks,
      okClass: ok.className,
      okRole: ok.getAttribute('role'),
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
    });
    expect(report.errors).toEqual([]);
    expect(okClicks).toBeGreaterThanOrEqual(3);
    expect(cancelClicks).toBe(0);
    expect(
      (form.getElementById('authorsCount') as HTMLInputElement).value,
    ).toBe('2');
  });

  it('clicks OK on Cannot Save Author / wrong-format over the author list', async () => {
    const form = mountEditorialManagerFixture({
      warnWrongFormatAfterSave: true,
      dialogsOnParent: true,
    });
    expect(form.getElementById('wrong-format')).toBeNull();
    const dialog = document.getElementById('wrong-format');
    const ok = document.getElementById('wrong-format-ok') as HTMLButtonElement;
    expect(dialog?.querySelector('.ui-dialog-titlebar')?.textContent).toBe(
      'Cannot Save Author',
    );
    expect(ok.className).toContain('ui-button-text-only');

    let okClicks = 0;
    ok.addEventListener('click', () => {
      okClicks += 1;
    });

    const report = await editorialManagerAdapter.fillAsync!(
      form,
      makeRoster([author(1, ['methodology']), author(2, ['supervision'])]),
      { overwrite: true, dryRun: false },
    );

    console.log('EM Cannot Save Author wrong-format OK', {
      errors: report.errors,
      warnings: report.warnings,
      okClicks,
      dialogHidden: dialog?.hidden,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
    });
    expect(report.errors).toEqual([]);
    expect(okClicks).toBeGreaterThan(0);
    expect(dialog?.hidden).toBe(true);
    expect(
      (form.getElementById('authorsCount') as HTMLInputElement).value,
    ).toBe('2');
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

  it('clicks through Validation found issues, then institution OK, and still saves', async () => {
    const form = mountEditorialManagerFixture({
      warnValidationIssues: true,
      warnUnidentifiedInstitution: true,
      includeAddAnotherAuthor: false,
    });
    const validationOk = form.getElementById(
      'validation-issues-ok',
    ) as HTMLButtonElement;
    const institutionOk = form.getElementById(
      'institution-warning-ok',
    ) as HTMLButtonElement;
    const cancel = form.getElementById(
      'institution-warning-cancel',
    ) as HTMLButtonElement;
    let validationClicks = 0;
    let institutionClicks = 0;
    let cancelClicks = 0;
    validationOk.addEventListener('click', () => {
      validationClicks += 1;
    });
    institutionOk.addEventListener('click', () => {
      institutionClicks += 1;
    });
    cancel.addEventListener('click', () => {
      cancelClicks += 1;
    });

    const report = await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster([author(1, ['methodology'])]),
      { overwrite: true, dryRun: false },
    );

    console.log('EM validation-then-institution click-through', {
      errors: report.errors,
      warnings: report.warnings,
      validationClicks,
      institutionClicks,
      cancelClicks,
      authorsCount: (form.getElementById('authorsCount') as HTMLInputElement)
        .value,
      validationHidden: form.getElementById('validation-issues')?.hidden,
      institutionHidden: form.getElementById('institution-warning')?.hidden,
      unverifiedHidden: form.getElementById('institution-unverified')?.hidden,
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings.join(' ')).not.toMatch(/institution is unverified/i);
    expect(validationClicks).toBeGreaterThan(0);
    expect(institutionClicks).toBeGreaterThan(0);
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
