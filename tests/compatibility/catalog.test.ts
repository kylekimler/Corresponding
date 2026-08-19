import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultRegistry } from '@/adapters/registry';
import { createEmptyRoster } from '@/roster/mutations';
import {
  COMPATIBILITY_CATALOG,
  COMPATIBILITY_CTA,
  COMPATIBILITY_ISSUE_URL,
  formatCompatibilityMarkdownTable,
  supportedCompatibilityCount,
} from '@/compatibility/catalog';

function readRepo(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('compatibility scoreboard', () => {
  it('lists working and planned platforms in the README', () => {
    const readme = readRepo('README.md');
    expect(readme).toContain('| Nature Portfolio | Working |');
    expect(readme).toContain('| ScholarOne / Manuscript Central | Working |');
    expect(readme).toContain('| Cell Press | In progress |');
    expect(readme).toContain('| Wiley | In progress |');
    expect(readme).toContain('| eLife | Planned |');
    expect(readme).toContain(COMPATIBILITY_CTA);
    expect(readme).toContain(COMPATIBILITY_ISSUE_URL);
  });

  it('marks ✅ only for adapters that can actually fill', () => {
    expect(supportedCompatibilityCount()).toBe(5);

    const empty = document.implementation.createHTMLDocument('empty');
    const roster = createEmptyRoster('Scoreboard');

    for (const row of COMPATIBILITY_CATALOG) {
      if (row.autofill !== 'supported') {
        expect(row.adapterId === undefined || row.adapterId !== 'unknown').toBe(
          true,
        );
        continue;
      }
      expect(row.adapterId).toBeDefined();
      const adapter = defaultRegistry.get(row.adapterId!);
      expect(adapter, `${row.platform} needs a registered adapter`).toBeDefined();
      const report = adapter!.fill(empty, roster, {
        overwrite: false,
        dryRun: true,
      });
      expect(report.errors.join(' ')).not.toMatch(/adapter is a stub/i);
    }
  });

  it('does not claim Elsevier, Wiley, or eLife are already filling', () => {
    const claimed = COMPATIBILITY_CATALOG.filter(
      (row) => row.autofill === 'supported',
    ).map((row) => row.platform);
    expect(claimed).toEqual([
      'Nature Portfolio',
      'bioRxiv / medRxiv',
      'Editorial Manager',
      'ScholarOne',
      'PLOS',
    ]);
    expect(formatCompatibilityMarkdownTable()).toContain('| Elsevier | ⬜ |');
    expect(formatCompatibilityMarkdownTable()).toContain('| Wiley | ⬜ |');
    expect(formatCompatibilityMarkdownTable()).toContain('| eLife | ⬜ |');
  });
});
