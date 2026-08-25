import type { Roster } from '@/schema/author';
import type { WebsiteRequest, WebsiteResponse } from '@/messaging/website';

export type BridgeErrorCode =
  | 'NOT_INSTALLED'
  | 'NO_ID'
  | 'UNAVAILABLE'
  | 'FORBIDDEN'
  | 'INVALID'
  | 'NOT_FOUND'
  | 'INVALID_ROSTER';

export type BridgeResult =
  | WebsiteResponse
  | { type: 'ERROR'; code: BridgeErrorCode; message: string };

type ChromeRuntime = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    responseCallback?: (response: unknown) => void,
  ) => void;
  lastError?: { message?: string };
};

function getChromeRuntime(): ChromeRuntime | undefined {
  const chromeApi = (
    globalThis as { chrome?: { runtime?: ChromeRuntime } }
  ).chrome;
  return chromeApi?.runtime;
}

export function configuredExtensionId(): string {
  const value = import.meta.env.VITE_EXTENSION_ID;
  return typeof value === 'string' ? value.trim() : '';
}

export function sendToExtension(
  message: WebsiteRequest,
  options: {
    extensionId?: string;
    runtime?: ChromeRuntime;
    timeoutMs?: number;
  } = {},
): Promise<BridgeResult> {
  const extensionId = options.extensionId ?? configuredExtensionId();
  if (!extensionId) {
    return Promise.resolve({
      type: 'ERROR',
      code: 'NO_ID',
      message:
        'The web app does not know the Corresponding extension id yet. Set VITE_EXTENSION_ID for local development.',
    });
  }

  const runtime = options.runtime ?? getChromeRuntime();
  if (!runtime?.sendMessage) {
    return Promise.resolve({
      type: 'ERROR',
      code: 'NOT_INSTALLED',
      message: 'The Corresponding extension is not installed in this browser.',
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({
        type: 'ERROR',
        code: 'UNAVAILABLE',
        message: 'The extension did not respond.',
      });
    }, options.timeoutMs ?? 4000);

    try {
      runtime.sendMessage(extensionId, message, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (runtime.lastError) {
          resolve({
            type: 'ERROR',
            code: 'NOT_INSTALLED',
            message:
              runtime.lastError.message ??
              'Could not reach the Corresponding extension.',
          });
          return;
        }
        if (!response || typeof response !== 'object' || !('type' in response)) {
          resolve({
            type: 'ERROR',
            code: 'UNAVAILABLE',
            message: 'The extension returned an empty reply.',
          });
          return;
        }
        resolve(response as WebsiteResponse);
      });
    } catch {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        type: 'ERROR',
        code: 'NOT_INSTALLED',
        message: 'The Corresponding extension is not installed in this browser.',
      });
    }
  });
}

export function pingExtension(
  options?: Parameters<typeof sendToExtension>[1],
): Promise<BridgeResult> {
  return sendToExtension({ type: 'PING' }, options);
}

export function saveRosterToExtension(
  roster: Roster,
  options?: Parameters<typeof sendToExtension>[1],
): Promise<BridgeResult> {
  return sendToExtension({ type: 'SAVE_ROSTER', roster }, options);
}

export function loadSelectedRoster(
  options?: Parameters<typeof sendToExtension>[1],
): Promise<BridgeResult> {
  return sendToExtension({ type: 'GET_SELECTED' }, options);
}
