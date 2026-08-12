import { describe, expect, it } from 'vitest';
import { ROSTER_SCHEMA_VERSION } from '@/schema/author';
import { IDENTITY_SCHEMA_VERSION } from '@/schema/identityV2';
import {
  exportIdentityV2Json,
  fromSimpleRoster,
  importIdentityV2Json,
  isIdentityDocument,
  isV1Roster,
  migrateV1RosterToIdentity,
  parseCompatibleIdentity,
  toSimpleRoster,
} from '@/schema/migrate';
import { makeAuthor, makeRoster } from '../helpers/roster';

describe('identity migration', () => {
  const v1Roster = makeRoster(
    [
      makeAuthor({
        givenName: 'Jane',
        familyName: 'Doe',
        email: 'jane.doe@example.org',
        orcid: '0000-0001-2345-6789',
        sequence: 1,
        isCorresponding: true,
        affiliations: [
          { institution: 'Example University', city: 'Boston', isPrimary: true },
        ],
      }),
    ],
    'Lab roster',
  );

  it('migrates v1 roster to identity v2', () => {
    const identity = migrateV1RosterToIdentity(v1Roster);
    expect(identity.schemaVersion).toBe(IDENTITY_SCHEMA_VERSION);
    expect(identity.authors[0]?.emails?.[0]?.address).toBe('jane.doe@example.org');
    expect(identity.authors[0]?.externalIdentifiers?.[0]?.scheme).toBe('orcid');
  });

  it('round-trips through toSimpleRoster without losing v1 fields', () => {
    const identity = fromSimpleRoster(v1Roster);
    const back = toSimpleRoster(identity);
    expect(back.schemaVersion).toBe(ROSTER_SCHEMA_VERSION);
    expect(back.authors[0]?.givenName).toBe('Jane');
    expect(back.authors[0]?.email).toBe('jane.doe@example.org');
    expect(back.authors[0]?.orcid).toBe('0000-0001-2345-6789');
    expect(back.authors[0]?.affiliations[0]?.institution).toBe('Example University');
  });

  it('parseCompatibleIdentity accepts v1 and v2 documents', () => {
    const parsedV1 = parseCompatibleIdentity(v1Roster);
    expect(isV1Roster(parsedV1)).toBe(true);

    const identity = fromSimpleRoster(v1Roster);
    const parsedV2 = parseCompatibleIdentity(identity);
    expect(isIdentityDocument(parsedV2)).toBe(true);
  });

  it('toSimpleRoster accepts a v1 roster directly', () => {
    const roster = toSimpleRoster(v1Roster);
    expect(roster.schemaVersion).toBe(ROSTER_SCHEMA_VERSION);
    expect(roster.name).toBe('Lab roster');
  });

  it('exports and imports identity v2 JSON', () => {
    const identity = fromSimpleRoster(v1Roster);
    const json = exportIdentityV2Json(identity);
    const imported = importIdentityV2Json(json);
    expect(imported.schemaVersion).toBe(IDENTITY_SCHEMA_VERSION);
    expect(imported.authors[0]?.familyName).toBe('Doe');
  });

  it('preserves v2-only expansions when round-tripping is not required', () => {
    const identity = fromSimpleRoster(v1Roster);
    identity.authors[0]!.preferredPublicationName = 'J. Doe';
    identity.authors[0]!.creditRoles = ['writing_original_draft'];
    const json = exportIdentityV2Json(identity);
    const imported = importIdentityV2Json(json);
    expect(imported.authors[0]?.preferredPublicationName).toBe('J. Doe');
    expect(imported.authors[0]?.creditRoles).toEqual(['writing_original_draft']);
  });
});
