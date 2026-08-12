import { describe, expect, it } from 'vitest';
import { createMockGoogleSheetsClient } from '@/sheets/mockClient';
import {
  loadSheetPreview,
  rosterFromSheetPreview,
} from '@/sheets/importFlow';
import { SheetsNotConfiguredError } from '@/sheets/types';

describe('sheets import flow', () => {
  const client = createMockGoogleSheetsClient([
    {
      spreadsheetId: 'sheet1',
      tabs: [
        {
          sheetId: 0,
          title: 'Authors',
          headers: ['First Name', 'Last Name', 'Email', 'Institution'],
          rows: [
            ['Ada', 'Lovelace', 'ada@example.org', 'AE'],
            ['Alan', 'Turing', 'alan@example.org', 'GC&CS'],
          ],
        },
        {
          sheetId: 1,
          title: 'Other',
          headers: ['a'],
          rows: [['x']],
        },
      ],
    },
  ]);

  it('loads preview and builds roster', async () => {
    const preview = await loadSheetPreview(
      client,
      'https://docs.google.com/spreadsheets/d/sheet1/edit#gid=0',
    );
    expect(preview.selectedTab.title).toBe('Authors');
    expect(preview.mapping.requiresConfirmation).toBe(false);
    const roster = rosterFromSheetPreview(preview, 'From Sheets');
    expect(roster.source).toBe('google_sheets');
    expect(roster.authors).toHaveLength(2);
    expect(roster.authors[0]?.familyName).toBe('Lovelace');
  });

  it('selects tab by title', async () => {
    const preview = await loadSheetPreview(
      client,
      'https://docs.google.com/spreadsheets/d/sheet1/edit',
      'Other',
    );
    expect(preview.selectedTab.title).toBe('Other');
  });

  it('throws when unconfigured', async () => {
    const unconfigured = createMockGoogleSheetsClient([], { configured: false });
    await expect(
      loadSheetPreview(
        unconfigured,
        'https://docs.google.com/spreadsheets/d/sheet1/edit',
      ),
    ).rejects.toBeInstanceOf(SheetsNotConfiguredError);
  });
});
