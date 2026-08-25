import { describe, expect, it } from 'vitest';
import { makeNAuthors, makeRoster } from '../helpers/roster';
import {
  compileManuscriptRoster,
  createEmptyManuscript,
  parseManuscriptJson,
  parseManuscriptJsonSafe,
  serializeManuscript,
  touchManuscript,
} from '@/schema/manuscript';

describe('manuscript serialization', () => {
  it('round-trips a manuscript through JSON', () => {
    const manuscript = createEmptyManuscript('Gut atlas', '2026-08-25T12:00:00.000Z');
    manuscript.roster.authors = makeNAuthors(2);
    const json = serializeManuscript(manuscript);
    const parsed = parseManuscriptJson(JSON.parse(json));
    expect(parsed.title).toBe('Gut atlas');
    expect(parsed.roster.authors).toHaveLength(2);
    expect(compileManuscriptRoster(parsed).name).toBe('Gut atlas');
  });

  it('compiles an untitled manuscript to a named roster', () => {
    const manuscript = createEmptyManuscript('');
    const roster = compileManuscriptRoster(manuscript);
    expect(roster.name).toBe('Untitled manuscript');
    expect(roster.source).toBe('web');
    expect(roster.id).toBe(manuscript.id);
  });

  it('refuses malformed incoming manuscript documents', () => {
    expect(parseManuscriptJsonSafe(null).manuscript).toBeNull();
    expect(parseManuscriptJsonSafe({ title: 'Nope' }).manuscript).toBeNull();
    expect(
      parseManuscriptJsonSafe({
        id: 'x',
        title: 'Broken',
        schemaVersion: 1,
        createdAt: '2026-08-25T12:00:00.000Z',
        updatedAt: '2026-08-25T12:00:00.000Z',
        roster: { ...makeRoster(makeNAuthors(1)), authors: [{ givenName: '' }] },
      }).manuscript,
    ).toBeNull();
  });

  it('updates title and roster timestamps together', () => {
    const manuscript = createEmptyManuscript('Draft', '2026-08-25T12:00:00.000Z');
    const next = touchManuscript(
      manuscript,
      { title: 'Final', roster: makeRoster(makeNAuthors(1), 'Final') },
      '2026-08-25T13:00:00.000Z',
    );
    expect(next.title).toBe('Final');
    expect(next.updatedAt).toBe('2026-08-25T13:00:00.000Z');
    expect(next.roster.updatedAt).toBe('2026-08-25T13:00:00.000Z');
  });
});
