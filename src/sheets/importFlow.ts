import { suggestColumnMapping, mappingIsComplete } from '@/import/columnMap';
import { rowsToRoster } from '@/import/rosterFromTable';
import type { Roster } from '@/schema/author';
import type { ColumnMapping } from '@/import/columnMap';
import type { GoogleSheetsClient, SheetTab } from './types';
import { SheetsNotConfiguredError } from './types';

export interface SheetsImportPreview {
  spreadsheetId: string;
  tabs: SheetTab[];
  selectedTab: SheetTab;
  headers: string[];
  rows: string[][];
  mapping: ColumnMapping;
}

export async function loadSheetPreview(
  client: GoogleSheetsClient,
  url: string,
  tabTitle?: string,
): Promise<SheetsImportPreview> {
  if (!client.isConfigured()) {
    throw new SheetsNotConfiguredError();
  }
  const ref = client.parseUrl(url);
  const tabs = await client.listTabs(ref.spreadsheetId);
  if (tabs.length === 0) throw new Error('Spreadsheet has no tabs');

  let selected =
    (tabTitle ? tabs.find((t) => t.title === tabTitle) : undefined) ??
    (ref.gid
      ? tabs.find((t) => String(t.sheetId) === ref.gid)
      : undefined) ??
    tabs[0]!;

  const table = await client.readTable(ref.spreadsheetId, selected);
  const mapping = suggestColumnMapping(table.headers);
  return {
    spreadsheetId: ref.spreadsheetId,
    tabs,
    selectedTab: selected,
    headers: table.headers,
    rows: table.rows,
    mapping,
  };
}

export function rosterFromSheetPreview(
  preview: SheetsImportPreview,
  name: string,
  mappingOverride?: Record<number, import('@/import/columnMap').CanonicalColumn>,
): Roster {
  const map = mappingOverride ?? preview.mapping.map;
  if (!mappingIsComplete(map)) {
    throw new Error('Map at least given name and family name before import');
  }
  return rowsToRoster({
    name,
    headers: preview.headers,
    rows: preview.rows,
    mapping: map,
    source: 'google_sheets',
  });
}
