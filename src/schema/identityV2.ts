import { z } from 'zod';
import { RosterSourceSchema } from '@/schema/author';
import { ProvenanceAssertionSchema } from '@/schema/provenance';

export const IDENTITY_SCHEMA_VERSION = 2;

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
]);

export const EmailTypeSchema = z.enum(['work', 'personal', 'other']);

export const EmailRecordSchema = z.object({
  address: z.string().email(),
  type: EmailTypeSchema.default('work'),
  verificationStatus: z
    .enum(['unverified', 'self_attested', 'externally_verified'])
    .default('unverified'),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const AffiliationV2Schema = z.object({
  institution: z.string().min(1),
  department: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  isPrimary: z.boolean().default(false),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const ExternalIdentifierSchema = z.object({
  scheme: z.string().min(1),
  value: z.string().min(1),
  url: z.string().url().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const FundingRecordSchema = z.object({
  funder: z.string().min(1),
  grantId: z.string().optional(),
  title: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const DisclosureSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  effectiveDate: z.string().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const WorkReferenceSchema = z.object({
  title: z.string().min(1),
  doi: z.string().optional(),
  year: z.number().int().optional(),
  role: z.string().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const TeamMembershipSchema = z.object({
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  role: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const IdentityAuthorSchema = z.object({
  id: z.string().min(1),
  givenName: z.string().min(1),
  middleName: z.string().optional(),
  familyName: z.string().min(1),
  email: z
    .union([z.string().email(), z.literal('')])
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  orcid: z.string().optional(),
  isCorresponding: z.boolean().default(false),
  affiliations: z.array(AffiliationV2Schema).default([]),
  sequence: z.number().int().positive(),
  preferredPublicationName: z.string().optional(),
  alternateNames: z.array(z.string()).optional(),
  emails: z.array(EmailRecordSchema).optional(),
  externalIdentifiers: z.array(ExternalIdentifierSchema).optional(),
  funding: z.array(FundingRecordSchema).optional(),
  disclosures: z.array(DisclosureSchema).optional(),
  creditRoles: z.array(CreditRoleSchema).optional(),
  works: z.array(WorkReferenceSchema).optional(),
  teamMemberships: z.array(TeamMembershipSchema).optional(),
});

export const IdentityDocumentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  authors: z.array(IdentityAuthorSchema),
  schemaVersion: z.literal(IDENTITY_SCHEMA_VERSION).default(IDENTITY_SCHEMA_VERSION),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  source: RosterSourceSchema,
});

export type CreditRole = z.infer<typeof CreditRoleSchema>;
export type EmailRecord = z.infer<typeof EmailRecordSchema>;
export type AffiliationV2 = z.infer<typeof AffiliationV2Schema>;
export type ExternalIdentifier = z.infer<typeof ExternalIdentifierSchema>;
export type FundingRecord = z.infer<typeof FundingRecordSchema>;
export type Disclosure = z.infer<typeof DisclosureSchema>;
export type WorkReference = z.infer<typeof WorkReferenceSchema>;
export type TeamMembership = z.infer<typeof TeamMembershipSchema>;
export type IdentityAuthor = z.infer<typeof IdentityAuthorSchema>;
export type IdentityDocument = z.infer<typeof IdentityDocumentSchema>;
