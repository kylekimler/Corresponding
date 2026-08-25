import { describe, expect, it } from 'vitest';
import { makeNAuthors, makeRoster } from '../helpers/roster';
import {
  pingExtension,
  saveRosterToExtension,
  sendToExtension,
} from '../../web/src/bridge/client';

describe('website-to-extension client', () => {
  it('reports a missing extension id without sending', async () => {
    const result = await sendToExtension(
      { type: 'PING' },
      { extensionId: '', runtime: { sendMessage: () => undefined } },
    );
    expect(result).toMatchObject({ type: 'ERROR', code: 'NO_ID' });
  });

  it('reports an unavailable chrome.runtime as not installed', async () => {
    const result = await pingExtension({
      extensionId: 'abcdefghijklmnopqrstuvwxyzabcdef',
      runtime: undefined,
    });
    expect(result).toMatchObject({ type: 'ERROR', code: 'NOT_INSTALLED' });
  });

  it('forwards a validated reply from the extension', async () => {
    const roster = makeRoster(makeNAuthors(2), 'Atlas');
    const result = await saveRosterToExtension(roster, {
      extensionId: 'abcdefghijklmnopqrstuvwxyzabcdef',
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
      extensionId: 'abcdefghijklmnopqrstuvwxyzabcdef',
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
