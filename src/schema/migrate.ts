import { z } from 'zod';
import {
  ROSTER_SCHEMA_VERSION,
  RosterSchema,
  type Roster,
} from '@/schema/author';
import {
  IDENTITY_SCHEMA_VERSION,
  IdentityDocumentSchema,
  fromSimpleRoster,
  toSimpleRoster,
  type IdentityDocument,
} from '@/schema/identityV2';

export {
  fromSimpleRoster,
  toSimpleRoster,
} from '@/schema/identityV2';

export const CompatibleIdentityDocumentSchema = z.union([
  IdentityDocumentSchema,
  RosterSchema,
]);

export type CompatibleIdentityDocument = z.infer<
  typeof CompatibleIdentityDocumentSchema
>;

export type MigratedLocalData =
  | { kind: 'roster'; roster: Roster }
  | { kind: 'identity'; identity: IdentityDocument };

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

/**
 * Load unknown local JSON into a usable roster/identity.
 * v1 rosters keep working; v2 identity docs convert to simple rosters for adapters.
 */
export function migrateLocalDocument(raw: unknown): MigratedLocalData {
  const parsed = parseCompatibleIdentity(raw);
  if (isIdentityDocument(parsed)) {
    return { kind: 'identity', identity: parsed };
  }
  return { kind: 'roster', roster: parsed };
}

export function ensureRoster(raw: unknown): Roster {
  const migrated = migrateLocalDocument(raw);
  if (migrated.kind === 'roster') return migrated.roster;
  return toSimpleRoster(migrated.identity);
}

export function upgradeRosterToIdentity(roster: Roster): IdentityDocument {
  return fromSimpleRoster(roster);
}
