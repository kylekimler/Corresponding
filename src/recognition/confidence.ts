/**
 * Explicit confidence model for field mapping.
 *
 * Hierarchy (highest → lowest authority):
 * 1. exact tested platform selector
 * 2. known platform structural pattern
 * 3. generic semantic field recognition
 * 4. explicit user-confirmed mapping
 * 5. refusal to fill
 *
 * Never mutate a low-confidence field. Prefer false negatives over false positives.
 */

export type MappingSource =
  | 'exact_selector'
  | 'platform_pattern'
  | 'semantic_label'
  | 'structural_guess'
  | 'user_override';

/** Documented thresholds — tested in confidence.test.ts */
export const CONFIDENCE = {
  exactSelector: 1.0,
  platformPattern: 0.95,
  semanticLabelClear: 0.85,
  semanticLabelAmbiguous: 0.45,
  structuralGuess: 0.25,
  userOverride: 1.0,
  /** Minimum confidence required to propose a fill mutation. */
  fillThreshold: 0.8,
  /** Below this, mapping stays unresolved. */
  unresolvedBelow: 0.8,
} as const;

export function sourceDefaultConfidence(source: MappingSource): number {
  switch (source) {
    case 'exact_selector':
      return CONFIDENCE.exactSelector;
    case 'platform_pattern':
      return CONFIDENCE.platformPattern;
    case 'semantic_label':
      return CONFIDENCE.semanticLabelClear;
    case 'structural_guess':
      return CONFIDENCE.structuralGuess;
    case 'user_override':
      return CONFIDENCE.userOverride;
  }
}

export function mayFill(confidence: number): boolean {
  return confidence >= CONFIDENCE.fillThreshold;
}

export function classifyBand(
  confidence: number,
): 'exact' | 'high' | 'low' | 'refuse' {
  if (confidence >= CONFIDENCE.exactSelector) return 'exact';
  if (confidence >= CONFIDENCE.fillThreshold) return 'high';
  if (confidence >= CONFIDENCE.structuralGuess) return 'low';
  return 'refuse';
}
