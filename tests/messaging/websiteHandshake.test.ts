import { describe, expect, it } from 'vitest';
import {
  createWebsiteHandshakeReady,
  isFirstPartyWebsiteMatch,
  isWebsiteHandshakeReady,
  isWebsiteHandshakeRequest,
  WEBSITE_CONTENT_SCRIPT_MATCHES,
} from '@/messaging/websiteHandshake';

describe('website handshake', () => {
  it('accepts a well-formed extension announcement', () => {
    const ready = createWebsiteHandshakeReady('abcdefghijklmnopabcdefghijklmnop');
    expect(isWebsiteHandshakeReady(ready)).toBe(true);
  });

  it('rejects messages from other pages or malformed ids', () => {
    expect(isWebsiteHandshakeReady(null)).toBe(false);
    expect(
      isWebsiteHandshakeReady({
        source: 'corresponding-extension',
        type: 'READY',
        extensionId: 'not-an-id',
      }),
    ).toBe(false);
    expect(
      isWebsiteHandshakeReady({
        source: 'evil',
        type: 'READY',
        extensionId: 'abcdefghijklmnopabcdefghijklmnop',
      }),
    ).toBe(false);
    expect(isWebsiteHandshakeRequest({ type: 'REQUEST_ID' })).toBe(false);
  });

  it('only allows first-party website matches', () => {
    expect(
      WEBSITE_CONTENT_SCRIPT_MATCHES.every(isFirstPartyWebsiteMatch),
    ).toBe(true);
    expect(isFirstPartyWebsiteMatch('https://evil.example/*')).toBe(false);
    expect(isFirstPartyWebsiteMatch('https://*.editorialmanager.com/*')).toBe(
      false,
    );
  });
});
