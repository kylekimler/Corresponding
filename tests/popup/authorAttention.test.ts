import { describe, expect, it } from 'vitest';
import {
  authorsNeedingAttention,
  readyAuthorCount,
} from '@/popup/authorAttention';
import { makeAuthor } from '../helpers/roster';

describe('attention-first author UX helpers', () => {
  it('lists only authors needing action with reasons', () => {
    const authors = [
      makeAuthor({
        givenName: 'Ready',
        familyName: 'Person',
        email: 'r@example.org',
        orcid: '0000-0001-2345-6789',
        sequence: 1,
        affiliations: [{ institution: 'Lab', isPrimary: true }],
      }),
      makeAuthor({
        givenName: 'Mary',
        familyName: 'Futey',
        sequence: 2,
        affiliations: [{ institution: 'Lab', isPrimary: true }],
      }),
      makeAuthor({
        givenName: 'Anna',
        familyName: 'Hupalowska',
        email: 'a@example.org',
        orcid: '0000-0001-2345-6789',
        sequence: 3,
        affiliations: [],
      }),
      makeAuthor({
        givenName: 'Sara',
        familyName: 'Kimler',
        email: 's@example.org',
        sequence: 4,
        affiliations: [{ institution: 'Lab', isPrimary: true }],
      }),
    ];

    expect(readyAuthorCount(authors)).toBe(2);
    const attention = authorsNeedingAttention(authors);
    expect(attention).toHaveLength(2);
    expect(attention.map((a) => a.author.familyName)).toEqual([
      'Futey',
      'Hupalowska',
    ]);
    expect(attention[0]?.reasons).toContain('Missing email');
    expect(attention[1]?.reasons).toContain('Missing institution');
  });
});
