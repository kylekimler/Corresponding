import { z } from 'zod';

/**
 * The 14 CRediT contributor roles in the order portals list them, plus `other`
 * for imported values that are clearly roles but outside the taxonomy.
 */
export const CreditRoleSchema = z.enum([
  'conceptualization',
  'data_curation',
  'formal_analysis',
  'funding_acquisition',
  'investigation',
  'methodology',
  'project_administration',
  'resources',
  'software',
  'supervision',
  'validation',
  'visualization',
  'writing_original_draft',
  'writing_review_editing',
  'other',
]);

export type CreditRole = z.infer<typeof CreditRoleSchema>;

export const CREDIT_ROLE_LABELS: Record<CreditRole, string> = {
  conceptualization: 'Conceptualization',
  data_curation: 'Data curation',
  formal_analysis: 'Formal analysis',
  funding_acquisition: 'Funding acquisition',
  investigation: 'Investigation',
  methodology: 'Methodology',
  project_administration: 'Project administration',
  resources: 'Resources',
  software: 'Software',
  supervision: 'Supervision',
  validation: 'Validation',
  visualization: 'Visualization',
  writing_original_draft: 'Writing – original draft',
  writing_review_editing: 'Writing – review & editing',
  other: 'Other',
};

/** The 14 taxonomy roles, excluding the `other` catch-all. */
export const CREDIT_ROLES: CreditRole[] = (
  Object.keys(CREDIT_ROLE_LABELS) as CreditRole[]
).filter((role) => role !== 'other');

export function creditRoleLabel(role: CreditRole): string {
  return CREDIT_ROLE_LABELS[role];
}

/** Fold en/em dashes, ampersands, and punctuation for comparison. */
function normalizeRoleText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ROLE_LOOKUP = new Map<string, CreditRole>();
for (const [role, label] of Object.entries(CREDIT_ROLE_LABELS)) {
  ROLE_LOOKUP.set(normalizeRoleText(label), role as CreditRole);
  ROLE_LOOKUP.set(normalizeRoleText(role), role as CreditRole);
}
/** Shorthands seen in real author tables. */
const ROLE_ALIASES: Record<string, CreditRole> = {
  'writing original': 'writing_original_draft',
  'original draft': 'writing_original_draft',
  'writing review': 'writing_review_editing',
  'review and editing': 'writing_review_editing',
  'review editing': 'writing_review_editing',
  funding: 'funding_acquisition',
  admin: 'project_administration',
};
for (const [alias, role] of Object.entries(ROLE_ALIASES)) {
  ROLE_LOOKUP.set(normalizeRoleText(alias), role);
}

/**
 * Parse a spreadsheet cell listing contributor roles. Unrecognized text is
 * dropped rather than guessed, so a roster never claims an undeclared role.
 */
export function parseCreditRoles(raw: string | undefined | null): CreditRole[] {
  if (!raw) return [];
  const found: CreditRole[] = [];
  for (const part of raw.split(/[;,/|\n\r]+/)) {
    const key = normalizeRoleText(part);
    if (!key) continue;
    const role = ROLE_LOOKUP.get(key);
    if (role && !found.includes(role)) found.push(role);
  }
  return found;
}
