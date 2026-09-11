import { isFirstPartyWebsiteMatch } from '@/messaging/websiteHandshake';

/**
 * Manifest matches for contextual autofill. These are known submission-host
 * families already backed by fill adapters, plus local fixtures.
 * Not host permissions and not a second fill engine.
 */

export const AUTOFILL_CONTENT_SCRIPT_MATCHES = [
  'https://*.editorialmanager.com/*',
  'https://*.manuscriptcentral.com/*',
  'https://*.scholarone.com/*',
  'https://submit.biorxiv.org/*',
  'https://submit.medrxiv.org/*',
  'http://localhost:3000/fixtures/*',
  'http://127.0.0.1:3000/fixtures/*',
] as const;

export function isContextualAutofillHostMatch(match: string): boolean {
  return (AUTOFILL_CONTENT_SCRIPT_MATCHES as readonly string[]).includes(match);
}

export function isAllowedManifestContentScriptMatch(match: string): boolean {
  return isFirstPartyWebsiteMatch(match) || isContextualAutofillHostMatch(match);
}
