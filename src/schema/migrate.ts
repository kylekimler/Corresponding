import { z } from 'zod';
import {
  AuthorSchema,
  ROSTER_SCHEMA_VERSION,
  RosterSchema,
  type Affiliation,
  type Author,
  type Roster,
} from '@/schema/author';
import {
  IDENTITY_SCHEMA_VERSION,
  IdentityDocumentSchema,
  type AffiliationV2,
  type IdentityAuthor,
  type IdentityDocument,
} from '@/schema/identityV2';
import { defaultProvenance } from '@/schema/provenance';

export const CompatibleIdentityDocumentSchema = z.union([
  IdentityDocumentSchema,
  RosterSchema,
]);

export type CompatibleIdentityDocument = z.infer<
  typeof CompatibleIdentityDocumentSchema
>;

export function isIdentityDocument(
  doc: CompatibleIdentityDocument,
): doc is IdentityDocument {
  return doc.schemaVersion === IDENTITY_SCHEMA_VERSION;
}

export function isV1Roster(doc: CompatibleIdentityDocument): doc is Roster {
  return doc.schemaVersion === ROSTER_SCHEMA_VERSION;
}

export function migrateV1RosterToIdentity(roster: Roster): IdentityDocument {
  return fromSimpleRoster(roster);
}

export function fromSimpleRoster(roster: Roster): IdentityDocument {
  return IdentityDocumentSchema.parse({
    id: roster.id,
    name: roster.name,
    authors: roster.authors.map(authorToIdentityAuthor),
    schemaVersion: IDENTITY_SCHEMA_VERSION,
    createdAt: roster.createdAt,
    updatedAt: roster.updatedAt,
    source: roster.source,
  });
}

function authorToIdentityAuthor(author: Author): IdentityAuthor {
  const emails = author.email
    ? [
        {
          address: author.email,
          type: 'work' as const,
          verificationStatus: 'unverified' as const,
        },
      ]
    : undefined;

  const externalIdentifiers = author.orcid
    ? [{ scheme: 'orcid', value: author.orcid }]
    : undefined;

  return {
    ...author,
    affiliations: author.affiliations.map(affiliationToV2),
    emails,
    externalIdentifiers,
  };
}

function affiliationToV2(aff: Affiliation): AffiliationV2 {
  return { ...aff };
}

function identityAuthorToAuthor(author: IdentityAuthor): Author {
  const email =
    author.email ??
    author.emails?.find((e) => e.type === 'work')?.address ??
    author.emails?.[0]?.address;

  const orcid =
    author.orcid ??
    author.externalIdentifiers?.find((id) => id.scheme === 'orcid')?.value;

  const affiliations: Affiliation[] = author.affiliations.map(
    ({ institution, department, city, state, country, isPrimary }) => ({
      institution,
      department,
      city,
      state,
      country,
      isPrimary,
    }),
  );

  return AuthorSchema.parse({
    id: author.id,
    givenName: author.givenName,
    middleName: author.middleName,
    familyName: author.familyName,
    email,
    orcid,
    isCorresponding: author.isCorresponding,
    affiliations,
    sequence: author.sequence,
  });
}

export function toSimpleRoster(
  doc: IdentityDocument | CompatibleIdentityDocument,
): Roster {
  const identity = isV1Roster(doc) ? migrateV1RosterToIdentity(doc) : doc;
  return RosterSchema.parse({
    id: identity.id,
    name: identity.name,
    authors: identity.authors.map(identityAuthorToAuthor),
    schemaVersion: ROSTER_SCHEMA_VERSION,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
    source: identity.source,
  });
}

export function parseCompatibleIdentity(raw: unknown): CompatibleIdentityDocument {
  const obj =
    typeof raw === 'object' && raw !== null
      ? raw
      : { schemaVersion: ROSTER_SCHEMA_VERSION };

  const version =
    'schemaVersion' in obj && typeof (obj as { schemaVersion: unknown }).schemaVersion === 'number'
      ? (obj as { schemaVersion: number }).schemaVersion
      : ROSTER_SCHEMA_VERSION;

  if (version === IDENTITY_SCHEMA_VERSION) {
    return IdentityDocumentSchema.parse(obj);
  }
  return RosterSchema.parse(obj);
}

export function exportIdentityV2Json(doc: IdentityDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function importIdentityV2Json(json: string): IdentityDocument {
  const raw: unknown = JSON.parse(json);
  return IdentityDocumentSchema.parse(raw);
}

/** Attach default provenance to externally sourced fields when importing. */
export function withImportedProvenance<T extends { provenance?: unknown }>(
  record: T,
  source: Parameters<typeof defaultProvenance>[0],
): T & { provenance: ReturnType<typeof defaultProvenance> } {
  return {
    ...record,
    provenance: record.provenance ?? defaultProvenance(source),
  };
}
