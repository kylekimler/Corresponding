import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { natureMtsAdapter } from '@/adapters/nature-mts/adapter';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { parseCsv, toCsv } from '@/import/csv';
import { suggestColumnMapping } from '@/import/columnMap';
import { rowsToRoster } from '@/import/rosterFromTable';
import { createMemoryRosterStore } from '@/roster/storage';
import { reorderAuthors } from '@/roster/mutations';
import { rosterArb } from '../helpers/arbitraryRoster';
import { makeNAuthors, makeRoster } from '../helpers/roster';

describe('property-based roster invariants', () => {
  it('author order never changes unless reorder requested', () => {
    fc.assert(
      fc.property(rosterArb(5), (roster) => {
        const before = roster.authors.map((a) => a.id);
        mountNatureMtsFixture({ slots: 5 });
        natureMtsAdapter.fill(document, roster, {
          overwrite: true,
          dryRun: false,
        });
        const after = roster.authors.map((a) => a.id);
        expect(after).toEqual(before);
      }),
      { numRuns: 50 },
    );
  });

  it('dry run never mutates the DOM', () => {
    fc.assert(
      fc.property(rosterArb(3), (roster) => {
        mountNatureMtsFixture({ slots: 3 });
        const before = document.body.innerHTML;
        natureMtsAdapter.fill(document, roster, {
          overwrite: true,
          dryRun: true,
        });
        expect(document.body.innerHTML).toBe(before);
      }),
      { numRuns: 40 },
    );
  });

  it('fill never clicks buttons', () => {
    const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');
    try {
      fc.assert(
        fc.property(rosterArb(2), (roster) => {
          mountNatureMtsFixture({ slots: 2, includeSubmitControls: true });
          clickSpy.mockClear();
          natureMtsAdapter.fill(document, roster, {
            overwrite: true,
            dryRun: false,
          });
          expect(clickSpy).not.toHaveBeenCalled();
        }),
        { numRuns: 30 },
      );
    } finally {
      clickSpy.mockRestore();
    }
  });

  it('does not write author data into the wrong block', () => {
    fc.assert(
      fc.property(rosterArb(4), (roster) => {
        mountNatureMtsFixture({ slots: 4 });
        natureMtsAdapter.fill(document, roster, {
          overwrite: true,
          dryRun: false,
        });
        for (let i = 0; i < 4; i += 1) {
          const author = roster.authors[i]!;
          const first = (
            document.getElementById(
              `contrib_auth_${i + 1}_first_nm`,
            ) as HTMLInputElement
          ).value;
          const last = (
            document.getElementById(
              `contrib_auth_${i + 1}_last_nm`,
            ) as HTMLInputElement
          ).value;
          expect(first).toBe(author.givenName);
          expect(last).toBe(author.familyName);
        }
      }),
      { numRuns: 40 },
    );
  });

  it('linked conflicting accounts are never overwritten', () => {
    fc.assert(
      fc.property(rosterArb(1), (roster) => {
        mountNatureMtsFixture({
          slots: 1,
          authors: [
            {
              first: 'Portal',
              last: 'Linked',
              email: 'portal-unique@example.org',
              linkedPid: 'PID-1',
            },
          ],
        });
        natureMtsAdapter.fill(document, roster, {
          overwrite: true,
          dryRun: false,
        });
        expect(
          (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement)
            .value,
        ).toBe('Portal');
      }),
      { numRuns: 25 },
    );
  });

  it('validation identifies missing emails', () => {
    const roster = makeRoster([
      {
        ...makeNAuthors(1)[0]!,
        email: undefined,
      },
    ]);
    mountNatureMtsFixture({ slots: 1 });
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: false });
    const v = natureMtsAdapter.validate(document, roster);
    expect(v.summary.missingEmail).toBe(1);
  });

  it('import/export round-trip preserves canonical metadata', async () => {
    await fc.assert(
      fc.asyncProperty(rosterArb(3), async (roster) => {
        // Ensure at least one corresponding for stable export semantics
        if (!roster.authors.some((a) => a.isCorresponding)) {
          roster.authors[0]!.isCorresponding = true;
        }
        const store = createMemoryRosterStore();
        await store.save(roster);
        const csv = await store.exportCsv(roster.id);
        const parsed = parseCsv(csv);
        const mapping = suggestColumnMapping(parsed.headers);
        const imported = rowsToRoster({
          name: 'rt',
          headers: parsed.headers,
          rows: parsed.rows,
          mapping: mapping.map,
          source: 'csv',
        });
        expect(imported.authors).toHaveLength(roster.authors.length);
        for (let i = 0; i < roster.authors.length; i += 1) {
          expect(imported.authors[i]?.givenName).toBe(
            roster.authors[i]?.givenName.trim(),
          );
          expect(imported.authors[i]?.familyName).toBe(
            roster.authors[i]?.familyName.trim(),
          );
          expect(imported.authors[i]?.email || undefined).toBe(
            roster.authors[i]?.email || undefined,
          );
        }
        // toCsv stability
        const again = parseCsv(toCsv(parsed.headers, parsed.rows));
        expect(again.rows).toEqual(parsed.rows);
      }),
      { numRuns: 30 },
    );
  });

  it('explicit reorder is the only order mutation path', () => {
    const roster = makeRoster(makeNAuthors(3));
    const ids = roster.authors.map((a) => a.id);
    const reordered = reorderAuthors(roster, 0, 2);
    expect(reordered.authors.map((a) => a.id)).toEqual([ids[1], ids[2], ids[0]]);
    expect(roster.authors.map((a) => a.id)).toEqual(ids);
  });
});

// Large roster stress — fewer property runs, fixed sizes
describe('large roster stress', () => {
  it.each([1, 2, 10, 75, 200])(
    'fills %i authors on matching Nature MTS slots',
    (n) => {
      mountNatureMtsFixture({ slots: n });
      const roster = makeRoster(makeNAuthors(n));
      const report = natureMtsAdapter.fill(document, roster, {
        overwrite: true,
        dryRun: false,
      });
      expect(report.errors).toHaveLength(0);
      expect(
        (document.getElementById(`contrib_auth_${n}_last_nm`) as HTMLInputElement)
          .value,
      ).toBe(`Family${n}`);
    },
  );

  it.each([500, 1000])(
    'dry-runs %i authors without DOM mutation (slot-capped fixture)',
    (n) => {
      // Full 1000-slot DOM is heavy; use 50 slots and ensure dry-run safety + warnings
      mountNatureMtsFixture({ slots: 50 });
      const roster = makeRoster(makeNAuthors(n));
      const before = document.body.innerHTML;
      const report = natureMtsAdapter.fill(document, roster, {
        overwrite: true,
        dryRun: true,
      });
      expect(document.body.innerHTML).toBe(before);
      expect(report.warnings.some((w) => /slots/i.test(w))).toBe(true);
    },
  );
});
