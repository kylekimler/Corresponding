import { describe, expect, it } from 'vitest';
import {
  AUTOFILL_CONTENT_SCRIPT_MATCHES,
  isAllowedManifestContentScriptMatch,
  isContextualAutofillHostMatch,
} from '@/autofill/hosts';
import { isFirstPartyWebsiteMatch } from '@/messaging/websiteHandshake';

describe('contextual autofill host allowlist', () => {
  it('includes known fillable submission hosts and local fixtures only', () => {
    expect(AUTOFILL_CONTENT_SCRIPT_MATCHES).toEqual([
      'https://*.editorialmanager.com/*',
      'https://*.manuscriptcentral.com/*',
      'https://*.scholarone.com/*',
      'https://submit.biorxiv.org/*',
      'https://submit.medrxiv.org/*',
      'http://localhost:3000/fixtures/*',
      'http://127.0.0.1:3000/fixtures/*',
    ]);
    expect(isContextualAutofillHostMatch('<all_urls>')).toBe(false);
    expect(isContextualAutofillHostMatch('https://*.example.com/*')).toBe(false);
  });

  it('does not treat journal matches as first-party website matches', () => {
    expect(
      isFirstPartyWebsiteMatch('https://*.editorialmanager.com/*'),
    ).toBe(false);
    expect(
      isAllowedManifestContentScriptMatch('https://*.editorialmanager.com/*'),
    ).toBe(true);
    expect(isAllowedManifestContentScriptMatch('https://corresponding.app/*')).toBe(
      true,
    );
    expect(isAllowedManifestContentScriptMatch('<all_urls>')).toBe(false);
  });
});
