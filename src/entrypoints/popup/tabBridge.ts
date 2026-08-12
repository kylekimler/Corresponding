import type { ExtensionRequest, ExtensionResponse } from '@/messaging/protocol';

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
  await browser.scripting.executeScript({
    target: { tabId },
    files: ['/content-scripts/content.js'],
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

  let response = await sendOnce(tab.id, message);
  if (response.type === 'ERROR') {
    // One retry after a fresh inject — covers race where PING succeeded but
    // the listener was not yet ready for the real request.
    try {
      await injectContentScript(tab.id);
      response = await sendOnce(tab.id, message);
    } catch {
      // keep original error response
    }
  }
  return response;
}
