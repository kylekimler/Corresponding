import type { CanonicalField } from '@/recognition/types';
import type { PlatformId } from '@/adapters/types';

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
