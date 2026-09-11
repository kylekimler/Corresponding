import {
  createPopupPreferences,
  SELECTED_ROSTER_KEY,
} from '@/popup/preferences';
import { createRosterStore, STORAGE_KEY } from '@/roster/storage';
import type { Roster } from '@/schema/author';

export async function loadActiveRoster(): Promise<Roster | undefined> {
  const prefs = createPopupPreferences();
  const store = createRosterStore();
  const remembered = await prefs.getSelectedRosterId();
  // Contextual suggestions must use the user's selected manuscript, never
  // an arbitrary saved roster after deletion or a missing preference.
  return remembered ? store.get(remembered) : undefined;
}

export function subscribeRosterChanges(listener: () => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return () => undefined;
  }
  const handler: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
    changes,
    area,
  ) => {
    if (area !== 'local') return;
    if (STORAGE_KEY in changes || SELECTED_ROSTER_KEY in changes) {
      listener();
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
