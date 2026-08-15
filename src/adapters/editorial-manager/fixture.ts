/**
 * Synthetic Editorial Manager author form from the 2026-08-15 PLOS ONE
 * structural capture. Values are test-only; production never ships them.
 */

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
}

const COUNTRIES = ['', 'United States', 'Germany', 'United Kingdom', 'Canada'];

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
    <label for="CountryCode">Country or Region *</label>
    <select id="CountryCode" name="ctl00$CountryCode">${countryOptions}</select>
    <label>
      <input type="checkbox" id="CorrespondingAuthorCheckbox" name="ctl00$CorrespondingAuthorCheckbox" />
      This is the corresponding author
    </label>
    <input type="button" id="SaveButton" name="ctl00$ctl00$SaveButton" value="Save" />
    <input type="button" id="CancelButton" name="ctl00$ctl00$CancelButton" value="Cancel" />
    ${addAnother}
  `;
}

function wireAuthorForm(doc: Document): void {
  const save = doc.getElementById('SaveButton');
  save?.addEventListener('click', (event) => {
    event.preventDefault();
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
    wireAuthorForm(document);
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
  wireAuthorForm(child);
  return child;
}

export function readAuthorForm(doc: Document): {
  firstName: string;
  lastName: string;
  email: string;
  institution: string;
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
    corresponding: Boolean(corr?.checked),
    authorsCount: Number.parseInt(valueOf('authorsCount') || '0', 10),
    title: valueOf('txtFullTitle'),
    abstract: valueOf('txtAbstract'),
  };
}
