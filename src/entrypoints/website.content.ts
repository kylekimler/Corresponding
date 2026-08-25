import {
  createWebsiteHandshakeReady,
  isWebsiteHandshakeRequest,
  WEBSITE_CONTENT_SCRIPT_MATCHES,
} from '@/messaging/websiteHandshake';

/**
 * Announce this install to corresponding.app (and local Vite ports).
 * Journal pages are not matched. No author data is posted.
 */
export default defineContentScript({
  matches: [...WEBSITE_CONTENT_SCRIPT_MATCHES],
  runAt: 'document_start',
  main() {
    const announce = () => {
      window.postMessage(
        createWebsiteHandshakeReady(browser.runtime.id),
        window.location.origin,
      );
    };

    announce();
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isWebsiteHandshakeRequest(event.data)) return;
      announce();
    });
  },
});
