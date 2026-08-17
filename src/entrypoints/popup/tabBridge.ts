import { mergeDiagnosticReports } from '@/diagnostics/merge';
import type { DiagnosticReport } from '@/diagnostics/formProbe';
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
  return {
    tabId: tab.id,
    url: tab.url!,
    frameId: detectedFrameId(tab.id),
  };
}

/** Normalize chrome.runtime messaging replies into a typed ExtensionResponse. */
export function normalizeTabResponse(response: unknown): ExtensionResponse {
  if (response && typeof response === 'object' && 'type' in response) {
    const candidate = response as {
      type?: unknown;
      result?: unknown;
      message?: unknown;
    };
    if (candidate.type === 'PONG') return { type: 'PONG' };
    if (candidate.type === 'ERROR' && typeof candidate.message === 'string') {
      return { type: 'ERROR', message: candidate.message };
    }
    if (
      [
        'DETECT_RESULT',
        'INSPECT_RESULT',
        'FILL_RESULT',
        'VALIDATE_RESULT',
        'DIAGNOSTIC_RESULT',
      ].includes(String(candidate.type)) &&
      candidate.result &&
      typeof candidate.result === 'object'
    ) {
      return candidate as ExtensionResponse;
    }
  }
  return {
    type: 'ERROR',
    message:
      'The page connection was interrupted, usually because Corresponding was updated. Close and reopen the popup, then refresh the journal tab.',
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
    target: { tabId, allFrames: true },
    // Chrome's executeScript API expects a relative path without a leading
    // slash. WXT's generated ScriptPublicPath type models packaged URLs with
    // a leading slash, so narrow the known build artifact at this boundary.
    files: [CONTENT_SCRIPT_FILE as ScriptFile],
  });
}

/** Frame ids, or an empty list when the tab cannot be enumerated. */
async function safeListInjectableFrameIds(tabId: number): Promise<number[]> {
  try {
    return await listInjectableFrameIds(tabId);
  } catch {
    return [];
  }
}

async function listInjectableFrameIds(tabId: number): Promise<number[]> {
  const results = await browser.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => true,
  });
  return [
    ...new Set(
      results
        .map((result) => result.frameId)
        .filter((id): id is number => typeof id === 'number'),
    ),
  ];
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
  frameId?: number,
): Promise<ExtensionResponse> {
  try {
    const raw =
      frameId === undefined
        ? await browser.tabs.sendMessage(tabId, message)
        : await browser.tabs.sendMessage(tabId, message, { frameId });
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
  if (message.type === 'DIAGNOSTIC') {
    return collectDiagnosticFromAllFrames(tab.id, message);
  }
  if (message.type === 'DETECT') {
    return detectBestFrame(tab.id);
  }
  // Reuse the frame that recognised the portal; a broadcast can otherwise be
  // answered by an unrelated frame that has no author form.
  return sendOnce(tab.id, message, expectedTarget?.frameId);
}

export interface FrameDetection {
  response: ExtensionResponse;
  frameId?: number;
}

/**
 * Ask every injectable frame to detect, and keep the strongest answer. Portal
 * pages carry consent and analytics frames whose content script would otherwise
 * win the race with "unknown".
 */
export async function detectAcrossFrames(
  tabId: number,
): Promise<FrameDetection> {
  const frameIds = await safeListInjectableFrameIds(tabId);
  if (frameIds.length <= 1) {
    return { response: await sendOnce(tabId, { type: 'DETECT' }), frameId: frameIds[0] };
  }

  let best: FrameDetection | undefined;
  let bestConfidence = -1;
  for (const frameId of frameIds) {
    const response = await sendOnce(tabId, { type: 'DETECT' }, frameId);
    if (response.type !== 'DETECT_RESULT') continue;
    const { confidence, platformId } = response.result;
    // Prefer a real match; fall back to the highest confidence seen.
    const score = platformId === 'unknown' ? confidence - 1 : confidence;
    if (score > bestConfidence) {
      bestConfidence = score;
      best = { response, frameId };
    }
  }
  return best ?? { response: await sendOnce(tabId, { type: 'DETECT' }) };
}

async function detectBestFrame(tabId: number): Promise<ExtensionResponse> {
  const { response, frameId } = await detectAcrossFrames(tabId);
  if (response.type === 'DETECT_RESULT') {
    lastDetectedFrameId.set(tabId, frameId);
  }
  return response;
}

/** Frame that most recently recognised the portal, per tab. */
const lastDetectedFrameId = new Map<number, number | undefined>();

export function detectedFrameId(tabId: number): number | undefined {
  return lastDetectedFrameId.get(tabId);
}

async function collectDiagnosticFromAllFrames(
  tabId: number,
  message: ExtensionRequest,
): Promise<ExtensionResponse> {
  const frameIds = await safeListInjectableFrameIds(tabId);
  if (frameIds.length === 0) {
    return sendOnce(tabId, message);
  }

  const reports: DiagnosticReport[] = [];
  for (const frameId of frameIds) {
    const response = await sendOnce(tabId, message, frameId);
    if (response.type === 'DIAGNOSTIC_RESULT') {
      reports.push(response.result);
    }
  }
  if (reports.length === 0) {
    return sendOnce(tabId, message);
  }
  if (reports.length === 1) {
    return { type: 'DIAGNOSTIC_RESULT', result: reports[0]! };
  }
  return {
    type: 'DIAGNOSTIC_RESULT',
    result: mergeDiagnosticReports(reports),
  };
}
