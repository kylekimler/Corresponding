import {
  parseGoogleSheetUrl,
  SheetsNotConfiguredError,
  type GoogleSheetsClient,
  type SheetTab,
  type SheetTable,
} from './types';

export interface MockSheetWorkbook {
  spreadsheetId: string;
  tabs: Array<{
    sheetId: number;
    title: string;
    headers: string[];
    rows: string[][];
  }>;
}

export function createMockGoogleSheetsClient(
  workbooks: MockSheetWorkbook[],
  options: { configured?: boolean } = {},
): GoogleSheetsClient {
  const configured = options.configured ?? true;
  const byId = new Map(workbooks.map((w) => [w.spreadsheetId, w]));

  return {
    parseUrl: parseGoogleSheetUrl,
    isConfigured: () => configured,
    async listTabs(spreadsheetId: string): Promise<SheetTab[]> {
      if (!configured) throw new SheetsNotConfiguredError();
      const wb = byId.get(spreadsheetId);
      if (!wb) throw new Error(`Unknown spreadsheet: ${spreadsheetId}`);
      return wb.tabs.map((t, index) => ({
        sheetId: t.sheetId,
        title: t.title,
        index,
      }));
    },
    async readTable(
      spreadsheetId: string,
      tab: SheetTab | string,
    ): Promise<SheetTable> {
      if (!configured) throw new SheetsNotConfiguredError();
      const wb = byId.get(spreadsheetId);
      if (!wb) throw new Error(`Unknown spreadsheet: ${spreadsheetId}`);
      const title = typeof tab === 'string' ? tab : tab.title;
      const found = wb.tabs.find((t) => t.title === title);
      if (!found) throw new Error(`Unknown tab: ${title}`);
      return {
        spreadsheetId,
        tab: {
          sheetId: found.sheetId,
          title: found.title,
          index: wb.tabs.indexOf(found),
        },
        headers: found.headers,
        rows: found.rows,
      };
    },
  };
}
