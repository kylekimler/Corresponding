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

/**
 * Target: Google Picker + chrome.identity + drive.file.
 * Scientists never paste API keys or OAuth client IDs.
 */
export interface PickedSpreadsheet {
  spreadsheetId: string;
  name: string;
  url?: string;
}

export interface GoogleSheetsClient {
  /** Parse a developer/test URL (not the primary product UX). */
  parseUrl(url: string): SheetRef;
  /** List tabs/sheets in the spreadsheet (requires auth). */
  listTabs(spreadsheetId: string): Promise<SheetTab[]>;
  /** Read values from a tab as a rectangular table. */
  readTable(spreadsheetId: string, tab: SheetTab | string): Promise<SheetTable>;
  /**
   * Whether developer OAuth credentials are configured for this build.
   * Must never surface as a user-facing error on the main screen.
   */
  isConfigured(): boolean;
  /**
   * Product path: open Google Picker and return the user-selected file.
   * Optional until Picker + chrome.identity are wired.
   */
  pickSpreadsheet?(): Promise<PickedSpreadsheet>;
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

/** Scientist-facing availability — never mentions credentials. */
export function sheetsChooserAvailability(configured: boolean): {
  enabled: boolean;
  label: string;
  hint: string;
} {
  if (configured) {
    return {
      enabled: true,
      label: 'Choose Google Sheet',
      hint: 'Sign in with Google and pick a spreadsheet.',
    };
  }
  return {
    enabled: false,
    label: 'Choose Google Sheet',
    hint: 'Coming soon — use Paste or Upload CSV for now.',
  };
}
