import { describe, expect, it } from 'vitest';
import { makeNAuthors, makeRoster } from '../helpers/roster';
import {
  fromSimpleRoster,
  toSimpleRoster,
} from '@/schema/identityV2';
import { declareProvenance } from '@/schema/provenance';
import { ensureRoster, migrateLocalDocument } from '@/schema/migrate';

describe('identity v2 + provenance', () => {
  it('round-trips simple roster through identity document', () => {
    const roster = makeRoster(makeNAuthors(2));
    const identity = fromSimpleRoster(roster);
    expect(identity.schemaVersion).toBe(2);
    expect(identity.people[0]?.emails[0]?.verificationStatus).toBe('unverified');
    const back = toSimpleRoster(identity);
    expect(back.authors).toHaveLength(2);
    expect(back.authors[0]?.givenName).toBe(roster.authors[0]?.givenName);
  });

  it('migrates v1 roster JSON', () => {
    const roster = makeRoster(makeNAuthors(1));
    const migrated = migrateLocalDocument(roster);
    expect(migrated.kind).toBe('roster');
    expect(ensureRoster(roster).id).toBe(roster.id);
  });

  it('defaults provenance to unverified', () => {
    const p = declareProvenance('imported_csv');
    expect(p.verificationStatus).toBe('unverified');
    expect(p.source).toBe('imported_csv');
  });
});
