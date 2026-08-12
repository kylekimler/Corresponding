import type { ExtensionRequest, ExtensionResponse } from '@/messaging/protocol';

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'PING' } satisfies ExtensionRequest);
  } catch {
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/content.js'],
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
  await ensureContentScript(tab.id);
  return browser.tabs.sendMessage(tab.id, message);
}
