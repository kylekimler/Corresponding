import { handleExtensionRequest } from './handleRequest';

/**
 * Shared Chrome message listener for popup detect/preview/fill.
 * Used by the on-demand content script and the contextual autofill script
 * so the popup does not inject a second listener on supported hosts.
 */
export function installPageBridge(
  doc: Document = document,
  href = () => doc.defaultView?.location.href ?? '',
): void {
  browser.runtime.onMessage.addListener(
    (message: unknown, _sender, sendResponse) => {
      void handleExtensionRequest(message, doc, href())
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
}
