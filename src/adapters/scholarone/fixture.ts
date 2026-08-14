/** ScholarOne Authors & Institutions fixture from official Author Center labels. */

export interface ScholarOneAuthorSeed {
  first?: string;
  middle?: string;
  last?: string;
  email?: string;
  orcid?: string;
  institution?: string;
  department?: string;
  city?: string;
  state?: string;
  country?: string;
  corresponding?: boolean;
  conflictOfInterest?: string;
  linkedPid?: string;
}

export interface ScholarOneFixtureOptions {
  slots: number;
  authors?: ScholarOneAuthorSeed[];
  countries?: string[];
  includeOverlay?: boolean;
  includeCoi?: boolean;
  includeSubmitControls?: boolean;
  detailsOnly?: boolean;
}

const DEFAULT_COUNTRIES = [
  '',
  'United States',
  'United Kingdom',
  'Germany',
  'Japan',
  'China',
  'India',
  'Brazil',
  'Canada',
  'France',
  'Australia',
];

function countryOptions(selected: string | undefined, countries: string[]): string {
  return countries
    .map((c) => {
      const sel = selected && selected === c ? ' selected' : '';
      return `<option value="${c}"${sel}>${c || 'Select country'}</option>`;
    })
    .join('');
}

function authorSlotHtml(
  index: number,
  seed: ScholarOneAuthorSeed,
  countries: string[],
): string {
  return `
    <fieldset class="s1-author" data-author-slot="${index}">
      <legend>Author ${index}</legend>
      <label for="s1_author_${index}_first_name">First Name</label>
      <input id="s1_author_${index}_first_name" name="s1_author_${index}_first_name" type="text" value="${seed.first ?? ''}" />
      <label for="s1_author_${index}_middle_name">Middle Name</label>
      <input id="s1_author_${index}_middle_name" name="s1_author_${index}_middle_name" type="text" value="${seed.middle ?? ''}" />
      <label for="s1_author_${index}_last_name">Last Name</label>
      <input id="s1_author_${index}_last_name" name="s1_author_${index}_last_name" type="text" value="${seed.last ?? ''}" />
      <label for="s1_author_${index}_email">Email Address</label>
      <input id="s1_author_${index}_email" name="s1_author_${index}_email" type="text" value="${seed.email ?? ''}" />
      <label for="s1_author_${index}_orcid">ORCID</label>
      <input id="s1_author_${index}_orcid" name="s1_author_${index}_orcid" type="text" value="${seed.orcid ?? ''}" />
      <label for="s1_author_${index}_institution">Institution</label>
      <input id="s1_author_${index}_institution" name="s1_author_${index}_institution" type="text" value="${seed.institution ?? ''}" />
      <label for="s1_author_${index}_department">Department</label>
      <input id="s1_author_${index}_department" name="s1_author_${index}_department" type="text" value="${seed.department ?? ''}" />
      <label for="s1_author_${index}_city">City</label>
      <input id="s1_author_${index}_city" name="s1_author_${index}_city" type="text" value="${seed.city ?? ''}" />
      <label for="s1_author_${index}_state">State or Province</label>
      <input id="s1_author_${index}_state" name="s1_author_${index}_state" type="text" value="${seed.state ?? ''}" />
      <label for="s1_author_${index}_country">Country</label>
      <select id="s1_author_${index}_country" name="s1_author_${index}_country">${countryOptions(seed.country, countries)}</select>
      <label for="s1_author_${index}_corresponding">
        <input id="s1_author_${index}_corresponding" name="s1_author_${index}_corresponding" type="checkbox"${seed.corresponding ? ' checked' : ''} />
        Corresponding Author
      </label>
      <label for="s1_author_${index}_coi">Conflict of Interest</label>
      <textarea id="s1_author_${index}_coi" name="s1_author_${index}_coi">${seed.conflictOfInterest ?? ''}</textarea>
      <input id="s1_author_${index}_user_id" name="s1_author_${index}_user_id" type="hidden" value="${seed.linkedPid ?? ''}" />
    </fieldset>
  `;
}

