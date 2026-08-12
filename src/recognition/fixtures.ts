/** Synthetic HTML builders for repeated-author layout variants. */

export type LayoutKind =
  | 'numbered_ids'
  | 'fieldset_cards'
  | 'table_rows'
  | 'accordion'
  | 'aria_named';

export function buildRepeatedAuthorHtml(
  kind: LayoutKind,
  authorCount: number,
): string {
  switch (kind) {
    case 'numbered_ids':
      return Array.from({ length: authorCount }, (_, i) => {
        const n = i + 1;
        return `
          <div data-author="${n}">
            <label for="author_${n}_first">First Name</label>
            <input id="author_${n}_first" name="author_${n}_first" />
            <label for="author_${n}_middle">Middle Name</label>
            <input id="author_${n}_middle" name="author_${n}_middle" />
            <label for="author_${n}_last">Last Name</label>
            <input id="author_${n}_last" name="author_${n}_last" />
            <label for="author_${n}_email">Email</label>
            <input id="author_${n}_email" name="author_${n}_email" type="email" />
            <label for="author_${n}_org">Institution</label>
            <input id="author_${n}_org" name="author_${n}_org" />
            <label for="author_${n}_city">City</label>
            <input id="author_${n}_city" name="author_${n}_city" />
            <label for="author_${n}_country">Country</label>
            <select id="author_${n}_country" name="author_${n}_country">
              <option></option><option>United States</option><option>Germany</option>
              <option>Japan</option><option>France</option><option>Canada</option>
              <option>United Kingdom</option>
            </select>
          </div>`;
      }).join('\n');
    case 'fieldset_cards':
      return Array.from({ length: authorCount }, (_, i) => {
        const n = i + 1;
        return `
          <fieldset class="card author-card">
            <legend>Author ${n}</legend>
            <label for="fn_${n}">Given Name</label>
            <input id="fn_${n}" name="authors[${n}][given]" />
            <label for="ln_${n}">Family Name</label>
            <input id="ln_${n}" name="authors[${n}][family]" />
            <label for="em_${n}">Email Address</label>
            <input id="em_${n}" name="authors[${n}][email]" />
            <label for="or_${n}">ORCID</label>
            <input id="or_${n}" name="authors[${n}][orcid]" />
          </fieldset>`;
      }).join('\n');
    case 'table_rows':
      return `
        <table>
          <thead><tr><th>First</th><th>Last</th><th>Email</th><th>Institution</th></tr></thead>
          <tbody>
            ${Array.from({ length: authorCount }, (_, i) => {
              const n = i + 1;
              return `<tr>
                <td><input name="row_${n}_first" aria-label="First Name" /></td>
                <td><input name="row_${n}_last" aria-label="Last Name" /></td>
                <td><input name="row_${n}_email" aria-label="Email" /></td>
                <td><input name="row_${n}_inst" aria-label="Institution" /></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    case 'accordion':
      return Array.from({ length: authorCount }, (_, i) => {
        const n = i + 1;
        return `
          <details open>
            <summary>Contributor ${n}</summary>
            <div>
              <input id="acc_${n}_first" name="contrib_${n}_first_name" aria-label="First Name" />
              <input id="acc_${n}_last" name="contrib_${n}_last_name" aria-label="Last Name" />
              <input id="acc_${n}_email" name="contrib_${n}_email" aria-label="Email" />
              <input id="acc_${n}_dept" name="contrib_${n}_department" aria-label="Department" />
            </div>
          </details>`;
      }).join('\n');
    case 'aria_named':
      return Array.from({ length: authorCount }, (_, i) => {
        const n = i + 1;
        return `
          <section>
            <input name="person${n}Given" aria-label="Given Name" />
            <input name="person${n}Family" aria-label="Family Name" />
            <input name="person${n}Mail" aria-label="Email Address" />
            <input name="person${n}Affil" aria-label="Affiliation" />
          </section>`;
      }).join('\n');
  }
}
