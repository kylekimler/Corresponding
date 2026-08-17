/**
 * Synthetic Editorial Manager author form from the 2026-08-15 PLOS ONE
 * structural capture. Values are test-only; production never ships them.
 */

import { CREDIT_ROLE_LABELS, CREDIT_ROLES } from '@/schema/credit';
import { CONTRIBUTOR_ROLE_PREFIX } from './ids';

export interface EditorialManagerFixtureOptions {
  /** When true (default), author fields live in a same-origin iframe. */
  inIframe?: boolean;
  existing?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  includeAddAnotherAuthor?: boolean;
  includeManuscriptFields?: boolean;
  /**
   * CRediT panel starts collapsed behind "Click here to select roles",
   * matching the Add New Author dialog.
   */
  rolesCollapsed?: boolean;
  /** Save without a ticked role shows the portal warning dialog. */
  warnIfNoRole?: boolean;
  /**
   * Save shows "Institution could not be identified… Proceed anyway?"
   * until OK is clicked. Cancel must not commit.
   */
  warnUnidentifiedInstitution?: boolean;
  /**
   * Save first shows “Validation found issues. Review the highlighted
   * counts and form.” OK continues; then the unidentified-institution
   * warning is used when that option is also on.
   */
  warnValidationIssues?: boolean;
}

const COUNTRIES = ['', 'United States', 'Germany', 'United Kingdom', 'Canada'];

function creditRoleMarkup(): string {
  // Live ids are ContributorRole_0 .. ContributorRole_13 (14 CRediT roles).
  return CREDIT_ROLES.map((role, index) => {
    const row = String(index + 2).padStart(2, '0');
    return `
      <label>
        <input
          type="checkbox"
          id="${CONTRIBUTOR_ROLE_PREFIX}${index}"
          name="ctl01$ctl24$ContributorRolesGridView$ctl${row}$${CONTRIBUTOR_ROLE_PREFIX}${index}"
        />
        ${CREDIT_ROLE_LABELS[role]}
      </label>`;
  }).join('');
}

function authorFormHtml(options: EditorialManagerFixtureOptions): string {
  const existing = options.existing ?? {};
  const manuscript =
    options.includeManuscriptFields === false
      ? ''
      : `
    <textarea id="txtFullTitle" name="txtFullTitle"></textarea>
    <textarea id="fullTitleHtml" name="fullTitleHtml"></textarea>
    <textarea id="txtShortTitle" name="txtShortTitle"></textarea>
    <textarea id="txtAbstract" name="txtAbstract"></textarea>
    <textarea id="abstractHtml" name="abstractHtml"></textarea>
    <textarea id="txtKeywords" name="txtKeywords"></textarea>
    <input type="checkbox" id="FundingInfoNotAvailable" name="FundingInfoNotAvailable" />
    <button type="button" id="StepIndicator_stepManuscriptDataButton">Manuscript Data</button>
  `;
  const countryOptions = COUNTRIES.map(
    (country) =>
      `<option value="${country}">${country || 'Select country'}</option>`,
  ).join('');
  const addAnother =
    options.includeAddAnotherAuthor === false
      ? ''
      : `<button type="button" id="add-another-author" class="fl-add-btn">Add Another Author</button>`;

  return `
    ${manuscript}
    <input type="text" id="authorsCount" name="authorsCount" value="0" />
    ${addAnother}
    <div id="author-dialog">
    <label for="FirstName">Given/First Name *</label>
    <input type="text" id="FirstName" name="ctl00$FirstName" value="${existing.firstName ?? ''}" />
    <label for="MiddleName">Middle Name</label>
    <input type="text" id="MiddleName" name="ctl00$MiddleName" />
    <label for="LastName">Family/Last Name *</label>
    <input type="text" id="LastName" name="ctl00$LastName" value="${existing.lastName ?? ''}" />
    <label for="Email">E-mail Address *</label>
    <input type="text" id="Email" name="ctl00$Email" value="${existing.email ?? ''}" />
    <label for="Affiliation">Affiliation</label>
    <textarea id="Affiliation" name="ctl00$Affiliation"></textarea>
    <label for="Institution">Institution *</label>
    <input type="text" id="Institution" name="ctl00$Institution" />
    <ul id="institution-suggestions" role="listbox" hidden></ul>
    <div id="institution-unverified" hidden>
      Author Institution is Unverified. Start typing to display potentially
      matching institutions.
    </div>
    <label for="Department">Department *</label>
    <input type="text" id="Department" name="ctl00$Department" />
    <label for="City">City</label>
    <input type="text" id="City" name="ctl00$City" />
    <label for="State">State</label>
    <input type="text" id="State" name="ctl00$State" />
    <label for="Zipcode">Zip or Postal Code *</label>
    <input
      type="text"
      id="Zipcode"
      name="ctl01$Zipcode"
      maxlength="50"
      class="valueCell required Zipcode"
      aria-required="true"
    />
    <label for="CountryCode">Country or Region *</label>
    <select id="CountryCode" name="ctl00$CountryCode">${countryOptions}</select>
    <div>
      <input
        type="image"
        id="EditButton"
        name="ctl01$ctl24$EditButton"
        title="Edit Contributor Roles"
        alt="Edit Contributor Roles"
        src="Edit.gif"
      />
      <a href="#" id="select-roles-trigger">Click here to select roles</a>
      <div id="contributor-roles-panel" ${options.rolesCollapsed ? 'hidden' : ''}>
        ${options.rolesCollapsed ? '' : creditRoleMarkup()}
        <input
          type="image"
          id="SaveButton"
          name="ctl01$ctl24$SaveButton"
          title="Collapse and Save Changes"
          alt="Collapse and Save Changes"
          src="Save.gif"
        />
      </div>
    </div>
    <div id="roles-warning" role="dialog" hidden>
      Contributor Roles Save Warnings
      Please select at least one Contributor Role.
      <button type="button" id="roles-warning-ok">OK</button>
    </div>
    <label>
      <input type="checkbox" id="CorrespondingAuthorCheckbox" name="ctl00$CorrespondingAuthorCheckbox" />
      This is the corresponding author
    </label>
    <div class="ui-dialog fl-dlg">
      <div class="fl-toolbox">
        <button
          type="button"
          class="fl-tool fl-flToolSave"
          title="Save This Author"
          aria-label="Save This Author"
          data-toolbasename="Save"
          data-toolname="AuthorSave"
          role="button"
        ></button>
      </div>
    </div>
    <div id="validation-issues" class="ui-dialog" hidden>
      <div class="ui-dialog-titlebar">Warning</div>
      Validation found issues. Review the highlighted counts and form.
      <div class="ui-dialog-buttonset">
        <button type="button" class="ui-button" id="validation-issues-ok">
          <span class="ui-button-text">OK</span>
        </button>
      </div>
    </div>
    <div id="institution-warning" class="ui-dialog" hidden>
      <div class="ui-dialog-titlebar">Warning</div>
      The Institution could not be identified by the system. Proceed with this
      Institution anyway?
      <div class="ui-dialog-buttonset">
        <button type="button" class="ui-button" id="institution-warning-ok">
          <span class="ui-button-text">OK</span>
        </button>
        <button type="button" class="ui-button" id="institution-warning-cancel">
          <span class="ui-button-text">Cancel</span>
        </button>
      </div>
    </div>
    <input type="button" id="SaveButton" name="ctl00$ctl00$SaveButton" value="Save" />
    <input type="button" id="CancelButton" name="ctl00$ctl00$CancelButton" value="Cancel" />
    </div>
  `;
}

