/**
 * Sanitize Sheets / OAuth error text before showing it in the UI.
 * Never surface raw API response bodies (may contain tokens or sheet cell data).
 */

const SAFE_STATUS: Record<number, string> = {
  400: 'Invalid spreadsheet request',
  401: 'Google authorization required or expired',
  403: 'Access denied to this spreadsheet',
  404: 'Spreadsheet not found',
  429: 'Sheets API rate limit exceeded — try again shortly',
  500: 'Sheets API temporary error',
  503: 'Sheets API unavailable',
};

export function sanitizeSheetsError(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = String((err as { name: unknown }).name);
    if (name === 'SheetsNotConfiguredError') {
      return err instanceof Error
        ? err.message
        : 'Google Sheets OAuth is not configured for this build';
    }
  }

  const message = err instanceof Error ? err.message : String(err);

  const statusMatch = message.match(/Sheets API (\d{3})/i);
  if (statusMatch) {
    const code = Number.parseInt(statusMatch[1]!, 10);
    return SAFE_STATUS[code] ?? `Sheets API error (${code})`;
  }

  if (/oauth|auth|token|identity/i.test(message) && message.length < 160) {
    // Keep short auth guidance; strip anything that looks like a token blob.
    if (/[A-Za-z0-9_-]{20,}/.test(message) && /ya29\.|1\/\/|Bearer/i.test(message)) {
      return 'Google authorization failed';
    }
    return message;
  }

  if (message.length > 180 || /[{[]/.test(message)) {
    return 'Sheets request failed';
  }

  return message || 'Sheets request failed';
}
