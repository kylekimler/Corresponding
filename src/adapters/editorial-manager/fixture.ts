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
      : `<button type="button" id="add-another-author">+ Add Another Author</button>`;

  return `
    ${manuscript}
    <input type="text" id="authorsCount" name="authorsCount" value="0" />
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
    <input type="button" id="SaveButton" name="ctl00$ctl00$SaveButton" value="Save" />
    <input type="button" id="CancelButton" name="ctl00$ctl00$CancelButton" value="Cancel" />
    ${addAnother}
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

  const save = doc.getElementById('SaveButton');
  save?.addEventListener('click', (event) => {
    event.preventDefault();
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
  });

  const add = [...doc.querySelectorAll('button')].find((el) =>
    /add\s+another\s+author/i.test(el.textContent || ''),
  );
  add?.addEventListener('click', (event) => {
    event.preventDefault();
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
