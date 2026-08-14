import { describe, expect, it } from 'vitest';
import { AuthorSchema, RosterSchema } from '@/schema/author';
import { fromSimpleRoster, toSimpleRoster } from '@/schema/migrate';
import { makeAuthor, makeRoster } from '../helpers/roster';

describe('conflict of interest field', () => {
  it('accepts an optional per-author COI statement', () => {
    const author = AuthorSchema.parse(
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        sequence: 1,
        conflictOfInterest: 'Advisor to Analytical Engines Ltd',
      }),
    );
    expect(author.conflictOfInterest).toBe('Advisor to Analytical Engines Ltd');
  });

  it('omits empty COI rather than storing a blank string', () => {
    const parsed = AuthorSchema.safeParse({
      ...makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        sequence: 1,
      }),
      conflictOfInterest: '',
    });
    expect(parsed.success).toBe(false);
  });

  it('round-trips author COI through identity v2 as a disclosure', () => {
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        sequence: 1,
        isCorresponding: true,
        conflictOfInterest: 'No competing interests',
      }),
    ]);
    const identity = fromSimpleRoster(roster);
    expect(identity.people[0]?.disclosures).toEqual([
      {
        kind: 'conflict_of_interest',
        statement: 'No competing interests',
      },
    ]);
    const back = toSimpleRoster(identity);
    expect(back.authors[0]?.conflictOfInterest).toBe('No competing interests');
    expect(RosterSchema.parse(back).authors[0]?.conflictOfInterest).toBe(
      'No competing interests',
    );
  });
});
