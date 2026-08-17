/**
 * Capture-backed ScholarOne author-entry fixture.
 * Field ids mirror the Bioinformatics Manuscript Central compatibility capture.
 * Values are never taken from the live portal — only structural ids/labels.
 */

import {
  ADD_REMOVE_AUTHOR,
  ALERT_BUTTON,
  AUTHOR_EMAIL,
  AUTHOR_FIRST_NAME,
  AUTHOR_LAST_NAME,
  AUTHOR_SALUTATION,
  AUTHORSHIP_CHANGE,
  BTN_PREV,
  BTN_SAVE,
  BTN_SUBMIT,
  CREDIT_DEGREE_PREFIX,
  CREDIT_ROLE_PREFIX,
  EMAIL_SEARCH_MODAL_NO,
  EMAIL_SEARCH_MODAL_YES,
  FIND_AUTHOR_EMAIL,
  SEARCH_AUTHOR,
  UPDATE_AUTHOR_ORDER,
  authorCity,
  authorCountry,
  authorDepartment,
  authorPhone,
  authorInstitutionName,
  authorState,
  authorStateId,
} from './ids';

const CREDIT_ROLES = [
  'Conceptualization',
  'Data curation',
  'Formal analysis',
  'Funding acquisition',
  'Investigation',
  'Methodology',
  'Project administration',
  'Resources',
  'Software',
  'Supervision',
  'Validation',
  'Visualization',
  'Writing - original draft',
  'Writing - review & editing',
] as const;

export interface ScholarOneSavedAuthor {
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  corresponding: boolean;
}

export interface ScholarOneFixtureOptions {
  /** Authors already on the manuscript list. */
  existingAuthors?: ScholarOneSavedAuthor[];
  /** Show the add-author panel immediately. */
  formOpen?: boolean;
  /** Delay before email search resolves. */
  emailLookupMs?: number;
  /**
   * Emails the portal already knows. After search, AUTHOR_* fields are filled
   * from this record (simulating a linked ScholarOne account).
   */
  directory?: Record<
    string,
    Partial<ScholarOneSavedAuthor> & { firstName: string; lastName: string }
  >;
  /** Countries available in COUNTRY_1. */
  countries?: string[];
  /**
   * The portal refuses the commit through its own alert dialog instead of
   * rejecting a field, and shows this text.
   */
  alertOnCommit?: string;
  /**
   * Unknown emails produce the inline "No co-author found … create a new
   * co-author" banner instead of the confirmation modal.
   */
  inlineCreateBanner?: boolean;
  /**
   * Writing a free-text institution shows “Institution not connected to
   * Ringgold” with an OKAY button. Commit stays blocked until OKAY.
   */
  ringgoldOnInstitution?: boolean;
  /**
   * Writing institution shows the generic “An error has occurred. Please
   * try again.” dialog. Close dismisses it; commit stays blocked until then.
   */
  errorOnInstitution?: boolean;
}

export interface ScholarOneFixtureHarness {
  savedAuthors(): ScholarOneSavedAuthor[];
  searchClicks(): number;
  addAuthorClicks(): number;
  saveClicks(): number;
  submitClicks(): number;
  modalYesClicks(): number;
  createCoauthorClicks(): number;
  ringgoldOkayClicks(): number;
  errorCloseClicks(): number;
  /** Name fields written while an email lookup was still in flight. */
  namesWrittenDuringLookup(): number;
  formVisible(): boolean;
}

const DEFAULT_COUNTRIES = [
  '',
  'United States',
  'United Kingdom',
  'Germany',
  'Japan',
  'China',
  'India',
  'Canada',
  'France',
  'Australia',
];

