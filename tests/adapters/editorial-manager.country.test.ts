import { afterEach, describe, expect, it } from 'vitest';
import { matchSelectOption } from '@/adapters/dom';
import { matchEditorialManagerCountry } from '@/adapters/editorial-manager/country';
import { editorialManagerAdapter } from '@/adapters/editorial-manager/adapter';
import { mountEditorialManagerFixture } from '@/adapters/editorial-manager/fixture';
import { makeAuthor, makeRoster } from '../helpers/roster';

// Labels observed in PLOS Genetics on 2026-09-11. Values are deliberately
// synthetic: the resolver must use the live option, not assume portal codes.
function countrySelect(doc: Document) {
  const select = doc.getElementById('CountryCode') as HTMLSelectElement;
  select.innerHTML = '<option value="">Please select from the list below</option>' +
    '<option value="test-america">UNITED STATES OF AMERICA</option>' +
    '<option value="test-islands">UNITED STATES MINOR OUTLYING ISLANDS</option>' +
    '<option value="test-canada">CANADA</option>';
  return select;
}

function roster(country = 'United States') {
  return makeRoster([makeAuthor({
    sequence: 1,
    givenName: 'Maya', familyName: 'Chen', email: 'maya@example.org',
    creditRoles: ['conceptualization'],
    affiliations: [{ institution: 'Example Institute', department: 'Biology',
      city: 'Cambridge', postalCode: '02142', country, isPrimary: true }],
  })]);
}

afterEach(() => { document.body.innerHTML = ''; });

describe('Editorial Manager country matching', () => {
  it.each(['United States', 'US', 'usa', ' united states of america '])(
    'resolves %s without selecting the outlying islands', (alias) => {
      const select = countrySelect(mountEditorialManagerFixture());
      expect(matchEditorialManagerCountry(select, alias)).toBe('test-america');
      expect(select.value).toBe('');
    },
  );

  it('leaves the general ambiguous-match safeguard unchanged', () => {
    const select = countrySelect(mountEditorialManagerFixture());
    expect(matchSelectOption(select, 'United States')).toBeNull();
    expect(matchEditorialManagerCountry(select, 'UNITED STATES MINOR OUTLYING ISLANDS')).toBe('test-islands');
    expect(matchEditorialManagerCountry(select, 'Canada')).toBe('test-canada');
  });

  it('rejects missing, disabled, and duplicate US candidates', () => {
    const select = countrySelect(mountEditorialManagerFixture());
    select.options[1]!.disabled = true;
    expect(matchEditorialManagerCountry(select, 'US')).toBeNull();
    select.options[1]!.remove();
    expect(matchEditorialManagerCountry(select, 'United States')).toBeNull();
    select.insertAdjacentHTML('beforeend', '<option value="a">USA</option><option value="b">United States</option>');
    expect(matchEditorialManagerCountry(select, 'US')).toBeNull();
  });

  it('previews without mutation and saves the exact country for each author in order', async () => {
    const form = mountEditorialManagerFixture();
    const select = countrySelect(form);
    const data = roster();
    data.authors.push({ ...data.authors[0]!, id: 'second-author', sequence: 2,
      givenName: 'Leo', familyName: 'Rivera', email: 'leo@example.org' });
    const saves: string[][] = [];
    form.getElementById('SaveButton')!.addEventListener('click', () => {
      saves.push([(form.getElementById('FirstName') as HTMLInputElement).value, select.value]);
    }, true);
    editorialManagerAdapter.fill(document, data, { dryRun: true, overwrite: false });
    expect(select.value).toBe('');
    expect(saves).toEqual([]);
    const report = await editorialManagerAdapter.fillAsync!(document, data, { dryRun: false, overwrite: false });
    expect(report.errors).toEqual([]);
    expect(saves).toEqual([['Maya', 'test-america'], ['Leo', 'test-america']]);
    expect(report.plans.filter((plan) => plan.fieldId === 'CountryCode').every((plan) =>
      plan.action === 'fill' || plan.action === 'overwrite')).toBe(true);
  });

  it('preserves an existing country unless overwrite was selected', () => {
    const form = mountEditorialManagerFixture();
    const select = countrySelect(form);
    select.value = 'test-canada';
    let saved = '';
    form.getElementById('SaveButton')!.addEventListener('click', () => { saved = select.value; }, true);
    const report = editorialManagerAdapter.fill(document, roster(), { dryRun: false, overwrite: false });
    expect(saved).toBe('test-canada');
    expect(report.plans.find((plan) => plan.fieldId === 'CountryCode')?.action).toBe('preserve');
  });

  it.each([true, false])('reports an unresolved country as unmapped (dry run: %s)', (dryRun) => {
    const form = mountEditorialManagerFixture();
    const select = countrySelect(form);
    select.options[1]!.remove();
    const report = editorialManagerAdapter.fill(document, roster(), { dryRun, overwrite: false });
    expect(report.plans.find((plan) => plan.fieldId === 'CountryCode')).toMatchObject({
      action: 'unmapped', reason: expect.stringContaining('Country could not be matched safely'),
    });
    expect(report.unmapped).toBeGreaterThan(0);
    expect(select.value).toBe('');
  });

  it('does not count a disabled dropdown as filled', () => {
    const form = mountEditorialManagerFixture();
    countrySelect(form).disabled = true;
    const report = editorialManagerAdapter.fill(document, roster(), { dryRun: false, overwrite: false });
    expect(report.plans.find((plan) => plan.fieldId === 'CountryCode')?.action).toBe('unmapped');
  });

  it('retains institution warnings even when dismissing the dialog immediately closes the author form', async () => {
    mountEditorialManagerFixture({ warnUnidentifiedInstitution: true });
    const report = await editorialManagerAdapter.fillAsync!(document, roster(), { dryRun: false, overwrite: false });
    expect(report.errors).toEqual([]);
    expect(report.warnings).toContain('Institution was entered as free text. Review the journal’s institution verification.');
  });

  it('does not report hidden contribution-role templates inside visible modal containers', async () => {
    const form = mountEditorialManagerFixture();
    const container = form.createElement('div');
    container.setAttribute('role', 'dialog');
    container.innerHTML = '<div hidden>Please select at least one Contributor Role.</div>' +
      '<div style="display:none">Please select at least one Contributor Role.</div>';
    form.body.appendChild(container);
    const report = await editorialManagerAdapter.fillAsync!(document, roster(), { dryRun: false, overwrite: false });
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((warning) => /Please select at least one Contributor Role/i.test(warning))).toBe(false);
  });
});
