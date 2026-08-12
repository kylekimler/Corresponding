import { describe, expect, it } from 'vitest';
import { createSampleRoster } from '@/roster/sample';
import { createMemoryRosterStore } from '@/roster/storage';
import { RosterSchema } from '@/schema/author';

describe('sample roster', () => {
  it('is canonical, complete example-only data', () => {
    const now = '2026-08-12T00:00:00.000Z';
    const roster = createSampleRoster(now);

    expect(RosterSchema.parse(roster)).toEqual(roster);
    expect(roster.name).toBe('Sample research team');
    expect(roster.createdAt).toBe(now);
    expect(roster.authors).toHaveLength(3);
    expect(roster.authors.map((author) => author.sequence)).toEqual([1, 2, 3]);
    expect(roster.authors.filter((author) => author.isCorresponding)).toHaveLength(1);
    expect(roster.authors.every((author) => author.email?.endsWith('@example.org'))).toBe(
      true,
    );
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
    expect(saved[0]?.authors).toHaveLength(3);
  });
});
