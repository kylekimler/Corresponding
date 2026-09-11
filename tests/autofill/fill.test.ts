import { afterEach, describe, expect, it } from 'vitest';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { runContextualFill } from '@/autofill/fill';
import { rosterForOneAuthor } from '@/autofill/suggest';
import { makeAuthor, makeNAuthors, makeRoster } from '../helpers/roster';

afterEach(() => {
  document.body.innerHTML = '';
});

function kyleRoster() {
  return makeRoster([
    makeAuthor({
      givenName: 'Kyle',
      familyName: 'Kimler',
      sequence: 1,
      isCorresponding: true,
      email: 'kkimler@broadinstitute.org',
      affiliations: [
        { institution: 'Broad Institute', city: 'Cambridge', country: 'United States', isPrimary: true },
      ],
    }),
    makeAuthor({
      givenName: 'Ada',
      familyName: 'Lovelace',
      sequence: 2,
      email: 'ada@example.org',
      affiliations: [
        { institution: 'Analytical Engine', city: 'London', country: 'United Kingdom', isPrimary: true },
      ],
    }),
  ]);
}

describe('runContextualFill', () => {
  it('fills one author into the matching Nature slot and leaves others empty', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const roster = kyleRoster();
    const result = await runContextualFill(document, roster, {
      mode: 'one',
      author: roster.authors[1],
    });
    expect(result.ok).toBe(true);
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (document.getElementById('contrib_auth_2_first_nm') as HTMLInputElement).value,
    ).toBe('Ada');
    expect(
      (document.getElementById('contrib_auth_2_org') as HTMLInputElement).value,
    ).toBe('Analytical Engine');
  });

  it('fills the whole roster in sequence without touching submit controls', async () => {
    mountNatureMtsFixture({ slots: 2 });
    const clicks: string[] = [];
    document.getElementById('final_submit')?.addEventListener('click', () => {
      clicks.push('final_submit');
    });
    document.getElementById('author_form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      clicks.push('submit');
    });
    const roster = kyleRoster();
    const result = await runContextualFill(document, roster, { mode: 'all' });
    expect(result.ok).toBe(true);
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
    ).toBe('Kyle');
    expect(
      (document.getElementById('contrib_auth_2_first_nm') as HTMLInputElement).value,
    ).toBe('Ada');
    expect(
      (document.getElementById('contrib_auth_1_author_seq') as HTMLInputElement).value,
    ).toBe('1');
    expect(
      (document.getElementById('contrib_auth_2_author_seq') as HTMLInputElement).value,
    ).toBe('2');
    expect(clicks).toEqual([]);
    expect(rosterForOneAuthor(roster, roster.authors[0]!).authors[0]?.sequence).toBe(1);
  });

  it('refuses unsupported or low-confidence pages', async () => {
    document.body.innerHTML = '<form><input id="title" /></form>';
    const result = await runContextualFill(document, makeRoster(makeNAuthors(1)), {
      mode: 'all',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected fill to be refused');
    expect(result.reason).toMatch(/not a confidently recognized author form/i);
    expect((document.getElementById('title') as HTMLInputElement).value).toBe('');
  });
});
