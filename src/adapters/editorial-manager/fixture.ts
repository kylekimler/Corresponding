/** Editorial Manager Manuscript Data fixture from official Aries EM Help labels. */

export interface EditorialManagerAuthorSeed {
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
  equalContribution?: boolean;
  conflictOfInterest?: string;
  linkedPid?: string;
}

export interface EditorialManagerFixtureOptions {
  slots: number;
  authors?: EditorialManagerAuthorSeed[];
  countries?: string[];
  includeOverlay?: boolean;
  includeCoi?: boolean;
  includeSubmitControls?: boolean;
  additionalInfoOnly?: boolean;
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
  seed: EditorialManagerAuthorSeed,
  countries: string[],
): string {
  return `
    <fieldset class="em-author" data-author-slot="${index}">
      <legend>Author ${index}</legend>
      <label for="em_author_${index}_given_first_name">Given/First Name</label>
      <input id="em_author_${index}_given_first_name" name="em_author_${index}_given_first_name" type="text" value="${seed.first ?? ''}" />
      <label for="em_author_${index}_middle_name">Middle Name</label>
      <input id="em_author_${index}_middle_name" name="em_author_${index}_middle_name" type="text" value="${seed.middle ?? ''}" />
      <label for="em_author_${index}_family_last_name">Family/Last Name</label>
      <input id="em_author_${index}_family_last_name" name="em_author_${index}_family_last_name" type="text" value="${seed.last ?? ''}" />
      <label for="em_author_${index}_email">Email Address</label>
      <input id="em_author_${index}_email" name="em_author_${index}_email" type="text" value="${seed.email ?? ''}" />
      <label for="em_author_${index}_orcid">ORCID</label>
      <input id="em_author_${index}_orcid" name="em_author_${index}_orcid" type="text" value="${seed.orcid ?? ''}" />
      <label for="em_author_${index}_institution">Institution</label>
      <input id="em_author_${index}_institution" name="em_author_${index}_institution" type="text" value="${seed.institution ?? ''}" />
      <label for="em_author_${index}_department">Department</label>
      <input id="em_author_${index}_department" name="em_author_${index}_department" type="text" value="${seed.department ?? ''}" />
      <label for="em_author_${index}_city">City</label>
      <input id="em_author_${index}_city" name="em_author_${index}_city" type="text" value="${seed.city ?? ''}" />
      <label for="em_author_${index}_state">State or Province</label>
      <input id="em_author_${index}_state" name="em_author_${index}_state" type="text" value="${seed.state ?? ''}" />
      <label for="em_author_${index}_country">Country or Region</label>
      <select id="em_author_${index}_country" name="em_author_${index}_country">${countryOptions(seed.country, countries)}</select>
      <label for="em_author_${index}_corresponding">
        <input id="em_author_${index}_corresponding" name="em_author_${index}_corresponding" type="checkbox"${seed.corresponding ? ' checked' : ''} />
        Corresponding Author
      </label>
      <label for="em_author_${index}_equal">
        <input id="em_author_${index}_equal" name="em_author_${index}_equal" type="checkbox"${seed.equalContribution ? ' checked' : ''} />
        Equal Contribution Status
      </label>
      <input id="em_author_${index}_people_id" name="em_author_${index}_people_id" type="hidden" value="${seed.linkedPid ?? ''}" />
    </fieldset>
  `;
}

