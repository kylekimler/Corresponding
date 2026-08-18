import { z } from 'zod';
import { CreditRoleSchema } from './credit';

export const AffiliationSchema = z.object({
  institution: z.string().min(1),
  department: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  /** Required by Editorial Manager's author form. */
  postalCode: z.string().optional(),
  country: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const AuthorSchema = z.object({
  id: z.string().min(1),
  givenName: z.string().min(1),
  middleName: z.string().optional(),
  familyName: z.string().min(1),
  /**
   * Honorific / salutation (Dr., Prof., Mx, …). ScholarOne Bioinformatics
   * marks Prefix required on Create New Author.
   */
  namePrefix: z.string().optional(),
  email: z
    .union([z.string().email(), z.literal('')])
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  orcid: z.string().optional(),
  isCorresponding: z.boolean().default(false),
  /**
   * Shared/co-first or otherwise equally contributing author. Canonical data
   * only: no portal field is filled from it without fixture evidence.
   */
  equalContribution: z.boolean().default(false),
  /**
   * CRediT contributor roles this author declared. Some portals, including
   * Editorial Manager, refuse to save an author without at least one.
   */
  creditRoles: z.array(CreditRoleSchema).default([]),
  affiliations: z.array(AffiliationSchema).default([]),
  sequence: z.number().int().positive(),
});

export const RosterSourceSchema = z.enum([
  'manual',
  'sample',
  'csv',
  'docx',
  'google_sheets',
  'json',
  'duplicate',
]);

export const ROSTER_SCHEMA_VERSION = 1;

export const ProjectMetadataSchema = z.object({
  fundingStatements: z.array(z.string().min(1)).default([]),
  disclosureStatements: z.array(z.string().min(1)).default([]),
});

export const RosterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  authors: z.array(AuthorSchema),
  schemaVersion: z.number().int().positive().default(ROSTER_SCHEMA_VERSION),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  source: RosterSourceSchema,
  /** Project-level submission metadata, distinct from individual identities. */
  projectMetadata: ProjectMetadataSchema.optional(),
});

export type Affiliation = z.infer<typeof AffiliationSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type Roster = z.infer<typeof RosterSchema>;
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
export type RosterSource = z.infer<typeof RosterSourceSchema>;

export function primaryAffiliation(author: Author): Affiliation | undefined {
  if (author.affiliations.length === 0) return undefined;
  return (
    author.affiliations.find((a) => a.isPrimary) ?? author.affiliations[0]
  );
}

export function sortAuthors(authors: Author[]): Author[] {
  return [...authors].sort((a, b) => a.sequence - b.sequence);
}