function wireAuthorForm(
  doc: Document,
  options: EditorialManagerFixtureOptions = {},
): void {
  const trigger = doc.getElementById('select-roles-trigger');
  const edit = doc.getElementById('EditButton');
  const panel = doc.getElementById('contributor-roles-panel');
  const openRoles = (event: Event) => {
    event.preventDefault();
    if (!panel) return;
    if (!panel.querySelector('input[type="checkbox"]')) {
      const floppy = panel.querySelector('input[title="Collapse and Save Changes"]');
      panel.insertAdjacentHTML('afterbegin', creditRoleMarkup());
      if (!floppy) {
        panel.insertAdjacentHTML(
          'beforeend',
          `<input type="image" id="SaveButton" title="Collapse and Save Changes" src="Save.gif" />`,
        );
      }
    }
    panel.hidden = false;
  };
  trigger?.addEventListener('click', openRoles);
  edit?.addEventListener('click', openRoles);

  const collapse = panel?.querySelector(
    'input[title="Collapse and Save Changes"]',
  );
  collapse?.addEventListener('click', (event) => {
    event.preventDefault();
    if (panel) panel.hidden = true;
  });

  const INSTITUTION_DIRECTORY = ['University of London'];
  const institutionInput = doc.getElementById('Institution') as HTMLInputElement | null;
  const suggestionList = doc.getElementById('institution-suggestions');
  const unverified = doc.getElementById('institution-unverified');
  let institutionVerified = false;
  const renderSuggestions = () => {
    if (!institutionInput || !suggestionList) return;
    const typed = institutionInput.value.trim().toLowerCase();
    const matches = INSTITUTION_DIRECTORY.filter((name) =>
      name.toLowerCase().includes(typed),
    );
    suggestionList.innerHTML = matches
      .map((name) => `<li role="option" class="ui-menu-item">${name}</li>`)
      .join('');
    suggestionList.hidden = matches.length === 0 || typed.length < 2;
    if (unverified) {
      unverified.hidden = institutionVerified || typed.length === 0;
    }
  };
  institutionInput?.addEventListener('input', () => {
    institutionVerified = false;
    renderSuggestions();
  });
  suggestionList?.addEventListener('click', (event) => {
    const item = (event.target as HTMLElement | null)?.closest('li');
    if (!item || !institutionInput) return;
    institutionInput.value = item.textContent?.trim() ?? '';
    institutionVerified = true;
    suggestionList.hidden = true;
    if (unverified) unverified.hidden = true;
  });

  let institutionProceeded = false;
  let validationProceeded = false;
  const institutionWarning = doc.getElementById('institution-warning');
  const validationIssues = doc.getElementById('validation-issues');
  doc.getElementById('validation-issues-ok')?.addEventListener('click', (event) => {
    event.preventDefault();
    validationProceeded = true;
    if (validationIssues) validationIssues.hidden = true;
    commitAuthor(event);
  });
  doc.getElementById('institution-warning-ok')?.addEventListener('click', (event) => {
    event.preventDefault();
    institutionProceeded = true;
    if (institutionWarning) institutionWarning.hidden = true;
    commitAuthor(event);
  });
  doc
    .getElementById('institution-warning-cancel')
    ?.addEventListener('click', (event) => {
      event.preventDefault();
      if (institutionWarning) institutionWarning.hidden = true;
    });

  const commitAuthor = (event: Event) => {
    event.preventDefault();
    if (options.warnValidationIssues && !validationProceeded) {
      if (validationIssues) validationIssues.hidden = false;
      return;
    }
    if (options.warnUnidentifiedInstitution && !institutionProceeded) {
      if (institutionWarning) institutionWarning.hidden = false;
      return;
    }
    if (options.warnIfNoRole) {
      const ticked = Array.from(
        doc.querySelectorAll<HTMLInputElement>(
          `input[type="checkbox"][id^="${CONTRIBUTOR_ROLE_PREFIX}"]`,
        ),
      ).some((box) => box.checked);
      if (!ticked) {
        const warning = doc.getElementById('roles-warning');
        if (warning) warning.hidden = false;
        return;
      }
    }
    const count = doc.getElementById('authorsCount') as HTMLInputElement | null;
    if (count) {
      count.value = String(Number.parseInt(count.value || '0', 10) + 1);
    }
    for (const id of [
      'FirstName',
      'MiddleName',
      'LastName',
      'Email',
      'Affiliation',
      'Institution',
      'Department',
      'City',
      'State',
      'Zipcode',
    ]) {
      const el = doc.getElementById(id) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (el && 'value' in el) el.value = '';
    }
    const country = doc.getElementById('CountryCode') as HTMLSelectElement | null;
    if (country && 'selectedIndex' in country) country.selectedIndex = 0;
    const corr = doc.getElementById(
      'CorrespondingAuthorCheckbox',
    ) as HTMLInputElement | null;
    if (corr && 'checked' in corr) corr.checked = false;
    const dialog = doc.getElementById('author-dialog');
    if (dialog) dialog.hidden = true;
  };
  doc
    .querySelector('[data-toolname="AuthorSave"]')
    ?.addEventListener('click', commitAuthor);
  Array.from(doc.querySelectorAll('#SaveButton'))
    .filter((el) => el.getAttribute('title') !== 'Collapse and Save Changes')
    .forEach((el) => el.addEventListener('click', commitAuthor));

  const add = [...doc.querySelectorAll('button')].find((el) =>
    /add\s+another\s+author/i.test(el.textContent || ''),
  );
  add?.addEventListener('click', (event) => {
    event.preventDefault();
    const dialog = doc.getElementById('author-dialog');
    if (dialog) dialog.hidden = false;
  });
}

