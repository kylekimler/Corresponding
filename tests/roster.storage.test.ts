import { describe, expect, it } from 'vitest';
import { createMemoryRosterStore } from '@/roster/storage';
import { makeNAuthors, makeRoster } from './helpers/roster';

describe('roster storage', () => {
  it('creates, renames, duplicates, deletes', async () => {
    const store = createMemoryRosterStore();
    const roster = makeRoster(makeNAuthors(2), 'Alpha');
    await store.save(roster);
    expect((await store.list()).map((r) => r.name)).toEqual(['Alpha']);

    await store.rename(roster.id, 'Beta');
    expect((await store.get(roster.id))?.name).toBe('Beta');

    const dup = await store.duplicate(roster.id);
    expect(dup.id).not.toBe(roster.id);
    expect(dup.authors[0]?.id).not.toBe(roster.authors[0]?.id);
    expect(dup.source).toBe('duplicate');

    await store.remove(roster.id);
    expect(await store.get(roster.id)).toBeUndefined();
    expect(await store.get(dup.id)).toBeDefined();
  });

  it('exports JSON and CSV', async () => {
    const store = createMemoryRosterStore();
    const roster = makeRoster(makeNAuthors(1), 'ExportMe');
    await store.save(roster);
    const json = await store.exportJson(roster.id);
    expect(JSON.parse(json).name).toBe('ExportMe');
    const csv = await store.exportCsv(roster.id);
    expect(csv).toContain('givenName');
    expect(csv).toContain('Given1');
  });

  it('reorders authors via save', async () => {
    const store = createMemoryRosterStore();
    const roster = makeRoster(makeNAuthors(3), 'Order');
    const swapped = {
      ...roster,
      authors: [
        { ...roster.authors[2]!, sequence: 1 },
        { ...roster.authors[0]!, sequence: 2 },
        { ...roster.authors[1]!, sequence: 3 },
      ],
    };
    await store.save(swapped);
    const loaded = await store.get(roster.id);
    expect(loaded?.authors.map((a) => a.givenName)).toEqual([
      'Given3',
      'Given1',
      'Given2',
    ]);
  });
});
