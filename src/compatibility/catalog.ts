import type { PlatformId } from '@/adapters/types';

/**
 * Public compatibility scoreboard.
 * A row may say supported only when a registered adapter can fill from a
 * fixture. Never mark a publisher ✅ from a logo or a guess.
 */
export type AutofillStatus = 'supported' | 'needs_fixture';

export interface CompatibilityRow {
  id: string;
  platform: string;
  autofill: AutofillStatus;
  /** Set when a registered adapter owns this row. */
  adapterId?: PlatformId;
}

export const COMPATIBILITY_CATALOG: readonly CompatibilityRow[] = [
  {
    id: 'nature-portfolio',
    platform: 'Nature Portfolio',
    autofill: 'supported',
    adapterId: 'nature-mts',
  },
  {
    id: 'biorxiv',
    platform: 'bioRxiv / medRxiv',
    autofill: 'supported',
    adapterId: 'biorxiv',
  },
  {
    id: 'editorial-manager',
    platform: 'Editorial Manager',
    autofill: 'supported',
    adapterId: 'editorial-manager',
  },
  {
    id: 'scholarone',
    platform: 'ScholarOne',
    autofill: 'supported',
    adapterId: 'scholarone',
  },
  {
    id: 'elsevier',
    platform: 'Elsevier',
    autofill: 'needs_fixture',
  },
  {
    id: 'wiley',
    platform: 'Wiley',
    autofill: 'needs_fixture',
  },
  {
    id: 'frontiers',
    platform: 'Frontiers',
    autofill: 'needs_fixture',
  },
  {
    id: 'plos',
    platform: 'PLOS',
    autofill: 'supported',
    adapterId: 'editorial-manager',
  },
  {
    id: 'elife',
    platform: 'eLife',
    autofill: 'needs_fixture',
  },
] as const;

export const COMPATIBILITY_ISSUE_URL =
  'https://github.com/kylekimler/Corresponding/issues/new?template=add-journal.yml';

export const COMPATIBILITY_CTA =
  'Found a journal that does not work?';

export function autofillMark(status: AutofillStatus): '✅' | '⬜' {
  return status === 'supported' ? '✅' : '⬜';
}

export function supportedCompatibilityCount(
  rows: readonly CompatibilityRow[] = COMPATIBILITY_CATALOG,
): number {
  return rows.filter((row) => row.autofill === 'supported').length;
}

export function formatCompatibilityMarkdownTable(
  rows: readonly CompatibilityRow[] = COMPATIBILITY_CATALOG,
): string {
  const lines = [
    '| Platform | Autofill |',
    '| --- | --- |',
    ...rows.map((row) => `| ${row.platform} | ${autofillMark(row.autofill)} |`),
  ];
  return lines.join('\n');
}
