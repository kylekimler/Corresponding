/** Read-only Google Sheets import abstraction. No write APIs. */

export interface SheetRef {
  spreadsheetId: string;
  /** Optional gid from URL */
  gid?: string;
  url: string;
}

export interface SheetTab {
  sheetId: number;
  title: string;
  index: number;
}

export interface SheetTable {
  spreadsheetId: string;
  tab: SheetTab;
  headers: string[];
  rows: string[][];
}

export interface GoogleSheetsClient {
  /** Parse a user-pasted Google Sheets URL. */
  parseUrl(url: string): SheetRef;
  /** List tabs/sheets in the spreadsheet (requires auth). */
  listTabs(spreadsheetId: string): Promise<SheetTab[]>;
  /** Read values from a tab as a rectangular table. */
  readTable(spreadsheetId: string, tab: SheetTab | string): Promise<SheetTable>;
  /** Whether production OAuth credentials are configured. */
  isConfigured(): boolean;
}

export class SheetsNotConfiguredError extends Error {
  constructor(message = 'Google Sheets OAuth client ID is not configured') {
    super(message);
    this.name = 'SheetsNotConfiguredError';
  }
}

export function parseGoogleSheetUrl(url: string): SheetRef {
  const trimmed = url.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new Error('Unrecognized Google Sheet URL');
  }
  const gidMatch = trimmed.match(/[?#&]gid=([0-9]+)/);
  return {
    spreadsheetId: idMatch[1]!,
    gid: gidMatch?.[1],
    url: trimmed,
  };
}
