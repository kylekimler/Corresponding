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
  /**
   * Manuscript Data authors list: the Add New Author dialog starts closed.
   * Fill must click Add Author before the form is reachable.
   */
  startOnAuthorsList?: boolean;
  /** Visible label on `.fl-add-btn`. Defaults to Add Another Author. */
  addAuthorLabel?: string;
  /**
   * Live jQuery UI warnings are appended to the parent page body, not the
   * author-form iframe. Fill still runs in the iframe.
   */
  dialogsOnParent?: boolean;
  /**
   * After a successful save, show “Cannot Save Author” / wrong-format over
   * the author list. OK dismisses it; Add Author is blocked until then.
   */
  warnWrongFormatAfterSave?: boolean;
  /**
   * Live PLOS: after Save the Add New Author iframe is hidden on the parent
   * list, but FirstName remains in that frame. Add Another Author lives on
   * the list (`button.fl-add-btn`), not in the closed frame.
   */
  hideAuthorFrameAfterSave?: boolean;
  /**
   * A closed Add New Author iframe left in the DOM with leftover values.
   * Fill must write the next author into the visible form, not this ghost.
   */
  staleHiddenAuthorFrame?: boolean;
  /**
   * After Add Another Author, put the just-saved name back in the form.
   * Live PLOS often leaves Ada in the next dialog; the popup Overwrite
   * toggle is off, so Fill must still replace that leftover.
   */
  reopenWithPreviousAuthor?: boolean;
  /**
   * Validation OK commits the author to the list but leaves Add New Author
   * open with that person still in the fields (live PLOS red-bang row).
   * Fill must wait for the list row, then Add Another Author — not write
   * the next person into the still-bound dialog.
   */
  leaveFormOpenAfterValidationOk?: boolean;
  /**
   * Delay Current Author List / authorsCount after Save. Overwriting the
   * open form before this fires drops the pending row (live race).
   */
  delayListCommitMs?: number;
  /**
   * After identity fields are written, paint a different person (live PLOS
   * late re-render). Fill must rewrite and only Save once the intended
   * author is still in the form.
   */
  lateFlipIdentity?: {
    firstName: string;
    lastName: string;
    email: string;
    delayMs?: number;
  };
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
      : `<button type="button" id="add-another-author" class="fl-add-btn">${options.addAuthorLabel ?? 'Add Another Author'}</button>`;

  return `
    ${manuscript}
    <input type="text" id="authorsCount" name="authorsCount" value="0" />
    ${addAnother}
    <div id="author-dialog"${options.startOnAuthorsList ? ' hidden' : ''}>
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
        <a id="save-and-add" href="#">
          <img title="Save and Add Another Author" alt="Save and Add Another Author" />
        </a>
      </div>
    </div>
    <div id="validation-issues" class="ui-dialog" hidden>
      <div class="ui-dialog-titlebar">Warning</div>
      Validation found issues. Review the highlighted counts and form.
      <div class="ui-dialog-buttonset">
        <button
          type="button"
          class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only"
          role="button"
          id="validation-issues-ok"
        >
          <span class="ui-button-text">OK</span>
        </button>
      </div>
    </div>
    <div
      id="institution-warning"
      class="ui-dialog ui-front no-close ui-dialog-buttons"
      role="alertdialog"
      hidden
    >
      <div class="ui-dialog-titlebar">Warning</div>
      The Institution could not be identified by the system. Proceed with this
      Institution anyway?
      <div class="ui-dialog-buttonset">
        <button
          type="button"
          class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only"
          role="button"
          id="institution-warning-ok"
        >
          <span class="ui-button-text">OK</span>
        </button>
        <button
          type="button"
          class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only"
          role="button"
          id="institution-warning-cancel"
        >
          <span class="ui-button-text">Cancel</span>
        </button>
      </div>
    </div>
    <div
      id="wrong-format"
      class="ui-dialog ui-front no-close ui-dialog-buttons"
      role="alertdialog"
      hidden
    >
      <div class="ui-dialog-titlebar">Cannot Save Author</div>
      Some of the information entered is in the wrong format. Please correct
      the indicated fields before saving.
      <div class="ui-dialog-buttonset">
        <button
          type="button"
          class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only"
          role="button"
          id="wrong-format-ok"
        >
          <span class="ui-button-text">OK</span>
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

  const INSTITUTION_DIRECTORY = [
    'Safran Aircraft Engines',
    'MTU Aero Engines AG',
    'University of London',
  ];
  const institutionInput = doc.getElementById('Institution') as HTMLInputElement | null;
  const suggestionList = doc.getElementById('institution-suggestions');
  const unverified = doc.getElementById('institution-unverified');
  let institutionVerified = false;
  const renderSuggestions = () => {
    if (!institutionInput || !suggestionList) return;
    const typed = institutionInput.value.trim().toLowerCase();
    const tokens = typed.split(/\s+/).filter((token) => token.length >= 3);
    const matches = INSTITUTION_DIRECTORY.filter((name) => {
      const lower = name.toLowerCase();
      if (lower.includes(typed) || typed.includes(lower)) return true;
      return tokens.some((token) => lower.includes(token));
    });
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
    // Live Ringgold clears City/Department until a directory pick.
    const city = doc.getElementById('City') as HTMLInputElement | null;
    const department = doc.getElementById('Department') as HTMLInputElement | null;
    if (city) city.value = '';
    if (department) department.value = '';
  });
  institutionInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !suggestionList) return;
    suggestionList.hidden = true;
  });
  // Live Ringgold is a body-level jQuery UI menu. Escape on the input does
  // not close it, and it sits over the toolbox floppy.
  const overlay = doc.createElement('ul');
  overlay.className =
    'ui-autocomplete ui-menu ui-widget ui-widget-content ui-front';
  overlay.setAttribute('role', 'listbox');
  overlay.hidden = true;
  overlay.style.display = 'none';
  doc.body.append(overlay);
  institutionInput?.addEventListener('input', () => {
    overlay.innerHTML = suggestionList?.innerHTML ?? '';
    if ((suggestionList?.querySelectorAll('li').length ?? 0) > 0) {
      overlay.hidden = false;
      overlay.style.display = 'block';
    }
  });
  const saveButton = doc.querySelector<HTMLElement>(
    '[data-toolname="AuthorSave"]',
  );
  saveButton?.addEventListener(
    'click',
    (event) => {
      const blocking =
        !overlay.hidden && overlay.style.display !== 'none';
      if (!blocking) return;
      event.stopImmediatePropagation();
      event.preventDefault();
    },
    true,
  );
  suggestionList?.addEventListener('click', (event) => {
    const item = (event.target as HTMLElement | null)?.closest('li');
    if (!item || !institutionInput) return;
    institutionInput.value = item.textContent?.trim() ?? '';
    institutionVerified = true;
    suggestionList.hidden = true;
    if (unverified) unverified.hidden = true;
  });

  const listHost = (): Document => {
    try {
      const parentDoc = doc.defaultView?.parent?.document;
      if (parentDoc && parentDoc !== doc) return parentDoc;
    } catch {
      // Cross-origin parent; stay on the form document.
    }
    return doc;
  };

  const ensureAuthorList = (): HTMLElement => {
    const host = listHost();
    let list = host.getElementById('current-author-list');
    if (!list) {
      list = host.createElement('div');
      list.id = 'current-author-list';
      list.innerHTML =
        '<div>Current Author List</div><div id="committed-authors"></div>';
      host.body.append(list);
    }
    if (!list.querySelector('#committed-authors')) {
      const rows = host.createElement('div');
      rows.id = 'committed-authors';
      list.append(rows);
    }
    return list;
  };

  const readFormIdentity = () => ({
    firstName:
      (doc.getElementById('FirstName') as HTMLInputElement | null)?.value ?? '',
    lastName:
      (doc.getElementById('LastName') as HTMLInputElement | null)?.value ?? '',
    email: (doc.getElementById('Email') as HTMLInputElement | null)?.value ?? '',
  });

  const publishCommittedAuthor = (identity: {
    firstName: string;
    lastName: string;
    email: string;
  }) => {
    const apply = () => {
      const list = ensureAuthorList();
      const rows =
        list.querySelector('#committed-authors') ??
        list.appendChild(list.ownerDocument.createElement('div'));
      if (!rows.id) rows.id = 'committed-authors';
      const row = list.ownerDocument.createElement('div');
      row.textContent = `${identity.firstName} ${identity.lastName}`.trim();
      rows.append(row);
      const count = doc.getElementById('authorsCount') as HTMLInputElement | null;
      if (count) {
        count.value = String(Number.parseInt(count.value || '0', 10) + 1);
      }
    };
    const delayMs = options.delayListCommitMs ?? 0;
    if (delayMs <= 0) {
      apply();
      return;
    }
    window.setTimeout(() => {
      const current = readFormIdentity();
      const samePerson =
        current.firstName === identity.firstName &&
        current.lastName === identity.lastName;
      const cleared = !current.firstName && !current.lastName;
      if (samePerson || cleared) apply();
    }, delayMs);
  };

  let lateFlipArmed = Boolean(options.lateFlipIdentity);
  const firstNameInput = doc.getElementById('FirstName') as HTMLInputElement | null;
  firstNameInput?.addEventListener('input', () => {
    const flip = options.lateFlipIdentity;
    if (!flip || !lateFlipArmed) return;
    lateFlipArmed = false;
    window.setTimeout(() => {
      const first = doc.getElementById('FirstName') as HTMLInputElement | null;
      const last = doc.getElementById('LastName') as HTMLInputElement | null;
      const mail = doc.getElementById('Email') as HTMLInputElement | null;
      if (first) first.value = flip.firstName;
      if (last) last.value = flip.lastName;
      if (mail) mail.value = flip.email;
    }, flip.delayMs ?? 80);
  });

  let lastCommitted = { firstName: '', lastName: '', email: '' };
  const restorePreviousAuthor = () => {
    if (!options.reopenWithPreviousAuthor) return;
    const first = doc.getElementById('FirstName') as HTMLInputElement | null;
    const last = doc.getElementById('LastName') as HTMLInputElement | null;
    const email = doc.getElementById('Email') as HTMLInputElement | null;
    if (first) first.value = lastCommitted.firstName;
    if (last) last.value = lastCommitted.lastName;
    if (email) email.value = lastCommitted.email;
  };
  let institutionProceeded = false;
  let validationProceeded = false;
  let institutionOkClicks = 0;
  let wrongFormatDismissed = false;
  const institutionWarning = doc.getElementById('institution-warning');
  const validationIssues = doc.getElementById('validation-issues');
  const wrongFormat = doc.getElementById('wrong-format');
  doc.getElementById('validation-issues-ok')?.addEventListener('click', (event) => {
    event.preventDefault();
    validationProceeded = true;
    if (validationIssues) validationIssues.hidden = true;
    if (options.leaveFormOpenAfterValidationOk) {
      lastCommitted = readFormIdentity();
      publishCommittedAuthor(lastCommitted);
      // Next Save shows the same click-through again, like live PLOS.
      validationProceeded = false;
      return;
    }
    commitAuthor(event);
  });
  // Live jQuery UI often ignores the first Warning OK click (focus only),
  // same as the toolbox floppy. Proceed on the third click.
  doc.getElementById('institution-warning-ok')?.addEventListener('click', (event) => {
    event.preventDefault();
    if (institutionProceeded) return;
    institutionOkClicks += 1;
    if (institutionOkClicks < 3) return;
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
  doc.getElementById('wrong-format-ok')?.addEventListener('click', (event) => {
    event.preventDefault();
    wrongFormatDismissed = true;
    if (wrongFormat) wrongFormat.hidden = true;
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
    lastCommitted = readFormIdentity();
    publishCommittedAuthor(lastCommitted);
    const frameEl = doc.defaultView?.frameElement as HTMLElement | null;
    if (frameEl) {
      frameEl.dataset.leftoverFirst = lastCommitted.firstName;
      frameEl.dataset.leftoverLast = lastCommitted.lastName;
      frameEl.dataset.leftoverEmail = lastCommitted.email;
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
    const frame = doc.defaultView?.frameElement as HTMLElement | null;
    if (options.hideAuthorFrameAfterSave && frame) {
      frame.hidden = true;
      frame.style.display = 'none';
    } else if (dialog) {
      dialog.hidden = true;
    }
    if (options.warnWrongFormatAfterSave && wrongFormat) {
      wrongFormatDismissed = false;
      wrongFormat.hidden = false;
    }
  };
  doc
    .querySelector('[data-toolname="AuthorSave"]')
    ?.addEventListener('click', commitAuthor);
  Array.from(doc.querySelectorAll('#SaveButton'))
    .filter((el) => el.getAttribute('title') !== 'Collapse and Save Changes')
    .forEach((el) => el.addEventListener('click', commitAuthor));

  const add = [...doc.querySelectorAll('button')].find((el) =>
    /add\s+(?:another\s+|new\s+)?authors?\b/i.test(el.textContent || ''),
  );
  add?.addEventListener('click', (event) => {
    event.preventDefault();
    if (
      options.warnWrongFormatAfterSave &&
      !wrongFormatDismissed &&
      wrongFormat &&
      !wrongFormat.hidden
    ) {
      return;
    }
    const frame = doc.defaultView?.frameElement as HTMLElement | null;
    if (frame) {
      frame.hidden = false;
      frame.style.display = '';
    }
    const dialog = doc.getElementById('author-dialog');
    if (dialog) dialog.hidden = false;
    restorePreviousAuthor();
    lateFlipArmed = Boolean(options.lateFlipIdentity);
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
  if (options.staleHiddenAuthorFrame) {
    const ghost = document.createElement('iframe');
    ghost.id = 'stale-author-frame';
    ghost.hidden = true;
    ghost.style.display = 'none';
    document.body.insertBefore(ghost, iframe);
    const ghostDoc = ghost.contentDocument;
    if (ghostDoc) {
      ghostDoc.open();
      ghostDoc.write(`<!doctype html><html><body>
        <input id="FirstName" value="Ada" />
        <input id="LastName" value="Lovelace" />
        <input id="Email" value="ada@example.org" />
      </body></html>`);
      ghostDoc.close();
    }
  }
  if (options.dialogsOnParent) {
    for (const id of [
      'institution-warning',
      'validation-issues',
      'wrong-format',
    ]) {
      const node = child.getElementById(id);
      if (node) document.body.append(node);
    }
  }
  if (options.hideAuthorFrameAfterSave) {
    const list = document.createElement('div');
    list.id = 'current-author-list';
    list.innerHTML = `
      <div>Current Author List</div>
      <div id="committed-authors"></div>
      <button type="button" class="fl-add-btn" id="list-add-top">+ Add Another Author</button>
      <button type="button" class="fl-add-btn" id="list-add-bottom">+ Add Another Author</button>
    `;
    document.body.append(list);
    const reopen = (event: Event) => {
      event.preventDefault();
      iframe.hidden = false;
      iframe.style.display = '';
      const dialog = child.getElementById('author-dialog');
      if (dialog) dialog.hidden = false;
      if (options.reopenWithPreviousAuthor) {
        const first = child.getElementById('FirstName') as HTMLInputElement | null;
        const last = child.getElementById('LastName') as HTMLInputElement | null;
        const mail = child.getElementById('Email') as HTMLInputElement | null;
        if (first) first.value = iframe.dataset.leftoverFirst ?? '';
        if (last) last.value = iframe.dataset.leftoverLast ?? '';
        if (mail) mail.value = iframe.dataset.leftoverEmail ?? '';
      }
    };
    for (const btn of list.querySelectorAll('button')) {
      btn.addEventListener('click', reopen);
    }
  }
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
