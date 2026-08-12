import { z } from 'zod';

export const SourceKindSchema = z.enum([
  'self_declared',
  'imported_csv',
  'imported_google_sheet',
  'orcid',
  'publisher',
  'institution',
  'public_scholarly_graph',
  'collaborator_confirmed',
]);

export const VerificationStatusSchema = z.enum([
  'unverified',
  'self_attested',
  'externally_verified',
]);

export const ProvenanceAssertionSchema = z.object({
  source: SourceKindSchema,
  timestamp: z.string().datetime(),
  verificationStatus: VerificationStatusSchema.default('unverified'),
  note: z.string().optional(),
});

export type SourceKind = z.infer<typeof SourceKindSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type ProvenanceAssertion = z.infer<typeof ProvenanceAssertionSchema>;

/** Default provenance for locally entered data — never externally verified. */
export function defaultProvenance(
  source: SourceKind = 'self_declared',
): ProvenanceAssertion {
  return {
    source,
    timestamp: new Date().toISOString(),
    verificationStatus: 'unverified',
  };
}
