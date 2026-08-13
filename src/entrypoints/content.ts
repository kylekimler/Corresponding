import { handleExtensionRequest } from '@/messaging/handleRequest';

export default defineContentScript({
  // Official WXT on-demand mode: build the script without manifest registration.
  // The popup injects it only into the active tab via scripting.executeScript.
  registration: 'runtime',
  runAt: 'document_idle',
  main() {
    browser.runtime.onMessage.addListener(
      (message: unknown, _sender, sendResponse) => {
        // Keep Chrome's response channel open for modal-based adapters that
        // save one author at a time.
        void handleExtensionRequest(message, document, location.href)
          .then(sendResponse)
          .catch((error: unknown) =>
            sendResponse({
              type: 'ERROR',
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        return true;
      },
    );
  },
});
