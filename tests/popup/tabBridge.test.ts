import { describe, expect, it } from 'vitest';
import {
  isInjectableTabUrl,
  normalizeTabResponse,
} from '@/entrypoints/popup/tabBridge';

describe('normalizeTabResponse', () => {
  it('returns typed responses unchanged', () => {
    const ok = { type: 'DETECT_RESULT' as const, result: { platformId: 'unknown' } };
    expect(normalizeTabResponse(ok)).toEqual(ok);
  });

  it('converts undefined/null into ERROR (prevents popup crash on .type)', () => {
    const fromUndefined = normalizeTabResponse(undefined);
    expect(fromUndefined.type).toBe('ERROR');
    expect(fromUndefined.type === 'ERROR' && fromUndefined.message).toMatch(
      /content script/i,
    );

    const fromNull = normalizeTabResponse(null);
    expect(fromNull.type).toBe('ERROR');
  });

  it('rejects objects without a type field', () => {
    expect(normalizeTabResponse({ filled: 1 }).type).toBe('ERROR');
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
