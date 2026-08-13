import { describe, expect, it } from 'vitest';
import { natureMtsAdapter } from '@/adapters/nature-mts/adapter';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { mappingIsComplete, suggestColumnMapping } from '@/import/columnMap';
import { parsePastedTable } from '@/import/pasteTable';
import { rowsToRoster } from '@/import/rosterFromTable';
import { createSampleRoster } from '@/roster/sample';
import { createMemoryRosterStore } from '@/roster/storage';
import { summarizePreview } from '@/popup/previewSummary';
import { makeNAuthors, makeRoster } from '../helpers/roster';

function tsvForAuthors(n: number): string {
  const header =
    'First name\tLast name\tEmail\tAffiliation 1\tCity\tCountry\tCorresponding\tORCID';
  const rows = Array.from({ length: n }, (_, i) => {
    const k = i + 1;
    const corr = i === 0 ? 'yes' : '';
    return `Given${k}\tFamily${k}\tauthor${k}@example.org\tInst${k}\tCity${k}\tJapan\t${corr}\t0000-0002-1825-0097`;
  });
  return [header, ...rows].join('\n');
}

async function importFromPaste(n: number) {
  const store = createMemoryRosterStore();
  expect(await store.list()).toHaveLength(0);

  const parsed = parsePastedTable(tsvForAuthors(n));
  const mapping = suggestColumnMapping(parsed.headers);
  expect(mapping.requiresConfirmation).toBe(false);
  expect(mappingIsComplete(mapping.map)).toBe(true);

  const roster = rowsToRoster({
    name: `Journey ${n}`,
    headers: parsed.headers,
    rows: parsed.rows,
    mapping: mapping.map,
    source: 'csv',
  });
  await store.importRoster(roster);
  const list = await store.list();
  expect(list).toHaveLength(1);
  expect(list[0]?.authors).toHaveLength(n);
  return { store, roster: list[0]! };
}

describe('first-use journey', () => {
  it('install/open with no roster', async () => {
    const store = createMemoryRosterStore();
    expect(await store.list()).toEqual([]);
  });

  it('one-click sample → preview → fill → validate', async () => {
    const store = createMemoryRosterStore();
    const sample = createSampleRoster('2026-08-12T00:00:00.000Z');
    await store.importRoster(sample);
    const roster = (await store.list())[0]!;

    mountNatureMtsFixture({ slots: roster.authors.length });
    const detect = natureMtsAdapter.detect(document);
    expect(detect.platformId).toBe('nature-mts');

    const firstName = () =>
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement)
        .value;
    const preview = natureMtsAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: true,
    });
    expect(preview.dryRun).toBe(true);
    expect(firstName()).toBe('');

    const fill = natureMtsAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: false,
    });
    expect(fill.filled).toBeGreaterThan(0);
    expect(firstName()).toBe('Ada');

    const validation = natureMtsAdapter.validate(document, roster);
    expect(validation.summary.conflicts).toBe(0);
    expect(validation.summary.filledLike).toBe(roster.authors.length);
  });

  it.each([3, 75, 500])(
    'paste → map → import → detect → preview (no mutate) → fill → validate (%i authors)',
    async (n) => {
      const { roster } = await importFromPaste(n);

      const slots = Math.min(n, 75);
      mountNatureMtsFixture({ slots });

      const detect = natureMtsAdapter.detect(document);
      expect(detect.platformId).toBe('nature-mts');
      expect(detect.confidence).toBeGreaterThanOrEqual(0.5);

      const readFirst = () =>
        (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement)
          .value;
      expect(readFirst()).toBe('');

      const preview = natureMtsAdapter.fill(document, roster, {
        overwrite: false,
        dryRun: true,
      });
      expect(readFirst()).toBe('');
      expect(preview.dryRun).toBe(true);

      const summary = summarizePreview(preview, detect);
      expect(summary.totalMappings).toBeGreaterThan(0);
      expect(summary.exactMappings).toBeGreaterThan(0);
      expect(summary.headline).toMatch(/Preview ready/i);

      const fill = natureMtsAdapter.fill(document, roster, {
        overwrite: true,
        dryRun: false,
      });
      expect(fill.dryRun).toBe(false);
      expect(readFirst()).toBe('Given1');
      expect(
        (document.getElementById('num_authors') as HTMLInputElement).value,
      ).toBe(String(n));

      const validation = natureMtsAdapter.validate(document, roster);
      expect(validation.summary.conflicts).toBe(0);
      expect(validation.summary.filledLike).toBe(slots);
    },
  );

  it('fill mutates while a separate preview roster path stays dry', () => {
    mountNatureMtsFixture({ slots: 2 });
    const roster = makeRoster(makeNAuthors(2));
    const first = () =>
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement)
        .value;
    expect(first()).toBe('');
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: true });
    expect(first()).toBe('');
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: false });
    expect(
      (document.getElementById('contrib_auth_2_last_nm') as HTMLInputElement)
        .value,
    ).toBe('Family2');
  });
});
