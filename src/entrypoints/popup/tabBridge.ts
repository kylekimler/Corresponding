import type { ExtensionRequest, ExtensionResponse } from '@/messaging/protocol';
import type { TabTarget } from '@/popup/previewSession';

export const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';
const READY_ATTEMPTS = 5;

/** Refuse injection into browser-internal / non-http(s) pages. */
export function isInjectableTabUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (
      (parsed.hostname === 'chrome.google.com' &&
        parsed.pathname.startsWith('/webstore')) ||
      parsed.hostname === 'chromewebstore.google.com'
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isDevelopmentFixtureUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'http:' &&
      parsed.hostname === 'localhost' &&
      parsed.port === '3000' &&
      parsed.pathname === '/fixtures/nature-mts-sample.html'
    );
  } catch {
    return false;
  }
}

export async function isActiveDevelopmentFixtureTab(): Promise<boolean> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return isDevelopmentFixtureUrl(tab?.url);
  } catch {
    return false;
  }
}

export async function getActiveTabTarget(): Promise<TabTarget | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isInjectableTabUrl(tab.url)) return null;
  return { tabId: tab.id, url: tab.url! };
}

/** Normalize chrome.runtime messaging replies into a typed ExtensionResponse. */
export function normalizeTabResponse(response: unknown): ExtensionResponse {
  if (
    response &&
    typeof response === 'object' &&
    'type' in response &&
    typeof (response as { type: unknown }).type === 'string'
  ) {
    return response as ExtensionResponse;
  }
  return {
    type: 'ERROR',
    message:
      'No response from the page content script. Reload the extension and refresh the journal tab.',
  };
}

async function pingContentScript(tabId: number): Promise<boolean> {
  try {
    const res = await browser.tabs.sendMessage(tabId, {
      type: 'PING',
    } satisfies ExtensionRequest);
    return Boolean(res && typeof res === 'object' && 'type' in res);
  } catch {
    return false;
  }
}

async function injectContentScript(tabId: number): Promise<void> {
  type ScriptFile = NonNullable<
    Parameters<typeof browser.scripting.executeScript>[0]['files']
  >[number];
  await browser.scripting.executeScript({
    target: { tabId },
    // Chrome's executeScript API expects a relative path without a leading
    // slash. WXT's generated ScriptPublicPath type models packaged URLs with
    // a leading slash, so narrow the known build artifact at this boundary.
    files: [CONTENT_SCRIPT_FILE as ScriptFile],
  });
}

async function ensureContentScript(tabId: number): Promise<void> {
  if (await pingContentScript(tabId)) return;
  try {
    await injectContentScript(tabId);
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? err.message
        : 'Could not inject content script into the active tab',
      { cause: err },
    );
  }
  for (let attempt = 0; attempt < READY_ATTEMPTS; attempt += 1) {
    if (await pingContentScript(tabId)) return;
    await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
  }
  throw new Error(
    'Content script was injected but did not become ready. Refresh the journal tab and retry.',
  );
}

async function sendOnce(
  tabId: number,
  message: ExtensionRequest,
): Promise<ExtensionResponse> {
  try {
    const raw = await browser.tabs.sendMessage(tabId, message);
    return normalizeTabResponse(raw);
  } catch (err) {
    return {
      type: 'ERROR',
      message:
        err instanceof Error
          ? err.message
          : 'Failed to message the active tab content script',
    };
  }
}

export async function sendToActiveTab(
  message: ExtensionRequest,
  expectedTarget?: TabTarget,
): Promise<ExtensionResponse> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { type: 'ERROR', message: 'No active tab' };
  }
  if (!isInjectableTabUrl(tab.url)) {
    return {
      type: 'ERROR',
      message: 'Cannot inject into this page. Open a journal submission form (http/https).',
    };
  }
  if (
    expectedTarget &&
    (tab.id !== expectedTarget.tabId || tab.url !== expectedTarget.url)
  ) {
    return {
      type: 'ERROR',
      message: 'The active tab changed after Preview. Preview this page again before filling.',
    };
  }

  try {
    await ensureContentScript(tab.id);
  } catch (err) {
    return {
      type: 'ERROR',
      message:
        err instanceof Error
          ? err.message
          : 'Could not prepare the content script on this tab',
    };
  }
  if (expectedTarget) {
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (
      currentTab?.id !== expectedTarget.tabId ||
      currentTab.url !== expectedTarget.url
    ) {
      return {
        type: 'ERROR',
        message:
          'The active tab changed after Preview. Preview this page again before filling.',
      };
    }
  }

  // Do not reinject on a typed ERROR: it may be an intentional application
  // refusal (unsupported/unsafe mapping), not a transport failure.
  return sendOnce(tab.id, message);
}
