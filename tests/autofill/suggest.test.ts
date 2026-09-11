import { describe, expect, it } from 'vitest';
import {
  authorPreview,
  fillAllLabel,
  rosterForOneAuthor,
  suggestAuthor,
} from '@/autofill/suggest';
import { makeAuthor, makeNAuthors, makeRoster } from '../helpers/roster';

describe('autofill suggestions', () => {
  it('picks the matching sequence or corresponding author', () => {
    const authors = makeNAuthors(3, { correspondingIndex: 2 });
    const roster = makeRoster(authors);
    expect(suggestAuthor(roster, { field: 'givenName', confidence: 1, source: 'exact_selector', sequence: 2 })?.sequence).toBe(2);
    expect(
      suggestAuthor(roster, {
        field: 'email',
        confidence: 1,
        source: 'exact_selector',
        corresponding: true,
      })?.givenName,
    ).toBe('Given3');
    expect(suggestAuthor(roster)?.sequence).toBe(1);
    expect(
      suggestAuthor(makeRoster(authors.slice(0, 1)), {
        field: 'givenName',
        confidence: 1,
        source: 'exact_selector',
        sequence: 2,
      }),
    ).toBeUndefined();
  });

  it('preserves roster order when isolating one author', () => {
    const roster = makeRoster(makeNAuthors(3));
    const second = roster.authors[1]!;
    const one = rosterForOneAuthor(roster, second);
    expect(one.authors).toHaveLength(1);
    expect(one.authors[0]?.sequence).toBe(2);
    expect(one.authors[0]?.givenName).toBe('Given2');
  });

  it('masks email and names the page chip from the roster count', () => {
    const author = makeAuthor({
      givenName: 'Kyle',
      familyName: 'Kimler',
      sequence: 1,
      email: 'kkimler@broadinstitute.org',
      affiliations: [{ institution: 'Broad Institute', isPrimary: true }],
    });
    expect(authorPreview(author)).toEqual({
      name: 'Kyle Kimler',
      institution: 'Broad Institute',
      email: 'kkimler@...',
    });
    expect(fillAllLabel(1)).toBe('Corresponding can fill 1 author');
    expect(fillAllLabel(18)).toBe('Corresponding can fill 18 authors');
  });
});