export function mountEditorialManagerFixture(
  options: EditorialManagerFixtureOptions = {},
): Document {
  const inIframe = options.inIframe !== false;
  document.body.innerHTML = `
    <select id="RoleDropdown" name="RoleDropdown">
      <option>Author</option>
      <option>Reviewer</option>
    </select>
    ${inIframe ? '<iframe id="content"></iframe>' : authorFormHtml(options)}
  `;

  if (!inIframe) {
    wireAuthorForm(document, options);
    return document;
  }

  const iframe = document.querySelector('iframe');
  if (!iframe?.contentDocument) {
    throw new Error('jsdom did not provide a same-origin iframe document');
  }
  const child = iframe.contentDocument;
  child.open();
  child.write(
    `<!doctype html><html><body>${authorFormHtml(options)}</body></html>`,
  );
  child.close();
  wireAuthorForm(child, options);
  return child;
}

export function readAuthorForm(doc: Document): {
  firstName: string;
  lastName: string;
  email: string;
  institution: string;
  zipcode: string;
  corresponding: boolean;
  authorsCount: number;
  title: string;
  abstract: string;
} {
  const valueOf = (id: string) => {
    const el = doc.getElementById(id) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    return el && 'value' in el ? el.value : '';
  };
  const corr = doc.getElementById(
    'CorrespondingAuthorCheckbox',
  ) as HTMLInputElement | null;
  return {
    firstName: valueOf('FirstName'),
    lastName: valueOf('LastName'),
    email: valueOf('Email'),
    institution: valueOf('Institution'),
    zipcode: valueOf('Zipcode'),
    corresponding: Boolean(corr?.checked),
    authorsCount: Number.parseInt(valueOf('authorsCount') || '0', 10),
    title: valueOf('txtFullTitle'),
    abstract: valueOf('txtAbstract'),
  };
}
