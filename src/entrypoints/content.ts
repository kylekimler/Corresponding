import { handleExtensionRequest } from '@/messaging/handleRequest';

export default defineContentScript({
  // Official WXT on-demand mode: build the script without manifest registration.
  // The popup injects it only into the active tab via scripting.executeScript.
  registration: 'runtime',
  runAt: 'document_idle',
  main() {
    browser.runtime.onMessage.addListener(
      (message: unknown, _sender, sendResponse) => {
        // Chrome ignores arbitrary return objects from onMessage listeners.
        // Respond synchronously through sendResponse instead.
        sendResponse(handleExtensionRequest(message, document, location.href));
        return false;
      },
    );
  },
});
