import {
  ROSTER_SCHEMA_VERSION,
  type Author,
  type Affiliation,
  type Roster,
  type RosterSource,
} from '@/schema/author';
import { parseCreditRoles } from '@/schema/credit';
import { normalizeOrcid } from '@/schema/orcid';
import type { CanonicalColumn } from './columnMap';

function truthy(v: string): boolean {
  const t = v.trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'corresponding', 'corr'].includes(t);
}

function cell(
  row: string[],
  mapping: Record<number, CanonicalColumn>,
  key: CanonicalColumn,
): string {
  for (const [idx, col] of Object.entries(mapping)) {
    if (col === key) return (row[Number(idx)] ?? '').trim();
  }
  return '';
}

function uniqueColumnValues(
  rows: string[][],
  mapping: Record<number, CanonicalColumn>,
  key: CanonicalColumn,
): string[] {
  return [
    ...new Set(
      rows
        .map((row) => cell(row, mapping, key).trim())
        .filter((value) => value.length > 0),
    ),
  ];
}

export function rowsToRoster(input: {
  name: string;
  headers: string[];
  rows: string[][];
  mapping: Record<number, CanonicalColumn>;
  source: RosterSource;
  id?: string;
  now?: string;
}): Roster {
  const now = input.now ?? new Date().toISOString();
  const authors: Author[] = input.rows.map((row, i) => {
    const institution = cell(row, input.mapping, 'institution');
    const affiliations: Affiliation[] = [];
    if (institution) {
      affiliations.push({
        institution,
        department: cell(row, input.mapping, 'department') || undefined,
        city: cell(row, input.mapping, 'city') || undefined,
        state: cell(row, input.mapping, 'state') || undefined,
        postalCode: cell(row, input.mapping, 'postalCode') || undefined,
        country: cell(row, input.mapping, 'country') || undefined,
        isPrimary: true,
      });
    }

    const seqRaw = cell(row, input.mapping, 'sequence');
    const sequence = seqRaw ? Number.parseInt(seqRaw, 10) : i + 1;

    const email = cell(row, input.mapping, 'email');

    return {
      id: crypto.randomUUID(),
      givenName: cell(row, input.mapping, 'givenName').trim(),
      middleName: cell(row, input.mapping, 'middleName').trim() || undefined,
      familyName: cell(row, input.mapping, 'familyName').trim(),
      email: email || undefined,
      orcid: normalizeOrcid(cell(row, input.mapping, 'orcid')),
      isCorresponding: truthy(cell(row, input.mapping, 'isCorresponding')),
      equalContribution: truthy(cell(row, input.mapping, 'equalContribution')),
      creditRoles: parseCreditRoles(cell(row, input.mapping, 'creditRoles')),
      affiliations,
      sequence: Number.isFinite(sequence) && sequence > 0 ? sequence : i + 1,
    };
  });

  // Ensure at least one corresponding if any authors
  if (authors.length && !authors.some((a) => a.isCorresponding)) {
    authors[0]!.isCorresponding = true;
  }

  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    authors,
    schemaVersion: ROSTER_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    source: input.source,
    projectMetadata: {
      fundingStatements: uniqueColumnValues(
        input.rows,
        input.mapping,
        'fundingStatement',
      ),
      disclosureStatements: uniqueColumnValues(
        input.rows,
        input.mapping,
        'disclosureStatement',
      ),
    },
  };
}
