import { describe, expect, it } from 'vitest';
import {
  createEmptyRoster,
  reorderAuthors,
  renameRoster,
  setCorrespondingAuthor,
  updateAuthor,
} from '@/roster/mutations';
import { makeNAuthors, makeRoster } from './helpers/roster';

describe('roster mutations', () => {
  it('renames a roster', () => {
    const roster = makeRoster(makeNAuthors(1), 'Old');
    expect(renameRoster(roster, 'New').name).toBe('New');
  });

  it('reorders authors and renumbers sequence', () => {
    const roster = makeRoster(makeNAuthors(3));
    const next = reorderAuthors(roster, 0, 2);
    expect(next.authors.map((a) => a.givenName)).toEqual([
      'Given2',
      'Given3',
      'Given1',
    ]);
    expect(next.authors.map((a) => a.sequence)).toEqual([1, 2, 3]);
  });

  it('updates author fields and corresponding flag', () => {
    const roster = makeRoster(makeNAuthors(2));
    const id = roster.authors[1]!.id;
    const patched = updateAuthor(roster, id, { email: 'new@example.org' });
    expect(patched.authors[1]?.email).toBe('new@example.org');
    const corr = setCorrespondingAuthor(patched, id);
    expect(corr.authors[0]?.isCorresponding).toBe(false);
    expect(corr.authors[1]?.isCorresponding).toBe(true);
  });

  it('creates an empty manual roster', () => {
    const r = createEmptyRoster('Blank');
    expect(r.authors).toHaveLength(0);
    expect(r.source).toBe('manual');
  });
});
