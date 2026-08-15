import { describe, expect, it } from 'vitest';
import { defaultRegistry } from '@/adapters/registry';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import {
  formatDiagnosticReport,
  probeForm,
} from '@/diagnostics/formProbe';
import { createMockGoogleSheetsClient } from '@/sheets/mockClient';
import { parseGoogleSheetUrl } from '@/sheets/types';
import { createChromeGoogleSheetsClient } from '@/sheets/chromeClient';
import { FREE_ACCESS, getAccess } from '@/entitlements/types';

describe('adapter registry', () => {
  it('detects nature-mts from fixture', () => {
    mountNatureMtsFixture({ slots: 1 });
    expect(defaultRegistry.detect(document).platformId).toBe('nature-mts');
  });

  it('returns unknown for empty page', () => {
    document.body.innerHTML = '<div>hello</div>';
    expect(defaultRegistry.detect(document).platformId).toBe('unknown');
  });

  it('lists stub adapters without implementing selectors', () => {
    const ids = defaultRegistry.list().map((a) => a.id);
    expect(ids).toContain('scholarone');
    expect(ids).toContain('editorial-manager');
    expect(ids).toContain('ejournalpress-generic');
  });
});

describe('diagnostics', () => {
  it('redacts values and omits password values', () => {
    document.body.innerHTML = `
      <label for="contrib_auth_1_email">Email</label>
      <input id="contrib_auth_1_email" type="text" value="secret@example.org" />
      <input id="password" name="password" type="password" value="hunter2" />
      <button id="final_submit">Final Submit</button>
    `;
    const report = probeForm(document);
    const email = report.fields.find((f) => f.idPattern === 'contrib_auth_#_email');
    const pwd = report.fields.find((f) => f.id === 'password');
    expect(email?.redacted).toBe(true);
    expect(email?.value).toBeUndefined();
    expect(email?.category).toBe('email');
    expect(pwd?.category).toBe('auth_secret');
    expect(pwd?.value).toBeUndefined();
    const text = formatDiagnosticReport(report);
    expect(text).toContain('redactionComplete: true');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('secret@example.org');
  });
});

describe('google sheets abstraction', () => {
  it('parses sheet URLs', () => {
    const ref = parseGoogleSheetUrl(
      'https://docs.google.com/spreadsheets/d/abc123XYZ/edit#gid=42',
    );
    expect(ref.spreadsheetId).toBe('abc123XYZ');
    expect(ref.gid).toBe('42');
  });

  it('reads via mock client', async () => {
    const client = createMockGoogleSheetsClient([
      {
        spreadsheetId: 'abc123XYZ',
        tabs: [
          {
            sheetId: 42,
            title: 'Authors',
            headers: ['First Name', 'Last Name', 'Email'],
            rows: [['Ada', 'Lovelace', 'ada@example.org']],
          },
        ],
      },
    ]);
    const tabs = await client.listTabs('abc123XYZ');
    expect(tabs[0]?.title).toBe('Authors');
    const table = await client.readTable('abc123XYZ', 'Authors');
    expect(table.rows[0]?.[0]).toBe('Ada');
  });

  it('chrome client reports unconfigured without fake credentials', () => {
    const client = createChromeGoogleSheetsClient('');
    expect(client.isConfigured()).toBe(false);
  });
});

describe('radically free access', () => {
  it('never gates fill behind an account, trial, or author cap', () => {
    const access = getAccess();
    expect(access).toEqual(FREE_ACCESS);
    expect(access.license).toBe('MIT');
    expect(access.accountRequired).toBe(false);
    expect(access.trialRequired).toBe(false);
    expect(access.paidPlanRequired).toBe(false);
    expect(access.authorLimit).toBeNull();
    expect(access.canFill).toBe(true);
    expect(access.canImport).toBe(true);
  });
});
