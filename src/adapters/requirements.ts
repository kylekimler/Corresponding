import { primaryAffiliation, sortAuthors, type Author, type Roster } from '@/schema/author';
import type { PlatformId } from './types';

export interface RequirementIssue {
  code: string;
  /** Short field name, as the portal labels it. */
  field: string;
  /** One sentence explaining why the portal needs it. */
  explanation: string;
  /** Author positions missing the value, for a precise message. */
  authorSequences: number[];
  /** True when the portal refuses to save without it. */
  blocksFill: boolean;
}

interface RequirementRule {
  code: string;
  field: string;
  explanation: string;
  blocksFill: boolean;
  isSatisfied(author: Author): boolean;
}

function hasText(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

/**
 * Declared per portal from captured forms only. A rule exists here when the
 * portal marks the field required, so Corresponding can say what is missing
 * before touching the page.
 */
const RULES: Partial<Record<PlatformId, RequirementRule[]>> = {
  'editorial-manager': [
    {
      code: 'credit_roles_required',
      field: 'Contributor Roles',
      explanation:
        'Editorial Manager will not save an author without at least one CRediT role.',
      blocksFill: true,
      isSatisfied: (author) => author.creditRoles.length > 0,
    },
    {
      code: 'department_required',
      field: 'Department',
      explanation: 'Editorial Manager marks Department required on the author form.',
      blocksFill: true,
      isSatisfied: (author) => hasText(primaryAffiliation(author)?.department),
    },
    {
      code: 'postal_code_required',
      field: 'Zip or Postal Code',
      explanation:
        'Editorial Manager marks Zip or Postal Code required on the author form.',
      blocksFill: true,
      isSatisfied: (author) => hasText(primaryAffiliation(author)?.postalCode),
    },
    {
      code: 'country_required',
      field: 'Country or Region',
      explanation:
        'Editorial Manager marks Country or Region required on the author form.',
      blocksFill: true,
      isSatisfied: (author) => hasText(primaryAffiliation(author)?.country),
    },
    {
      code: 'email_required',
      field: 'E-mail Address',
      explanation: 'Editorial Manager marks E-mail Address required on the author form.',
      blocksFill: true,
      isSatisfied: (author) => hasText(author.email),
    },
    {
      code: 'institution_required',
      field: 'Institution',
      explanation: 'Editorial Manager marks Institution required on the author form.',
      blocksFill: true,
      isSatisfied: (author) => hasText(primaryAffiliation(author)?.institution),
    },
  ],
  biorxiv: [
    {
      code: 'email_required',
      field: 'Email',
      explanation: 'bioRxiv will not save an author without an email address.',
      blocksFill: true,
      isSatisfied: (author) => hasText(author.email),
    },
    {
      code: 'institution_required',
      field: 'Institution',
      explanation: 'bioRxiv will not save an author without an institution.',
      blocksFill: true,
      isSatisfied: (author) => hasText(primaryAffiliation(author)?.institution),
    },
  ],
};

/** Unmet portal requirements for this roster, worst first. */
export function evaluatePortalRequirements(
  platformId: PlatformId,
  roster: Roster,
): RequirementIssue[] {
  const rules = RULES[platformId];
  if (!rules) return [];
  const authors = sortAuthors(roster.authors);
  const issues: RequirementIssue[] = [];
  for (const rule of rules) {
    const missing = authors
      .filter((author) => !rule.isSatisfied(author))
      .map((author) => author.sequence);
    if (missing.length === 0) continue;
    issues.push({
      code: rule.code,
      field: rule.field,
      explanation: rule.explanation,
      authorSequences: missing,
      blocksFill: rule.blocksFill,
    });
  }
  return issues.sort(
    (left, right) => Number(right.blocksFill) - Number(left.blocksFill),
  );
}

/** A short, specific sentence for the popup. */
export function describeRequirementIssue(
  issue: RequirementIssue,
  totalAuthors: number,
): string {
  const count = issue.authorSequences.length;
  const scope =
    count === totalAuthors
      ? `all ${totalAuthors} authors`
      : count <= 3
        ? `author${count === 1 ? '' : 's'} ${issue.authorSequences.join(', ')}`
        : `${count} authors`;
  return `${issue.field} is missing for ${scope}. ${issue.explanation}`;
}
