import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE,
  classifyBand,
  mayFill,
  sourceDefaultConfidence,
} from '@/recognition/confidence';

describe('confidence model', () => {
  it('documents hierarchy thresholds', () => {
    expect(CONFIDENCE.exactSelector).toBe(1);
    expect(CONFIDENCE.platformPattern).toBeGreaterThan(
      CONFIDENCE.semanticLabelClear,
    );
    expect(CONFIDENCE.semanticLabelClear).toBeGreaterThanOrEqual(
      CONFIDENCE.fillThreshold,
    );
    expect(CONFIDENCE.semanticLabelAmbiguous).toBeLessThan(
      CONFIDENCE.fillThreshold,
    );
    expect(CONFIDENCE.structuralGuess).toBeLessThan(
      CONFIDENCE.semanticLabelAmbiguous,
    );
  });

  it('only allows fill at/above threshold', () => {
    expect(mayFill(CONFIDENCE.fillThreshold)).toBe(true);
    expect(mayFill(CONFIDENCE.semanticLabelAmbiguous)).toBe(false);
    expect(mayFill(CONFIDENCE.structuralGuess)).toBe(false);
  });

  it('maps sources to defaults', () => {
    expect(sourceDefaultConfidence('exact_selector')).toBe(1);
    expect(sourceDefaultConfidence('user_override')).toBe(1);
    expect(classifyBand(1)).toBe('exact');
    expect(classifyBand(0.85)).toBe('high');
    expect(classifyBand(0.45)).toBe('low');
  });
});
