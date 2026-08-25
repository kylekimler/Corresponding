export const WEBSITE_HANDSHAKE_SOURCE = 'corresponding-extension';
export const WEBSITE_HANDSHAKE_REQUEST = 'corresponding-web';

export const WEBSITE_CONTENT_SCRIPT_MATCHES = [
  'https://corresponding.app/*',
  'http://localhost:5173/*',
  'http://localhost:4173/*',
  'http://127.0.0.1:5173/*',
  'http://127.0.0.1:4173/*',
] as const;

export type WebsiteHandshakeReady = {
  source: typeof WEBSITE_HANDSHAKE_SOURCE;
  type: 'READY';
  extensionId: string;
};

export type WebsiteHandshakeRequest = {
  source: typeof WEBSITE_HANDSHAKE_REQUEST;
  type: 'REQUEST_ID';
};

const EXTENSION_ID_RE = /^[a-p]{32}$/;

export function isWebsiteHandshakeReady(
  data: unknown,
): data is WebsiteHandshakeReady {
  if (!data || typeof data !== 'object') return false;
  const value = data as Partial<WebsiteHandshakeReady>;
  return (
    value.source === WEBSITE_HANDSHAKE_SOURCE &&
    value.type === 'READY' &&
    typeof value.extensionId === 'string' &&
    EXTENSION_ID_RE.test(value.extensionId)
  );
}

export function isWebsiteHandshakeRequest(
  data: unknown,
): data is WebsiteHandshakeRequest {
  if (!data || typeof data !== 'object') return false;
  const value = data as Partial<WebsiteHandshakeRequest>;
  return (
    value.source === WEBSITE_HANDSHAKE_REQUEST && value.type === 'REQUEST_ID'
  );
}

export function createWebsiteHandshakeReady(
  extensionId: string,
): WebsiteHandshakeReady {
  return {
    source: WEBSITE_HANDSHAKE_SOURCE,
    type: 'READY',
    extensionId,
  };
}

export function createWebsiteHandshakeRequest(): WebsiteHandshakeRequest {
  return {
    source: WEBSITE_HANDSHAKE_REQUEST,
    type: 'REQUEST_ID',
  };
}

export function isFirstPartyWebsiteMatch(match: string): boolean {
  return (WEBSITE_CONTENT_SCRIPT_MATCHES as readonly string[]).includes(match);
}
