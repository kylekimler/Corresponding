import type { Roster } from '@/schema/author';
import type { WebsiteRequest, WebsiteResponse } from '@/messaging/website';
import { WebsiteResponseSchema } from './response';
import {
  createWebsiteHandshakeRequest,
  isWebsiteHandshakeReady,
} from '@/messaging/websiteHandshake';

export type BridgeErrorCode =
  | 'NOT_INSTALLED'
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

export const EXTENSION_NOT_CONNECTED =
  'Extension not connected. The roster is saved in this browser only.';

function getChromeRuntime(): ChromeRuntime | undefined {
  const chromeApi = (
    globalThis as { chrome?: { runtime?: ChromeRuntime } }
  ).chrome;
  return chromeApi?.runtime;
}

let cachedExtensionId = '';

export function configuredExtensionId(): string {
  const value = import.meta.env.VITE_EXTENSION_ID;
  return typeof value === 'string' ? value.trim() : '';
}

export function discoverExtensionId(
  options: {
    timeoutMs?: number;
    addListener?: typeof window.addEventListener;
    removeListener?: typeof window.removeEventListener;
    postMessage?: typeof window.postMessage;
    origin?: string;
  } = {},
): Promise<string> {
  const configured = configuredExtensionId();
  if (cachedExtensionId) return Promise.resolve(cachedExtensionId);

  const addListener = options.addListener ?? window.addEventListener.bind(window);
  const removeListener =
    options.removeListener ?? window.removeEventListener.bind(window);
  const post =
    options.postMessage ?? window.postMessage.bind(window);
  const origin = options.origin ?? window.location.origin;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      removeListener('message', onMessage);
      resolve(configured);
    }, options.timeoutMs ?? 1200);

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      if (!isWebsiteHandshakeReady(event.data)) return;
      window.clearTimeout(timer);
      removeListener('message', onMessage);
      cachedExtensionId = event.data.extensionId;
      resolve(event.data.extensionId);
    }

    addListener('message', onMessage);
    post(createWebsiteHandshakeRequest(), origin);
  });
}

export function sendToExtension(
  message: WebsiteRequest,
  options: {
    extensionId?: string;
    runtime?: ChromeRuntime;
    timeoutMs?: number;
  } = {},
): Promise<BridgeResult> {
  return (async () => {
    const extensionId =
      options.extensionId ?? (await discoverExtensionId());
    if (!extensionId) {
      return {
        type: 'ERROR',
        code: 'NOT_INSTALLED',
        message: EXTENSION_NOT_CONNECTED,
      };
    }

    const runtime = options.runtime ?? getChromeRuntime();
    if (!runtime?.sendMessage) {
      return {
        type: 'ERROR',
        code: 'NOT_INSTALLED',
        message: EXTENSION_NOT_CONNECTED,
      };
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
            cachedExtensionId = '';
            resolve({
              type: 'ERROR',
              code: 'NOT_INSTALLED',
              message: EXTENSION_NOT_CONNECTED,
            });
            return;
          }
          const parsed = WebsiteResponseSchema.safeParse(response);
          if (!parsed.success) {
            resolve({
              type: 'ERROR',
              code: 'UNAVAILABLE',
              message: 'The extension did not respond.',
            });
            return;
          }
          resolve(parsed.data);
        });
      } catch {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          type: 'ERROR',
          code: 'NOT_INSTALLED',
          message: EXTENSION_NOT_CONNECTED,
        });
      }
    });
  })();
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