export function buildEditorialManagerFixtureHtml(
  options: EditorialManagerFixtureOptions,
): string {
  const countries = options.countries ?? DEFAULT_COUNTRIES;
  const includeCoi = options.includeCoi !== false;
  const includeSubmit = options.includeSubmitControls !== false;
  const slots = options.additionalInfoOnly ? 0 : options.slots;
  const parts: string[] = [];
  parts.push('<div id="em-root" data-platform="editorial-manager">');
  parts.push('<header>Editorial Manager</header>');
  parts.push(
    options.additionalInfoOnly
      ? '<nav>Additional Information</nav><h1>Additional Information</h1>'
      : '<nav>Manuscript Data</nav><h1>Manuscript Data</h1>',
  );

  if (!options.additionalInfoOnly) {
    parts.push('<section id="em-authors"><h2>Authors</h2>');
    parts.push('<div id="em-author-list">');
    for (let i = 1; i <= slots; i += 1) {
      parts.push(authorSlotHtml(i, options.authors?.[i - 1] ?? {}, countries));
    }
    parts.push('</div>');
    parts.push(
      '<button type="button" id="em-add-another-author">+Add Another Author</button>',
    );
    parts.push('</section>');
  }

  if (options.includeOverlay) {
    parts.push(`
      <div id="em-author-overlay" hidden data-author-overlay>
        <h2>Enter Author Details</h2>
        <label for="em_overlay_given_first_name">Given/First Name</label>
        <input id="em_overlay_given_first_name" name="em_overlay_given_first_name" type="text" />
        <label for="em_overlay_family_last_name">Family/Last Name</label>
        <input id="em_overlay_family_last_name" name="em_overlay_family_last_name" type="text" />
        <label for="em_overlay_email">Email Address</label>
        <input id="em_overlay_email" name="em_overlay_email" type="text" />
        <label for="em_overlay_institution">Institution</label>
        <input id="em_overlay_institution" name="em_overlay_institution" type="text" />
        <label for="em_overlay_country">Country or Region</label>
        <select id="em_overlay_country" name="em_overlay_country">${countryOptions(undefined, countries)}</select>
        <label for="em_overlay_corresponding">
          <input id="em_overlay_corresponding" type="checkbox" />
          Corresponding Author
        </label>
        <button type="button" id="em-save-author">Save</button>
        <button type="button" id="em-save-and-add">Save and Add</button>
      </div>
    `);
  }

  if (includeCoi) {
    parts.push(`
      <section id="em-additional">
        <h2>Additional Information</h2>
        <label for="em_competing_interests">Competing Interests</label>
        <textarea id="em_competing_interests" name="em_competing_interests"></textarea>
        <label for="em_coi_attest">
          <input id="em_coi_attest" name="em_coi_attest" type="checkbox" />
          I attest that I have disclosed all conflicts of interest
        </label>
      </section>
    `);
  }

  if (includeSubmit) {
    parts.push(`
      <button type="button" id="em-proceed">Proceed</button>
      <button type="button" id="em-build-pdf">Build PDF for Approval</button>
      <button type="button" id="em-approve">Approve Submission</button>
    `);
  }

  parts.push('</div>');
  return parts.join('\n');
}

function bindOverlay(doc: Document): void {
  const add = doc.getElementById('em-add-another-author');
  const overlay = doc.getElementById('em-author-overlay');
  const save = doc.getElementById('em-save-author');
  const list = doc.getElementById('em-author-list');
  if (!add || !overlay || !save || !list) return;

  const saveAndAdd = doc.getElementById('em-save-and-add');
  add.addEventListener('click', () => {
    overlay.hidden = false;
  });
  const commitOverlay = () => {
    const next = list.querySelectorAll('[data-author-slot]').length + 1;
    const seed: EditorialManagerAuthorSeed = {
      first: (
        doc.getElementById('em_overlay_given_first_name') as HTMLInputElement | null
      )?.value,
      last: (
        doc.getElementById('em_overlay_family_last_name') as HTMLInputElement | null
      )?.value,
      email: (doc.getElementById('em_overlay_email') as HTMLInputElement | null)
        ?.value,
      institution: (
        doc.getElementById('em_overlay_institution') as HTMLInputElement | null
      )?.value,
      country: (doc.getElementById('em_overlay_country') as HTMLSelectElement | null)
        ?.value,
      corresponding: (
        doc.getElementById('em_overlay_corresponding') as HTMLInputElement | null
      )?.checked,
    };
    list.insertAdjacentHTML('beforeend', authorSlotHtml(next, seed, DEFAULT_COUNTRIES));
    overlay.hidden = true;
    for (const id of [
      'em_overlay_given_first_name',
      'em_overlay_family_last_name',
      'em_overlay_email',
      'em_overlay_institution',
    ]) {
      const el = doc.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = '';
    }
  };
  save.addEventListener('click', commitOverlay);
  saveAndAdd?.addEventListener('click', commitOverlay);
}

export function mountEditorialManagerFixture(
  options: EditorialManagerFixtureOptions,
): Document {
  document.body.innerHTML = buildEditorialManagerFixtureHtml(options);
  bindOverlay(document);
  return document;
}
