import { describe, expect, it } from 'vitest';
import { failureState, formatFailure } from '@/failure/states';

describe('failure states', () => {
  it('explains unknown portal without claiming modification', () => {
    const state = failureState('unknown_portal');
    expect(state.fieldsModified).toBe(false);
    const text = formatFailure(state);
    expect(text).toContain('Understood:');
    expect(text).toContain('Could not understand:');
    expect(text).toContain('Fields modified: no');
    expect(text).toContain('Next:');
  });

  it('covers linked account and storage failures', () => {
    expect(failureState('linked_account_mismatch').nextSteps.length).toBeGreaterThan(0);
    expect(failureState('corrupted_local_storage').title).toMatch(/storage/i);
  });
});
