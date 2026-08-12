/** Build a synthetic Nature MTS / eJournalPress author-entry DOM for tests. */

export interface FixtureAuthorSeed {
  first?: string;
  middle?: string;
  last?: string;
  email?: string;
  org?: string;
  city?: string;
  country?: string;
  sequence?: number;
  linkedPid?: string;
}

export interface NatureMtsFixtureOptions {
  slots: number;
  numAuthors?: number | string;
  corresponding?: {
    first?: string;
    middle?: string;
    last?: string;
    email?: string;
    sequence?: number;
  };
  authors?: FixtureAuthorSeed[];
  countries?: string[];
  includeSubmitControls?: boolean;
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

export function buildNatureMtsFixtureHtml(
  options: NatureMtsFixtureOptions,
): string {
  const countries = options.countries ?? DEFAULT_COUNTRIES;
  const parts: string[] = [];
  parts.push('<form id="author_form">');
  parts.push(
    `<label for="num_authors">Number of Authors</label><input id="num_authors" name="num_authors" type="text" value="${options.numAuthors ?? options.slots}" />`,
  );

  const corr = options.corresponding ?? {};
  parts.push(`
    <fieldset id="corresponding_author">
      <legend>Corresponding Author</legend>
      <input id="corr_auth_first_nm" name="corr_auth_first_nm" type="text" value="${corr.first ?? ''}" />
      <input id="corr_auth_middle_nm" name="corr_auth_middle_nm" type="text" value="${corr.middle ?? ''}" />
      <input id="corr_auth_last_nm" name="corr_auth_last_nm" type="text" value="${corr.last ?? ''}" />
      <input id="corr_auth_email" name="corr_auth_email" type="text" value="${corr.email ?? ''}" />
      <input id="corr_auth_author_seq" name="corr_auth_author_seq" type="text" value="${corr.sequence ?? ''}" />
    </fieldset>
  `);

  for (let i = 1; i <= options.slots; i += 1) {
    const seed = options.authors?.[i - 1] ?? {};
    const countryOptions = countries
      .map((c) => {
        const selected = seed.country && seed.country === c ? ' selected' : '';
        return `<option value="${c}"${selected}>${c || 'Select country'}</option>`;
      })
      .join('');

    parts.push(`
      <fieldset class="contrib_auth" data-index="${i}">
        <legend>Contributing Author ${i}</legend>
        <input id="contrib_auth_${i}_first_nm" name="contrib_auth_${i}_first_nm" type="text" value="${seed.first ?? ''}" />
        <input id="contrib_auth_${i}_middle_nm" name="contrib_auth_${i}_middle_nm" type="text" value="${seed.middle ?? ''}" />
        <input id="contrib_auth_${i}_last_nm" name="contrib_auth_${i}_last_nm" type="text" value="${seed.last ?? ''}" />
        <input id="contrib_auth_${i}_email" name="contrib_auth_${i}_email" type="text" value="${seed.email ?? ''}" />
        <input id="contrib_auth_${i}_org" name="contrib_auth_${i}_org" type="text" value="${seed.org ?? ''}" />
        <input id="contrib_auth_${i}_city" name="contrib_auth_${i}_city" type="text" value="${seed.city ?? ''}" />
        <select id="contrib_auth_${i}_country" name="contrib_auth_${i}_country">${countryOptions}</select>
        <input id="contrib_auth_${i}_author_seq" name="contrib_auth_${i}_author_seq" type="text" value="${seed.sequence ?? ''}" />
        <input id="current_contrib_auth_${i}_author_pid" name="current_contrib_auth_${i}_author_pid" type="hidden" value="${seed.linkedPid ?? ''}" />
      </fieldset>
    `);
  }

  if (options.includeSubmitControls !== false) {
    parts.push(`
      <button type="button" id="save_authors">Save Authors</button>
      <button type="submit" id="final_submit">Final Submit Manuscript</button>
      <input type="checkbox" id="certify_accuracy" name="certify_accuracy" />
      <label for="certify_accuracy">I certify this submission</label>
      <button type="button" id="accept_copyright">Accept Copyright</button>
      <button type="button" id="pay_apc">Make Payment</button>
    `);
  }

  parts.push('</form>');
  return parts.join('\n');
}

export function mountNatureMtsFixture(
  options: NatureMtsFixtureOptions,
): Document {
  document.body.innerHTML = buildNatureMtsFixtureHtml(options);
  return document;
}
