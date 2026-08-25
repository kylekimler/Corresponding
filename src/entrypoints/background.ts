import { handleWebsiteRequest } from '@/messaging/website';
import { createPopupPreferences } from '@/popup/preferences';
import { createRosterStore } from '@/roster/storage';

export default defineBackground(() => {
  const store = createRosterStore();
  const preferences = createPopupPreferences();
  const mode =
    import.meta.env.MODE === 'production' ? 'production' : 'development';
  const version = browser.runtime.getManifest().version;

  browser.runtime.onMessageExternal.addListener(
    (message: unknown, sender, sendResponse) => {
      const origin =
        sender.origin ??
        (typeof sender.url === 'string' && sender.url
          ? new URL(sender.url).origin
          : '');
      void handleWebsiteRequest(message, origin, {
        store,
        preferences,
        mode,
        version,
      }).then(sendResponse);
      return true;
    },
  );
});
