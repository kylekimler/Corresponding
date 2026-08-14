import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT_SCRIPT_FILE,
  isDevelopmentFixtureUrl,
  isInjectableTabUrl,
  normalizeTabResponse,
  sendToActiveTab,
} from '@/entrypoints/popup/tabBridge';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normalizeTabResponse', () => {
  it('returns typed responses unchanged', () => {
    const ok = { type: 'DETECT_RESULT' as const, result: { platformId: 'unknown' } };
    expect(normalizeTabResponse(ok)).toEqual(ok);
  });

  it('converts undefined/null into ERROR (prevents popup crash on .type)', () => {
    const fromUndefined = normalizeTabResponse(undefined);
    expect(fromUndefined.type).toBe('ERROR');
    expect(fromUndefined.type === 'ERROR' && fromUndefined.message).toMatch(
      /updated|interrupted/i,
    );

    const fromNull = normalizeTabResponse(null);
    expect(fromNull.type).toBe('ERROR');
  });

  it('rejects objects without a type field', () => {
    expect(normalizeTabResponse({ filled: 1 }).type).toBe('ERROR');
  });

  it('rejects typed result envelopes with missing payloads', () => {
    expect(normalizeTabResponse({ type: 'DETECT_RESULT' }).type).toBe('ERROR');
    expect(
      normalizeTabResponse({ type: 'ERROR', message: undefined }).type,
    ).toBe('ERROR');
  });
});

describe('isInjectableTabUrl', () => {
  it('allows journal http(s) pages', () => {
    expect(isInjectableTabUrl('https://mts-staging.nature.com/cgi-bin/main.plex')).toBe(
      true,
    );
  });

  it('blocks chrome:// and webstore', () => {
    expect(isInjectableTabUrl('chrome://extensions')).toBe(false);
    expect(isInjectableTabUrl('https://chromewebstore.google.com/detail/x')).toBe(
      false,
    );
  });
});

describe('isDevelopmentFixtureUrl', () => {
  it('allows only the pinned local Nature test fixture', () => {
    expect(
      isDevelopmentFixtureUrl(
        'http://localhost:3000/fixtures/nature-mts-sample.html',
      ),
    ).toBe(true);
    expect(
      isDevelopmentFixtureUrl(
        'https://journal.example/fixtures/nature-mts-sample.html',
      ),
    ).toBe(false);
    expect(
      isDevelopmentFixtureUrl('http://localhost:3000/fixtures/other.html'),
    ).toBe(false);
    expect(
      isDevelopmentFixtureUrl(
        'http://127.0.0.1:3000/fixtures/nature-mts-sample.html',
      ),
    ).toBe(false);
  });
});

