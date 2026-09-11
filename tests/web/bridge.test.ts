import { describe, expect, it, vi } from 'vitest';
import { makeNAuthors, makeRoster } from '../helpers/roster';
import {
  pingExtension,
  saveRosterToExtension,
  sendToExtension,
} from '../../web/src/bridge/client';

describe('website-to-extension client', () => {
  it('prefers the installed extension handshake over a stale environment ID', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_EXTENSION_ID', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const { discoverExtensionId } = await import('../../web/src/bridge/client');
    const discovered = discoverExtensionId({ origin: window.location.origin });
    window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: {
      source: 'corresponding-extension', type: 'READY', extensionId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    } }));
    expect(await discovered).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    vi.unstubAllEnvs();
  });
  it('rejects a success envelope without a valid saved roster', async () => {
    const result = await sendToExtension({ type: 'PING' }, {
      extensionId: 'abcdefghijklmnopabcdefghijklmnop',
      runtime: { sendMessage(_id, _message, callback) { callback?.({ type: 'SAVED', roster: { authors: [] } }); } },
    });
    expect(result).toMatchObject({ type: 'ERROR', code: 'UNAVAILABLE' });
  });
  it('reports a missing extension as not installed without sending', async () => {
    const result = await sendToExtension(
      { type: 'PING' },
      { extensionId: '', runtime: { sendMessage: () => undefined } },
    );
    expect(result).toMatchObject({ type: 'ERROR', code: 'NOT_INSTALLED' });
    expect(result.type === 'ERROR' && result.message).not.toMatch(
      /VITE_EXTENSION_ID/,
    );
  });

  it('reports an unavailable chrome.runtime as not installed', async () => {
    const result = await pingExtension({
      extensionId: 'abcdefghijklmnopabcdefghijklmnop',
      runtime: undefined,
    });
    expect(result).toMatchObject({ type: 'ERROR', code: 'NOT_INSTALLED' });
  });

  it('forwards a validated reply from the extension', async () => {
    const roster = makeRoster(makeNAuthors(2), 'Atlas');
    const result = await saveRosterToExtension(roster, {
      extensionId: 'abcdefghijklmnopabcdefghijklmnop',
      runtime: {
        sendMessage(_id, _message, callback) {
          callback?.({ type: 'SAVED', roster });
        },
      },
    });
    expect(result).toEqual({ type: 'SAVED', roster });
  });

  it('maps chrome.runtime.lastError to not installed', async () => {
    const result = await pingExtension({
      extensionId: 'abcdefghijklmnopabcdefghijklmnop',
      runtime: {
        lastError: { message: 'Could not establish connection.' },
        sendMessage(_id, _message, callback) {
          callback?.(undefined);
        },
      },
    });
    expect(result).toMatchObject({ type: 'ERROR', code: 'NOT_INSTALLED' });
  });
});
