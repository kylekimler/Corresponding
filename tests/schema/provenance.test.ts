import { describe, expect, it } from 'vitest';
import {
  ProvenanceAssertionSchema,
  defaultProvenance,
} from '@/schema/provenance';

describe('provenance defaults', () => {
  it('defaults verificationStatus to unverified', () => {
    const parsed = ProvenanceAssertionSchema.parse({
      source: 'orcid',
      timestamp: '2026-08-12T00:00:00.000Z',
    });
    expect(parsed.verificationStatus).toBe('unverified');
  });

  it('never sets externally_verified via defaultProvenance', () => {
    const prov = defaultProvenance('publisher');
    expect(prov.verificationStatus).toBe('unverified');
    expect(prov.source).toBe('publisher');
  });

  it('allows externally_verified only when explicitly set', () => {
    const parsed = ProvenanceAssertionSchema.parse({
      source: 'orcid',
      timestamp: '2026-08-12T00:00:00.000Z',
      verificationStatus: 'externally_verified',
    });
    expect(parsed.verificationStatus).toBe('externally_verified');
  });

  it('accepts all SourceKind values', () => {
    const kinds = [
      'self_declared',
      'imported_csv',
      'imported_google_sheet',
      'orcid',
      'publisher',
      'institution',
      'public_scholarly_graph',
      'collaborator_confirmed',
    ] as const;
    for (const source of kinds) {
      const parsed = ProvenanceAssertionSchema.parse({
        source,
        timestamp: '2026-08-12T00:00:00.000Z',
      });
      expect(parsed.source).toBe(source);
    }
  });
});