describe('content-script injection', () => {
  it('injects the extension-relative file and waits for PONG before the request', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockResolvedValueOnce({ type: 'PONG' })
      .mockResolvedValueOnce({
        type: 'DETECT_RESULT',
        result: {
          platformId: 'nature-mts',
          confidence: 1,
          label: 'Nature',
          evidence: [],
        },
      });
    const executeScript = vi.fn().mockResolvedValue([]);
    vi.stubGlobal('browser', {
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 7,
            url: 'http://localhost:3000/fixtures/nature-mts-sample.html',
          },
        ]),
        sendMessage,
      },
      scripting: { executeScript },
    });

    const result = await sendToActiveTab({ type: 'DETECT' });

    expect(result.type).toBe('DETECT_RESULT');
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7, allFrames: true },
      files: [CONTENT_SCRIPT_FILE],
    });
    expect(CONTENT_SCRIPT_FILE.startsWith('/')).toBe(false);
    expect(sendMessage.mock.calls.map((call) => call[1].type)).toEqual([
      'PING',
      'PING',
      'DETECT',
    ]);
  });

  it('merges diagnostic captures from every injectable frame', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ type: 'PONG' })
      .mockResolvedValueOnce({
        type: 'DIAGNOSTIC_RESULT',
        result: {
          redactionComplete: true,
          notes: ['top'],
          fieldCount: 1,
          controlCount: 0,
          structuralFields: [
            { tag: 'select', idPattern: 'RoleDropdown', category: 'other' },
          ],
          controls: [],
          structure: { repeatedGroups: [], authorGroupCount: 0 },
          frames: { seen: 0, readable: 0, blocked: 0, frames: [] },
          fields: [],
        },
      })
      .mockResolvedValueOnce({
        type: 'DIAGNOSTIC_RESULT',
        result: {
          redactionComplete: true,
          notes: ['child'],
          fieldCount: 1,
          controlCount: 0,
          structuralFields: [
            { tag: 'input', idPattern: 'givenName', category: 'author' },
          ],
          controls: [],
          structure: { repeatedGroups: [], authorGroupCount: 0 },
          frames: { seen: 0, readable: 0, blocked: 0, frames: [] },
          fields: [],
        },
      });
    const executeScript = vi
      .fn()
      .mockResolvedValueOnce([{ frameId: 0 }, { frameId: 2 }]);
    vi.stubGlobal('browser', {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 11, url: 'https://www.editorialmanager.com/pgenetics/default2.aspx' },
        ]),
        sendMessage,
      },
      scripting: { executeScript },
    });

    const result = await sendToActiveTab({ type: 'DIAGNOSTIC' });
    expect(result.type).toBe('DIAGNOSTIC_RESULT');
    if (result.type === 'DIAGNOSTIC_RESULT') {
      expect(result.result.structuralFields.map((f) => f.idPattern)).toEqual(
        expect.arrayContaining(['RoleDropdown', 'givenName']),
      );
      expect(result.result.notes.join(' ')).toMatch(/Merged 2 injectable frame/);
    }
    expect(sendMessage.mock.calls.map((call) => call[1].type)).toEqual([
      'PING',
      'DIAGNOSTIC',
      'DIAGNOSTIC',
    ]);
    expect(sendMessage.mock.calls[1]?.[2]).toEqual({ frameId: 0 });
    expect(sendMessage.mock.calls[2]?.[2]).toEqual({ frameId: 2 });
  });

  it('does not reinject when the content script intentionally returns ERROR', async () => {
    const executeScript = vi.fn();
    vi.stubGlobal('browser', {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 8, url: 'https://journal.example/submit' },
        ]),
        sendMessage: vi
          .fn()
          .mockResolvedValueOnce({ type: 'PONG' })
          .mockResolvedValueOnce({
            type: 'ERROR',
            message: 'Unsupported platform',
          }),
      },
      scripting: { executeScript },
    });

    await expect(sendToActiveTab({ type: 'DETECT' })).resolves.toEqual({
      type: 'ERROR',
      message: 'Unsupported platform',
    });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('refuses to message a different tab than the preview target', async () => {
    const sendMessage = vi.fn();
    const executeScript = vi.fn();
    vi.stubGlobal('browser', {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 9, url: 'https://journal.example/other-submission' },
        ]),
        sendMessage,
      },
      scripting: { executeScript },
    });

    await expect(
      sendToActiveTab(
        { type: 'FILL', roster: {} as never, overwrite: false },
        { tabId: 8, url: 'https://journal.example/submit' },
      ),
    ).resolves.toEqual({
      type: 'ERROR',
      message:
        'The active tab changed after Preview. Preview this page again before filling.',
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('rechecks the expected tab immediately before Fill messaging', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 8, url: 'https://journal.example/submit' },
      ])
      .mockResolvedValueOnce([
        { id: 9, url: 'https://journal.example/other-submission' },
      ]);
    const sendMessage = vi.fn().mockResolvedValueOnce({ type: 'PONG' });
    vi.stubGlobal('browser', {
      tabs: { query, sendMessage },
      scripting: { executeScript: vi.fn() },
    });

    const result = await sendToActiveTab(
      { type: 'FILL', roster: {} as never, overwrite: false },
      { tabId: 8, url: 'https://journal.example/submit' },
    );

    expect(result.type).toBe('ERROR');
    expect(sendMessage.mock.calls.map((call) => call[1].type)).toEqual(['PING']);
  });
});
