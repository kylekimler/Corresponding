import { z } from 'zod';
import {
  AffiliationSchema,
  AuthorSchema,
  ProjectMetadataSchema,
  ROSTER_SCHEMA_VERSION,
  RosterSchema,
  type Author,
  type Roster,
} from './author';
import { CreditRoleSchema } from './credit';
import { ProvenanceAssertionSchema } from './provenance';

export const IDENTITY_SCHEMA_VERSION = 2;

export { CreditRoleSchema } from './credit';

export const TypedEmailSchema = z.object({
  value: z.string().email(),
  type: z.enum(['work', 'personal', 'corresponding', 'other']).default('work'),
  verificationStatus: z
    .enum(['unverified', 'self_attested', 'externally_verified'])
    .default('unverified'),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const DatedAffiliationSchema = AffiliationSchema.extend({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const ExternalIdentifierSchema = z.object({
  system: z.enum(['orcid', 'ror', 'isni', 'researcherid', 'scopus', 'other']),
  value: z.string().min(1),
  url: z.string().url().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const FundingRecordSchema = z.object({
  funderName: z.string().min(1),
  grantId: z.string().optional(),
  awardTitle: z.string().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const DisclosureSchema = z.object({
  kind: z.enum(['conflict_of_interest', 'competing_interest', 'other']),
  statement: z.string().min(1),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const WorkReferenceSchema = z.object({
  title: z.string().min(1),
  doi: z.string().optional(),
  url: z.string().url().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const TeamMembershipSchema = z.object({
  teamName: z.string().min(1),
  role: z.string().optional(),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const IdentityPersonSchema = AuthorSchema.extend({
  preferredPublicationName: z.string().optional(),
  alternateNames: z.array(z.string()).default([]),
  emails: z.array(TypedEmailSchema).default([]),
  datedAffiliations: z.array(DatedAffiliationSchema).default([]),
  identifiers: z.array(ExternalIdentifierSchema).default([]),
  funding: z.array(FundingRecordSchema).default([]),
  disclosures: z.array(DisclosureSchema).default([]),
  creditRoles: z.array(CreditRoleSchema).default([]),
  works: z.array(WorkReferenceSchema).default([]),
  teamMemberships: z.array(TeamMembershipSchema).default([]),
  provenance: ProvenanceAssertionSchema.optional(),
});

export const IdentityDocumentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  schemaVersion: z.literal(IDENTITY_SCHEMA_VERSION),
  people: z.array(IdentityPersonSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  provenance: ProvenanceAssertionSchema.optional(),
  projectMetadata: ProjectMetadataSchema.optional(),
});

export type IdentityDocument = z.infer<typeof IdentityDocumentSchema>;
export type IdentityPerson = z.infer<typeof IdentityPersonSchema>;

export function fromSimpleRoster(roster: Roster): IdentityDocument {
  const people = roster.authors.map((a) =>
    IdentityPersonSchema.parse({
      ...a,
      alternateNames: [],
      emails: a.email
        ? [
            {
              value: a.email,
              type: a.isCorresponding ? 'corresponding' : 'work',
              verificationStatus: 'unverified',
            },
          ]
        : [],
      datedAffiliations: a.affiliations.map((aff) => ({ ...aff })),
      identifiers: a.orcid
        ? [{ system: 'orcid', value: a.orcid }]
        : [],
      funding: [],
      disclosures: [],
      creditRoles: [],
      works: [],
      teamMemberships: [],
    }),
  );
  return IdentityDocumentSchema.parse({
    id: roster.id,
    name: roster.name,
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    people,
    createdAt: roster.createdAt,
    updatedAt: roster.updatedAt,
    projectMetadata: roster.projectMetadata,
  });
}

export function toSimpleRoster(doc: IdentityDocument): Roster {
  const authors: Author[] = doc.people.map((p, i) => {
    const email = p.emails[0]?.value ?? p.email;
    const affiliations =
      p.datedAffiliations.length > 0
        ? p.datedAffiliations.map(({ startDate: _s, endDate: _e, provenance: _p, ...aff }) => aff)
        : p.affiliations;
    const orcid =
      p.identifiers.find((id) => id.system === 'orcid')?.value ?? p.orcid;
    return AuthorSchema.parse({
      id: p.id,
      givenName: p.givenName,
      middleName: p.middleName,
      familyName: p.familyName,
      email,
      orcid,
      isCorresponding: p.isCorresponding,
      affiliations,
      sequence: p.sequence || i + 1,
    });
  });
  return RosterSchema.parse({
    id: doc.id,
    name: doc.name,
    authors,
    schemaVersion: ROSTER_SCHEMA_VERSION,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    source: 'json',
    projectMetadata: doc.projectMetadata,
  });
}
