const SELECTED_ROSTER_KEY = 'corresponding_selected_roster_v1';

type MemoryPreferences = {
  selectedRosterId?: string;
};

type PreferencesArea = chrome.storage.StorageArea | MemoryPreferences;

export interface PopupPreferences {
  getSelectedRosterId(): Promise<string | undefined>;
  setSelectedRosterId(id: string | undefined): Promise<void>;
}

export function chooseSelectedRosterId(
  rosterIds: string[],
  preferredId?: string,
  rememberedId?: string,
): string | undefined {
  if (preferredId && rosterIds.includes(preferredId)) return preferredId;
  if (rememberedId && rosterIds.includes(rememberedId)) return rememberedId;
  return rosterIds[0];
}

export function createPopupPreferences(area?: PreferencesArea): PopupPreferences {
  const bucket: PreferencesArea =
    area ??
    (typeof chrome !== 'undefined' && chrome.storage?.local
      ? chrome.storage.local
      : {});

  return {
    async getSelectedRosterId() {
      if ('get' in bucket && typeof bucket.get === 'function') {
        const data = await bucket.get(SELECTED_ROSTER_KEY);
        const value = data[SELECTED_ROSTER_KEY];
        return typeof value === 'string' && value ? value : undefined;
      }
      return bucket.selectedRosterId;
    },

    async setSelectedRosterId(id) {
      if ('set' in bucket && typeof bucket.set === 'function') {
        if (id) {
          await bucket.set({ [SELECTED_ROSTER_KEY]: id });
        } else {
          await bucket.remove(SELECTED_ROSTER_KEY);
        }
        return;
      }
      bucket.selectedRosterId = id;
    },
  };
}

export function createMemoryPopupPreferences(
  selectedRosterId?: string,
): PopupPreferences {
  return createPopupPreferences({ selectedRosterId });
}