export function buildScholarOneFixtureHtml(
  options: ScholarOneFixtureOptions,
): string {
  const countries = options.countries ?? DEFAULT_COUNTRIES;
  const includeCoi = options.includeCoi !== false;
  const includeSubmit = options.includeSubmitControls !== false;
  const slots = options.detailsOnly ? 0 : options.slots;
  const parts: string[] = [];
  parts.push('<div id="s1-root" data-platform="scholarone">');
  parts.push('<header>ScholarOne Manuscripts — Manuscript Central</header>');
  parts.push(
    options.detailsOnly
      ? '<nav>Step 5 – Details &amp; Comments</nav><h1>Details &amp; Comments</h1>'
      : '<nav>Step 4 – Authors &amp; Institutions</nav><h1>Authors &amp; Institutions</h1>',
  );
  parts.push(
    '<p>Search by email, then Create New Author if no matching account is found. Institution uses Ringgold Identify.</p>',
  );

  if (!options.detailsOnly) {
    parts.push('<div id="s1-author-list">');
    for (let i = 1; i <= slots; i += 1) {
      parts.push(authorSlotHtml(i, options.authors?.[i - 1] ?? {}, countries));
    }
    parts.push('</div>');
    parts.push(
      '<label for="s1_search_email">Email</label><input id="s1_search_email" type="text" />',
    );
    parts.push(
      '<button type="button" id="s1-search">Search</button>',
      '<button type="button" id="s1-create-new-author">Create New Author</button>',
    );
  }

  if (options.includeOverlay) {
    parts.push(`
      <div id="s1-author-overlay" hidden data-author-overlay>
        <h2>Create New Author</h2>
        <label for="s1_overlay_first_name">First Name</label>
        <input id="s1_overlay_first_name" name="s1_overlay_first_name" type="text" />
        <label for="s1_overlay_last_name">Last Name</label>
        <input id="s1_overlay_last_name" name="s1_overlay_last_name" type="text" />
        <label for="s1_overlay_email">Email Address</label>
        <input id="s1_overlay_email" name="s1_overlay_email" type="text" />
        <label for="s1_overlay_institution">Institution</label>
        <input id="s1_overlay_institution" name="s1_overlay_institution" type="text" />
        <label for="s1_overlay_country">Country</label>
        <select id="s1_overlay_country" name="s1_overlay_country">${countryOptions(undefined, countries)}</select>
        <label for="s1_overlay_corresponding">
          <input id="s1_overlay_corresponding" type="checkbox" />
          Corresponding Author
        </label>
        <button type="button" id="s1-add-created-author">Add Created Author</button>
      </div>
    `);
  }

  if (includeCoi) {
    parts.push(`
      <section id="s1-details">
        <h2>Details &amp; Comments</h2>
        <label for="s1_conflict_of_interest">Conflict of Interest</label>
        <textarea id="s1_conflict_of_interest" name="s1_conflict_of_interest"></textarea>
        <label for="s1_coi_attest">
          <input id="s1_coi_attest" name="s1_coi_attest" type="checkbox" />
          I certify I have no conflicts of interest
        </label>
      </section>
    `);
  }

  if (includeSubmit) {
    parts.push(`
      <button type="button" id="s1-save-continue">Save and Continue</button>
      <button type="submit" id="s1-submit">Submit Manuscript</button>
    `);
  }

  parts.push('</div>');
  return parts.join('\n');
}

function bindOverlay(doc: Document): void {
  const create = doc.getElementById('s1-create-new-author');
  const overlay = doc.getElementById('s1-author-overlay');
  const save = doc.getElementById('s1-add-created-author');
  const list = doc.getElementById('s1-author-list');
  if (!create || !overlay || !save || !list) return;

  create.addEventListener('click', () => {
    overlay.hidden = false;
  });
  save.addEventListener('click', () => {
    const next = list.querySelectorAll('[data-author-slot]').length + 1;
    const seed: ScholarOneAuthorSeed = {
      first: (doc.getElementById('s1_overlay_first_name') as HTMLInputElement | null)
        ?.value,
      last: (doc.getElementById('s1_overlay_last_name') as HTMLInputElement | null)
        ?.value,
      email: (doc.getElementById('s1_overlay_email') as HTMLInputElement | null)
        ?.value,
      institution: (
        doc.getElementById('s1_overlay_institution') as HTMLInputElement | null
      )?.value,
      country: (doc.getElementById('s1_overlay_country') as HTMLSelectElement | null)
        ?.value,
      corresponding: (
        doc.getElementById('s1_overlay_corresponding') as HTMLInputElement | null
      )?.checked,
    };
    list.insertAdjacentHTML('beforeend', authorSlotHtml(next, seed, DEFAULT_COUNTRIES));
    overlay.hidden = true;
    for (const id of [
      's1_overlay_first_name',
      's1_overlay_last_name',
      's1_overlay_email',
      's1_overlay_institution',
    ]) {
      const el = doc.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = '';
    }
  });
}

export function mountScholarOneFixture(
  options: ScholarOneFixtureOptions,
): Document {
  document.body.innerHTML = buildScholarOneFixtureHtml(options);
  bindOverlay(document);
  return document;
}
