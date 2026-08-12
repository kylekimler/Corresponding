import { describe, expect, it } from 'vitest';
import {
  chooseSelectedRosterId,
  createMemoryPopupPreferences,
} from '@/popup/preferences';

describe('popup roster preferences', () => {
  it('persists and clears the selected roster id', async () => {
    const preferences = createMemoryPopupPreferences();

    expect(await preferences.getSelectedRosterId()).toBeUndefined();
    await preferences.setSelectedRosterId('roster-b');
    expect(await preferences.getSelectedRosterId()).toBe('roster-b');
    await preferences.setSelectedRosterId(undefined);
    expect(await preferences.getSelectedRosterId()).toBeUndefined();
  });

  it('restores a valid remembered roster', () => {
    expect(
      chooseSelectedRosterId(['roster-a', 'roster-b'], undefined, 'roster-b'),
    ).toBe('roster-b');
  });

  it('prefers an explicit selection and safely falls back after deletion', () => {
    expect(
      chooseSelectedRosterId(['roster-a', 'roster-b'], 'roster-a', 'roster-b'),
    ).toBe('roster-a');
    expect(
      chooseSelectedRosterId(['roster-b'], 'deleted-roster', 'deleted-roster'),
    ).toBe('roster-b');
    expect(chooseSelectedRosterId([], 'deleted-roster', 'deleted-roster')).toBe(
      undefined,
    );
  });
});
