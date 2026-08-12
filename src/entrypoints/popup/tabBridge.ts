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

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'PING' } satisfies ExtensionRequest);
  } catch {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['/content-scripts/content.js'],
    });
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
  await ensureContentScript(tab.id);
  return browser.tabs.sendMessage(tab.id, message);
}