function creditRoleMarkup(): string {
  return CREDIT_ROLES.map(
    (label, index) => `
      <label>
        <input type="checkbox" id="${CREDIT_ROLE_PREFIX}${index}" name="${CREDIT_ROLE_PREFIX}${index}" />
        ${label}
      </label>
      <select id="${CREDIT_DEGREE_PREFIX}${index}" name="${CREDIT_DEGREE_PREFIX}${index}">
        <option value="">Select...</option>
        <option>Equal</option>
        <option>Lead</option>
        <option>Supporting</option>
      </select>`,
  ).join('');
}

export function mountScholarOneFixture(
  options: ScholarOneFixtureOptions = {},
): ScholarOneFixtureHarness {
  const countries = options.countries ?? DEFAULT_COUNTRIES;
  const countryOptions = countries
    .map((c) => `<option value="${c}">${c || 'Select country'}</option>`)
    .join('');

  document.body.innerHTML = `
    <div id="scholarone-root" data-platform="scholarone">
      <header>ScholarOne Manuscripts</header>
      <nav>Authors &amp; Institutions</nav>
      <p class="url-hint">mc.manuscriptcentral.com/bioinformatics</p>

      <table id="author-list">
        <thead>
          <tr><th>Order</th><th>Author</th><th>Email</th><th>Actions</th></tr>
        </thead>
        <tbody id="author-rows"></tbody>
      </table>
      <a href="#" id="${UPDATE_AUTHOR_ORDER}">Update Author Order</a>

      <a href="#" id="open-add-author">Add Author</a>
      <a href="#" id="${ADD_REMOVE_AUTHOR}">Add/Remove Author</a>

      <div id="author-form" ${options.formOpen ? '' : 'hidden'}>
        <h2>Add Author</h2>
        <label for="${FIND_AUTHOR_EMAIL}">Find using Author's email address</label>
        <input type="text" id="${FIND_AUTHOR_EMAIL}" name="${FIND_AUTHOR_EMAIL}" />
        <button type="button" id="${SEARCH_AUTHOR}">Search</button>

        <div id="email-search-modal" hidden>
          <p id="email-search-message">No matching author found. Create a new author?</p>
          <a href="#" id="${EMAIL_SEARCH_MODAL_YES}">Yes</a>
          <a href="#" id="${EMAIL_SEARCH_MODAL_NO}">No</a>
        </div>

        <div id="scholarone-alert" role="dialog" hidden>
          ${options.alertOnCommit ?? ''}
          <a href="#" id="${ALERT_BUTTON}">Ok</a>
        </div>

        <div id="ringgold-dialog" role="dialog" hidden>
          <h2>Institution not connected to Ringgold</h2>
          <p>
            Your selected institution was manually entered and not connected to
            Ringgold. To connect your institution to Ringgold select the
            institution from the dropdown of institutions provided as you type.
          </p>
          <button type="button" id="ringgold-okay">OKAY</button>
        </div>

        <div id="scholarone-error" role="dialog" hidden>
          <h2>Error</h2>
          <p>
            An error has occurred. Please try again. If the problem persists,
            please contact the Support Team for more information and
            instructions.
          </p>
          <button type="button" id="scholarone-error-close">Close</button>
        </div>

        <div id="no-coauthor-banner" hidden>
          No co-author found. Please search again using another e-mail address or
          <a href="#" id="create-new-coauthor">create a new co-author</a>
        </div>

        <div id="author-details" hidden>
          <label for="${AUTHOR_EMAIL}">Email Address</label>
          <input type="text" id="${AUTHOR_EMAIL}" name="${AUTHOR_EMAIL}" />

          <label for="${AUTHOR_SALUTATION}">Salutation</label>
          <select id="${AUTHOR_SALUTATION}" name="${AUTHOR_SALUTATION}">
            <option value=""></option>
            <option>Dr.</option>
            <option>Miss</option>
            <option>Mr.</option>
            <option>Mrs.</option>
            <option>Ms.</option>
            <option>Prof.</option>
            <option>Mx</option>
          </select>

          <label for="${AUTHOR_FIRST_NAME}">First Name</label>
          <input type="text" id="${AUTHOR_FIRST_NAME}" name="${AUTHOR_FIRST_NAME}" />
          <label for="${AUTHOR_LAST_NAME}">Last Name</label>
          <input type="text" id="${AUTHOR_LAST_NAME}" name="${AUTHOR_LAST_NAME}" />

          <fieldset>
            <legend>Contributor roles</legend>
            ${creditRoleMarkup()}
          </fieldset>

          <label for="ORDER_1">Order</label>
          <select id="ORDER_1" name="ORDER_1"><option value="1">1</option></select>

          <label for="combobox-1014-inputEl">Institution</label>
          <input
            type="text"
            id="combobox-1014-inputEl"
            name="${authorInstitutionName(1)}"
          />

          <label for="${authorDepartment(1)}">Department</label>
          <input type="text" id="${authorDepartment(1)}" name="${authorDepartment(1)}" />

          <label for="${authorCountry(1)}">Country</label>
          <select id="${authorCountry(1)}" name="${authorCountry(1)}">${countryOptions}</select>

          <label for="${authorStateId(1)}">State</label>
          <select id="${authorStateId(1)}" name="${authorStateId(1)}">
            <option value=""></option>
            <option>CA</option>
            <option>MA</option>
            <option>NY</option>
          </select>
          <label for="${authorState(1)}">State / Province</label>
          <input type="text" id="${authorState(1)}" name="${authorState(1)}" />

          <label for="${authorCity(1)}">City</label>
          <input type="text" id="${authorCity(1)}" name="${authorCity(1)}" />

          <label for="${authorPhone(1)}">Phone</label>
          <input type="text" id="${authorPhone(1)}" name="${authorPhone(1)}" />

          <label for="${AUTHORSHIP_CHANGE}">Authorship change</label>
          <textarea id="${AUTHORSHIP_CHANGE}" name="${AUTHORSHIP_CHANGE}"></textarea>

          <a href="#" id="commit-add-author">Add Author</a>
          <button type="button" id="close-author-form">Close Author</button>
        </div>
      </div>

      <a href="#" id="${BTN_PREV}">Previous Step</a>
      <a href="#" id="${BTN_SAVE}">Save</a>
      <a href="#" id="${BTN_SUBMIT}" name="AUTHOR_REVIEWERS">Save and Continue</a>
    </div>
  `;

  const saved: ScholarOneSavedAuthor[] = [...(options.existingAuthors ?? [])];
  const directory = options.directory ?? {};
  const form = document.getElementById('author-form')!;
  const details = document.getElementById('author-details')!;
  const modal = document.getElementById('email-search-modal')!;
  const banner = document.getElementById('no-coauthor-banner')!;
  const alertBox = document.getElementById('scholarone-alert')!;
  const ringgoldDialog = document.getElementById('ringgold-dialog')!;
  const errorDialog = document.getElementById('scholarone-error')!;
  const ringgoldOkay = document.getElementById('ringgold-okay') as HTMLButtonElement;
  const errorClose = document.getElementById(
    'scholarone-error-close',
  ) as HTMLButtonElement;
  const institutionInput = document.querySelector<HTMLInputElement>(
    `input[name="${authorInstitutionName(1)}"]`,
  );
  const createCoauthor = document.getElementById('create-new-coauthor')!;
  const rows = document.getElementById('author-rows')!;
  const findEmail = document.getElementById(FIND_AUTHOR_EMAIL) as HTMLInputElement;
  const searchBtn = document.getElementById(SEARCH_AUTHOR) as HTMLButtonElement;
  const openAdd = document.getElementById('open-add-author') as HTMLAnchorElement;
  const commitAdd = document.getElementById('commit-add-author') as HTMLAnchorElement;
  const modalYes = document.getElementById(EMAIL_SEARCH_MODAL_YES) as HTMLAnchorElement;
  const modalNo = document.getElementById(EMAIL_SEARCH_MODAL_NO) as HTMLAnchorElement;
  const saveBtn = document.getElementById(BTN_SAVE) as HTMLAnchorElement;
  const submitBtn = document.getElementById(BTN_SUBMIT) as HTMLAnchorElement;

  let searchClicks = 0;
  let addAuthorClicks = 0;
  let saveClicks = 0;
  let submitClicks = 0;
  let modalYesClicks = 0;
  let createCoauthorClicks = 0;
  let ringgoldOkayClicks = 0;
  let errorCloseClicks = 0;
  let lookupInFlight = false;
  let namesWrittenDuringLookup = 0;
  let pendingEmail = '';

  function readField(id: string): string {
    const el = document.getElementById(id);
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return el.value.trim();
    }
    return '';
  }

  function writeField(id: string, value: string): void {
    const el = document.getElementById(id);
    if (
      !(
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      )
    ) {
      return;
    }
    if (
      lookupInFlight &&
      (id === AUTHOR_FIRST_NAME || id === AUTHOR_LAST_NAME)
    ) {
      namesWrittenDuringLookup += 1;
    }
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clearDetails(): void {
    writeField(AUTHOR_EMAIL, '');
    writeField(AUTHOR_FIRST_NAME, '');
    writeField(AUTHOR_LAST_NAME, '');
    writeField(authorDepartment(1), '');
    writeField(authorCity(1), '');
    writeField(authorState(1), '');
    writeField(authorCountry(1), '');
    writeField(authorPhone(1), '');
    writeField(AUTHOR_SALUTATION, '');
  }

  function renderRows(): void {
    rows.innerHTML = saved
      .map(
        (author, index) => `
        <tr data-author-index="${index + 1}">
          <td>
            <select id="ORDER" name="ORDER">
              ${saved
                .map(
                  (_, i) =>
                    `<option value="${i + 1}"${i === index ? ' selected' : ''}>${i + 1}</option>`,
                )
                .join('')}
            </select>
          </td>
          <td>${author.firstName} ${author.lastName}</td>
          <td>${author.email}</td>
          <td>
            <select id="authActionId" name="AuthAction" data-author-email="${author.email}">
              <option value="">Select...</option>
              <option value="edit">Edit</option>
              <option value="corr">Assign as Corresponding Author</option>
              <option value="remove">Remove</option>
            </select>
          </td>
        </tr>`,
      )
      .join('');

    rows.querySelectorAll<HTMLSelectElement>('select[name="AuthAction"]').forEach((select) => {
      select.addEventListener('change', () => {
        if (select.value !== 'corr') return;
        const email = select.dataset.authorEmail ?? '';
        for (const author of saved) {
          author.corresponding = author.email === email;
        }
        renderRows();
      });
    });
  }

  function openForm(): void {
    form.hidden = false;
    details.hidden = true;
    modal.hidden = true;
    banner.hidden = true;
    ringgoldDialog.hidden = true;
    errorDialog.hidden = true;
    findEmail.value = '';
    clearDetails();
  }

  openAdd.addEventListener('click', (event) => {
    event.preventDefault();
    addAuthorClicks += 1;
    openForm();
  });

  searchBtn.addEventListener('click', () => {
    searchClicks += 1;
    pendingEmail = findEmail.value.trim().toLowerCase();
    lookupInFlight = true;
    details.hidden = true;
    modal.hidden = true;
    const delayMs = options.emailLookupMs ?? 30;

    window.setTimeout(() => {
      lookupInFlight = false;
      const known = directory[pendingEmail];
      if (known) {
        details.hidden = false;
        modal.hidden = true;
        writeField(AUTHOR_EMAIL, pendingEmail);
        writeField(AUTHOR_FIRST_NAME, known.firstName);
        writeField(AUTHOR_LAST_NAME, known.lastName);
        writeField(authorDepartment(1), known.department ?? '');
        writeField(authorCity(1), known.city ?? '');
        writeField(authorState(1), known.state ?? '');
        writeField(authorCountry(1), known.country ?? '');
        writeField(authorPhone(1), known.phone ?? '');
        return;
      }
      if (options.inlineCreateBanner) {
        banner.hidden = false;
        details.hidden = true;
        return;
      }
      modal.hidden = false;
      details.hidden = true;
    }, delayMs);
  });

  createCoauthor.addEventListener('click', (event) => {
    event.preventDefault();
    createCoauthorClicks += 1;
    banner.hidden = true;
    details.hidden = false;
    writeField(AUTHOR_EMAIL, pendingEmail);
  });

  modalYes.addEventListener('click', (event) => {
    event.preventDefault();
    modalYesClicks += 1;
    modal.hidden = true;
    details.hidden = false;
    clearDetails();
    writeField(AUTHOR_EMAIL, pendingEmail);
  });

  modalNo.addEventListener('click', (event) => {
    event.preventDefault();
    modal.hidden = true;
    details.hidden = true;
  });

  institutionInput?.addEventListener('input', () => {
    if (!institutionInput.value.trim()) return;
    if (options.ringgoldOnInstitution) ringgoldDialog.hidden = false;
    if (options.errorOnInstitution) errorDialog.hidden = false;
  });

  ringgoldOkay.addEventListener('click', (event) => {
    event.preventDefault();
    ringgoldOkayClicks += 1;
    ringgoldDialog.hidden = true;
  });

  errorClose.addEventListener('click', (event) => {
    event.preventDefault();
    errorCloseClicks += 1;
    errorDialog.hidden = true;
  });

  commitAdd.addEventListener('click', (event) => {
    event.preventDefault();
    if (!ringgoldDialog.hidden || !errorDialog.hidden) return;
    const email = readField(AUTHOR_EMAIL);
    const firstName = readField(AUTHOR_FIRST_NAME);
    const lastName = readField(AUTHOR_LAST_NAME);
    if (!email || !firstName || !lastName) return;
    if (options.alertOnCommit) {
      alertBox.hidden = false;
      return;
    }
    saved.push({
      email,
      firstName,
      lastName,
      department: readField(authorDepartment(1)),
      city: readField(authorCity(1)),
      state: readField(authorState(1)),
      country: readField(authorCountry(1)),
      phone: readField(authorPhone(1)),
      corresponding: false,
    });
    renderRows();
    form.hidden = true;
    details.hidden = true;
    modal.hidden = true;
  });

  saveBtn.addEventListener('click', (event) => {
    event.preventDefault();
    saveClicks += 1;
  });

  submitBtn.addEventListener('click', (event) => {
    event.preventDefault();
    submitClicks += 1;
  });

  // Track programmatic name writes during lookup via property setters.
  for (const id of [AUTHOR_FIRST_NAME, AUTHOR_LAST_NAME]) {
    const input = document.getElementById(id) as HTMLInputElement;
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    );
    Object.defineProperty(input, 'value', {
      configurable: true,
      enumerable: true,
      get() {
        return descriptor?.get?.call(this) ?? '';
      },
      set(next: string) {
        if (lookupInFlight) namesWrittenDuringLookup += 1;
        descriptor?.set?.call(this, next);
      },
    });
  }

  renderRows();

  return {
    savedAuthors: () => saved.map((author) => ({ ...author })),
    searchClicks: () => searchClicks,
    addAuthorClicks: () => addAuthorClicks,
    saveClicks: () => saveClicks,
    submitClicks: () => submitClicks,
    modalYesClicks: () => modalYesClicks,
    createCoauthorClicks: () => createCoauthorClicks,
    ringgoldOkayClicks: () => ringgoldOkayClicks,
    errorCloseClicks: () => errorCloseClicks,
    namesWrittenDuringLookup: () => namesWrittenDuringLookup,
    formVisible: () => !form.hidden,
  };
}
