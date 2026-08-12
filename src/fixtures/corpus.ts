import type { CanonicalField } from '@/recognition/types';
import type { PlatformId } from '@/adapters/types';
import { z } from 'zod';

/** Community-contributed fixture corpus entry (no network upload). */
export interface FixtureCorpusEntry {
  /** Stable slug, e.g. nature-mts-synthetic */
  id: string;
  /** Broad platform family for grouping */
  platformFamily: string;
  journalId?: string;
  /** ISO date when the fixture was captured or authored */
  sourceDate: string;
  description?: string;
  /** Sanitized HTML — no real PII; use placeholders only */
  sanitizedHtml: string;
  expectedDetection: {
    platformId: PlatformId | 'unknown';
    minConfidence?: number;
  };
  expectedMappings: Array<{
    idPattern?: string;
    namePattern?: string;
    canonicalField: CanonicalField;
    minConfidence?: number;
    authorGroupIndex?: number;
  }>;
  /** Field id/name patterns that should remain unresolved */
  expectedUnsupportedFields?: string[];
}

export interface FixtureCorpusFile {
  schemaVersion: 1;
  fixtures: FixtureCorpusEntry[];
}

/** Alias used by corpus replay tests. */
export type CorpusFixture = FixtureCorpusEntry;

export const CorpusFixtureSchema = z.object({
  id: z.string().min(1),
  platformFamily: z.string().min(1),
  journalId: z.string().nullable().optional(),
  sourceDate: z.string(),
  description: z.string().optional(),
  sanitizedHtml: z.string(),
  expectedDetection: z.object({
    platformId: z.string(),
    minConfidence: z.number().optional(),
  }),
  expectedMappings: z.array(
    z.object({
      idPattern: z.string().optional(),
      namePattern: z.string().optional(),
      canonicalField: z.string(),
      minConfidence: z.number().optional(),
      authorGroupIndex: z.number().optional(),
    }),
  ),
  expectedUnsupportedFields: z.array(z.string()).optional(),
});
