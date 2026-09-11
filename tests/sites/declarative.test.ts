import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultRegistry } from '@/adapters/registry';
import { makeAuthor, makeNAuthors, makeRoster } from '../helpers/roster';
import { createSiteAdapter } from '@/sites/engine';
import { loadSiteDefinitions } from '@/sites/load';
import { parseSiteDefinition } from '@/sites/schema';

function readRepo(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const EXAMPLE = parseSiteDefinition(
  JSON.parse(readRepo('sites/_example-society.json')),
);

describe('declarative sites', () => {
  it('loads every public sites/*.json and skips underscore drafts', () => {
    const files = readdirSync(resolve(process.cwd(), 'sites')).filter((name) =>
      name.endsWith('.json'),
    );
    const publicFiles = files.filter((name) => !name.startsWith('_'));
    const loaded = loadSiteDefinitions();
    expect(loaded.map((site) => site.id).sort()).toEqual(
      publicFiles
        .map((name) => JSON.parse(readRepo(`sites/${name}`)).id)
        .sort(),
    );
    expect(loaded.some((site) => site.id === 'example-society')).toBe(false);
    expect(defaultRegistry.get('nature-mts')?.label).toMatch(/Nature/);
    expect(defaultRegistry.get('scholarone')?.id).toBe('scholarone');
    expect(defaultRegistry.get('editorial-manager')?.id).toBe(
      'editorial-manager',
    );
  });

  it('fills a society journal from the ~10-line example', () => {
    document.body.innerHTML = `
      <input id="author_1_first" />
      <input id="author_1_last" />
      <input id="author_1_email" />
      <input id="author_2_first" />
      <input id="author_2_last" />
      <input id="author_2_email" />
    `;
    const adapter = createSiteAdapter(EXAMPLE);
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        email: 'ada@example.org',
        sequence: 1,
      }),
      makeAuthor({
        givenName: 'Alan',
        familyName: 'Turing',
        email: 'alan@example.org',
        sequence: 2,
      }),
    ]);
    const detect = adapter.detect(document);
    expect(detect.platformId).toBe('example-society');
    expect(detect.confidence).toBeGreaterThanOrEqual(0.5);

    const preview = adapter.fill(document, roster, {
      overwrite: true,
      dryRun: true,
    });
    expect(
      (document.getElementById('author_1_first') as HTMLInputElement).value,
    ).toBe('');

    adapter.fill(document, roster, { overwrite: true, dryRun: false });
    expect(
      (document.getElementById('author_1_first') as HTMLInputElement).value,
    ).toBe('Ada');
    expect(
      (document.getElementById('author_2_last') as HTMLInputElement).value,
    ).toBe('Turing');
    expect(preview.errors).toEqual([]);
  });

  it('keeps ScholarOne and Editorial Manager site JSON detect-only', () => {
    const scholarone = loadSiteDefinitions().find((s) => s.id === 'scholarone');
    const em = loadSiteDefinitions().find((s) => s.id === 'editorial-manager');
    expect(scholarone?.autofill).toBe(false);
    expect(scholarone?.authors).toBeUndefined();
    expect(em?.autofill).toBe(false);
    expect(em?.authors).toBeUndefined();
    expect(JSON.stringify(scholarone?.authors ?? null)).toBe('null');
    expect(JSON.stringify(em?.authors ?? null)).toBe('null');

    // Capture-backed TypeScript adapters win in the registry. Site JSON
    // must not grow guessed field IDs.
    const scholaroneFill = defaultRegistry.require('scholarone').fill(
      document,
      makeRoster(makeNAuthors(1)),
      { overwrite: false, dryRun: true },
    );
    expect(scholaroneFill.errors.join(' ')).not.toMatch(/adapter is a stub/i);
    expect(defaultRegistry.require('scholarone').label).toMatch(/ScholarOne/);
    expect(defaultRegistry.require('editorial-manager').label).toBe(
      'Editorial Manager',
    );
  });

  it('rejects CSS selectors and click actions in site files', () => {
    expect(() =>
      parseSiteDefinition({
        id: 'evil',
        label: 'Evil',
        autofill: true,
        detect: { ids: ['#foo .bar'] },
        authors: {
          slot: 'div>input',
          fields: { givenName: 'div>input' },
        },
      }),
    ).toThrow(/element IDs/i);
  });

  it('links the README to the guide containing the declarative example', () => {
    expect(readRepo('README.md')).toContain('(docs/ADDING_AN_ADAPTER.md)');
    expect(readRepo('docs/ADDING_AN_ADAPTER.md')).toContain('"id": "example-society"');
    const example = readRepo('sites/_example-society.json').trim().split('\n');
    expect(example.length).toBeLessThanOrEqual(16);
  });
});
