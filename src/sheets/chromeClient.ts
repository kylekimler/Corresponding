import {
  parseGoogleSheetUrl,
  SheetsNotConfiguredError,
  type GoogleSheetsClient,
  type SheetTab,
  type SheetTable,
} from './types';

/**
 * Production-shaped Chrome Identity + Sheets API client.
 * Requires `VITE_GOOGLE_OAUTH_CLIENT_ID` (or equivalent) at build time.
 * Does NOT ship fake credentials. Throws SheetsNotConfiguredError when missing.
 *
 * Scope: https://www.googleapis.com/auth/spreadsheets.readonly
 */
export function createChromeGoogleSheetsClient(
  clientId: string | undefined = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as
    | string
    | undefined,
): GoogleSheetsClient {
  const configured = Boolean(clientId && clientId.trim());

  async function getToken(): Promise<string> {
    if (!configured) throw new SheetsNotConfiguredError();
    // chrome.identity.getAuthToken requires the oauth2 section in the manifest.
    // Kept behind isConfigured() so builds without credentials still typecheck.
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.identity?.getAuthToken) {
        reject(new SheetsNotConfiguredError('chrome.identity unavailable'));
        return;
      }
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError || !token) {
          reject(
            new Error(
              chrome.runtime.lastError?.message ?? 'Failed to obtain OAuth token',
            ),
          );
          return;
        }
        resolve(token);
      });
    });
  }

  async function sheetsFetch(path: string): Promise<unknown> {
    const token = await getToken();
    const res = await fetch(`https://sheets.googleapis.com/v4/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // Do not attach response bodies — they may include tokens or cell PII.
      void (await res.text().catch(() => ''));
      throw new Error(`Sheets API ${res.status}`);
    }
    return res.json();
  }

  return {
    parseUrl: parseGoogleSheetUrl,
    isConfigured: () => configured,
    async listTabs(spreadsheetId: string): Promise<SheetTab[]> {
      const data = (await sheetsFetch(
        `spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(sheetId,title,index))`,
      )) as {
        sheets?: Array<{
          properties: { sheetId: number; title: string; index: number };
        }>;
      };
      return (data.sheets ?? []).map((s) => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title,
        index: s.properties.index,
      }));
    },
    async readTable(
      spreadsheetId: string,
      tab: SheetTab | string,
    ): Promise<SheetTable> {
      const title = typeof tab === 'string' ? tab : tab.title;
      const data = (await sheetsFetch(
        `spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(title)}`,
      )) as { values?: string[][] };
      const values = data.values ?? [];
      const headers = (values[0] ?? []).map((h) => String(h));
      const rows = values.slice(1).map((r) => r.map((c) => String(c ?? '')));
      const tabMeta: SheetTab =
        typeof tab === 'string'
          ? { sheetId: 0, title, index: 0 }
          : tab;
      return { spreadsheetId, tab: tabMeta, headers, rows };
    },
  };
}
