export type CanonicalColumn =
  | 'givenName'
  | 'middleName'
  | 'familyName'
  | 'email'
  | 'orcid'
  | 'institution'
  | 'department'
  | 'city'
  | 'state'
  | 'country'
  | 'isCorresponding'
  | 'equalContribution'
  | 'sequence'
  | 'fundingStatement'
  | 'disclosureStatement'
  | 'ignore';

export interface ColumnSuggestion {
  header: string;
  columnIndex: number;
  suggested: CanonicalColumn | null;
  aliasesMatched: string[];
  ambiguous: boolean;
  candidates: CanonicalColumn[];
}

export interface ColumnMapping {
  /** header index → canonical column (ignore allowed) */
  map: Record<number, CanonicalColumn>;
  suggestions: ColumnSuggestion[];
  requiresConfirmation: boolean;
}

const ALIASES: Record<Exclude<CanonicalColumn, 'ignore'>, string[]> = {
  givenName: [
    'first name',
    'firstname',
    'first_name',
    'given name',
    'given_name',
    'givenname',
    'first',
  ],
  middleName: [
    'middle name',
    'middlename',
    'middle_name',
    'middle',
  ],
  familyName: [
    'last name',
    'lastname',
    'last_name',
    'family name',
    'family_name',
    'familyname',
    'surname',
    'last',
  ],
  email: ['email', 'e-mail', 'email_address', 'email address', 'e_mail'],
  orcid: ['orcid', 'orcid id', 'orcid_id', 'orcid iD'.toLowerCase()],
  institution: [
    'institution',
    'affiliation',
    'affiliation 1',
    'organization',
    'organisation',
    'org',
  ],
  department: ['department', 'dept', 'division'],
  city: ['city', 'town'],
  state: ['state', 'province', 'region'],
  country: ['country', 'nation'],
  isCorresponding: [
    'corresponding',
    'corresponding author',
    'is_corresponding',
    'is corresponding',
    'corr',
  ],
  equalContribution: [
    'equal contribution',
    'equal contributor',
    'co-first author',
    'co first author',
    'shared first author',
    'joint first author',
  ],
  sequence: ['sequence', 'order', 'author order', 'author_seq', 'seq', '#'],
  fundingStatement: [
    'support/funding statement',
    'support funding statement',
    'funding statement',
    'funding',
    'support statement',
  ],
  disclosureStatement: [
    'conflicts of interest',
    'conflict of interest',
    'competing interests',
    'competing interest statement',
    'disclosure statement',
    'disclosures',
  ],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replaceAll('/', ' ').replace(/\s+/g, ' ');
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const used = new Set<CanonicalColumn>();
  const suggestions: ColumnSuggestion[] = [];
  const map: Record<number, CanonicalColumn> = {};
  let requiresConfirmation = false;

  headers.forEach((header, columnIndex) => {
    const norm = normalizeHeader(header);
    const candidates: CanonicalColumn[] = [];
    const aliasesMatched: string[] = [];

    (Object.keys(ALIASES) as Array<Exclude<CanonicalColumn, 'ignore'>>).forEach(
      (col) => {
        for (const alias of ALIASES[col]) {
          if (norm === alias) {
            candidates.push(col);
            aliasesMatched.push(alias);
            break;
          }
        }
      },
    );

    // Secondary: unique contains match when exact failed
    if (candidates.length === 0 && norm) {
      (Object.keys(ALIASES) as Array<Exclude<CanonicalColumn, 'ignore'>>).forEach(
        (col) => {
          if (
            col === 'institution' &&
            /\b(numbers?|ids?)\b/.test(norm)
          ) {
            return;
          }
          if (ALIASES[col].some((a) => norm.includes(a) || a.includes(norm))) {
            candidates.push(col);
          }
        },
      );
    }

    const unique = [...new Set(candidates)];
    let suggested: CanonicalColumn | null = null;
    let ambiguous = false;

    if (unique.length === 1) {
      const only = unique[0]!;
      if (used.has(only)) {
        ambiguous = true;
        requiresConfirmation = true;
      } else {
        suggested = only;
        used.add(only);
      }
    } else if (unique.length > 1) {
      ambiguous = true;
      requiresConfirmation = true;
    } else if (norm) {
      // Unknown header — user must map or ignore
      requiresConfirmation = true;
    }

    // Every visible select has a safe value. Unknown, ambiguous, duplicate,
    // and blank columns default to Ignore instead of making people classify
    // unrelated spreadsheet administration columns one by one.
    map[columnIndex] = suggested ?? 'ignore';

    suggestions.push({
      header,
      columnIndex,
      suggested,
      aliasesMatched,
      ambiguous,
      candidates: unique,
    });
  });

  // Required fields must be mapped
  const mappedValues = new Set(Object.values(map));
  if (!mappedValues.has('givenName') || !mappedValues.has('familyName')) {
    requiresConfirmation = true;
  }

  return { map, suggestions, requiresConfirmation };
}

export function mappingIsComplete(
  mapping: Record<number, CanonicalColumn>,
): boolean {
  const values = new Set(Object.values(mapping));
  return values.has('givenName') && values.has('familyName');
}
