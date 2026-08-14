import { describe, expect, it } from 'vitest';
import { readyAuthorCount } from '@/popup/authorAttention';
import {
  createSampleRoster,
  importSampleRosterOnce,
  sampleFillConfirmation,
} from '@/roster/sample';
import { createMemoryRosterStore } from '@/roster/storage';
import { RosterSchema } from '@/schema/author';

describe('sample roster', () => {
  it('is canonical, complete example-only data', () => {
    const now = '2026-08-12T00:00:00.000Z';
    const roster = createSampleRoster(now);

    expect(RosterSchema.parse(roster)).toEqual(roster);
    expect(roster.name).toBe('Sample research team');
    expect(roster.source).toBe('sample');
    expect(roster.createdAt).toBe(now);
    expect(roster.authors).toHaveLength(6);
    expect(roster.authors.map((author) => author.sequence)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(roster.authors.every((author) => author.email?.endsWith('@example.org'))).toBe(
      true,
    );
    expect(readyAuthorCount(roster.authors)).toBe(6);
  });

  it('models shared first authors and shared corresponding authors', () => {
    const roster = createSampleRoster();
    const shared = roster.authors.filter((author) => author.equalContribution);
    const corresponding = roster.authors.filter(
      (author) => author.isCorresponding,
    );

    // Two co-first authors lead the list.
    expect(shared.map((author) => author.sequence)).toEqual([1, 2]);
    // Two shared corresponding authors close it.
    expect(corresponding.map((author) => author.sequence)).toEqual([5, 6]);
    expect(roster.authors[3]?.conflictOfInterest).toBe(
      'Consultant to an optics workshop',
    );
    expect(roster.projectMetadata?.disclosureStatements).toEqual([
      'No competing interests',
      'Consultant to an optics workshop',
    ]);
    expect(
      roster.authors.map((author) => author.familyName),
    ).toEqual([
      'Lovelace',
      'Turing',
      'Wu',
      'du Châtelet',
      'Franklin',
      'Hopper',
    ]);
  });

  it('saves as a normal local roster and creates fresh ids each time', async () => {
    const store = createMemoryRosterStore();
    const first = createSampleRoster();
    const second = createSampleRoster();

    expect(first.id).not.toBe(second.id);
    expect(first.authors.map((author) => author.id)).not.toEqual(
      second.authors.map((author) => author.id),
    );

    await store.importRoster(first);
    const saved = await store.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.id).toBe(first.id);
    expect(saved[0]?.authors).toHaveLength(6);
  });

  it('replaces a stale example roster instead of stacking duplicates', async () => {
    const store = createMemoryRosterStore();
    // An older example roster already saved in this browser.
    const stale = { ...createSampleRoster(), authors: [] };
    await store.importRoster(stale);
    // An imported roster of the user's own must survive.
    const imported = { ...createSampleRoster(), source: 'csv' as const };
    await store.importRoster(imported);

    const fresh = await importSampleRosterOnce(store, { current: false });

    const saved = await store.list();
    expect(saved.filter((roster) => roster.source === 'sample')).toHaveLength(1);
    expect(saved.some((roster) => roster.id === stale.id)).toBe(false);
    expect(saved.some((roster) => roster.id === imported.id)).toBe(true);
    expect(fresh?.authors).toHaveLength(6);
  });

  it('atomically ignores a reentrant sample-import click', async () => {
    const store = createMemoryRosterStore();
    const lock = { current: false };

    const [first, duplicate] = await Promise.all([
      importSampleRosterOnce(store, lock),
      importSampleRosterOnce(store, lock),
    ]);

    expect(first).toBeDefined();
    expect(duplicate).toBeUndefined();
    expect(await store.list()).toHaveLength(1);
  });

  it('asks before filling example authors into a real portal', () => {
    // Confirmed rather than blocked, so end-to-end testing stays possible.
    expect(sampleFillConfirmation('sample', false)).toMatch(
      /example authors, not real people/i,
    );
    // The local test fixture needs no warning.
    expect(sampleFillConfirmation('sample', true)).toBeUndefined();
    // Imported rosters are never questioned.
    expect(sampleFillConfirmation('csv', false)).toBeUndefined();
  });
});
