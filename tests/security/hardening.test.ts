import { describe, expect, it } from 'vitest';
import { identitiesConflict, matchSelectOption, setValue } from '@/adapters/dom';
import { isForbiddenControl, normalizeControlText } from '@/adapters/safety';
import { natureMtsAdapter } from '@/adapters/nature-mts/adapter';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { captureForm, previewCapture } from '@/diagnostics/capture';
import { neutralizeCsvFormula, toCsv } from '@/import/csv';
import { parseExtensionRequest } from '@/messaging/validate';
import {
  createMemoryRosterStore,
  migrateRosterSafe,
} from '@/roster/storage';
import { sanitizeSheetsError } from '@/sheets/errors';
import { makeAuthor, makeNAuthors, makeRoster } from '../helpers/roster';

describe('security hardening', () => {
  it('quarantines invalid stored rosters instead of wiping to empty', async () => {
    const wiped = migrateRosterSafe({
      id: 'bad',
      name: 'Broken',
      authors: 'not-an-array',
      schemaVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      source: 'manual',
    });
    expect(wiped.quarantined).toBe(true);
    expect(wiped.roster).toBeNull();

    const salvaged = migrateRosterSafe({
      id: 'partial',
      name: 'Partial',
      authors: [
        {
          id: 'a1',
          givenName: 'Ada',
          familyName: 'Lovelace',
          sequence: 1,
          isCorresponding: true,
          affiliations: [],
        },
        { id: 'broken' },
      ],
      schemaVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      source: 'manual',
    });
    expect(salvaged.quarantined).toBe(false);
    expect(salvaged.roster?.authors).toHaveLength(1);
    expect(salvaged.reason).toMatch(/Salvaged 1\/2/);

    // Durable quarantine: bad blobs survive a later save of an unrelated roster.
    const { createRosterStore } = await import('@/roster/storage');
    const durable = createRosterStore({
      rosters: [
        {
          id: 'bad',
          name: 'Broken',
          authors: 'not-an-array',
          schemaVersion: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          source: 'manual',
        },
      ] as never,
    });
    expect(await durable.list()).toHaveLength(0);
    expect(await durable.listQuarantined()).toHaveLength(1);
    await durable.save(makeRoster(makeNAuthors(1), 'KeepMe'));
    expect(await durable.listQuarantined()).toHaveLength(1);
    expect((await durable.listQuarantined())[0]?.id).toBe('bad');
  });

  it('refuses to save invalid rosters', async () => {
    const store = createMemoryRosterStore();
    await expect(
      store.save({
        id: 'x',
        name: '',
        authors: [],
        schemaVersion: 1,
        createdAt: 'nope',
        updatedAt: 'nope',
        source: 'manual',
      } as never),
    ).rejects.toThrow(/Refusing to save invalid roster/);
  });

  it('treats linked PID + portal email + empty roster email as conflict', () => {
    expect(
      identitiesConflict(
        { email: 'portal@example.org', familyName: 'Linked', givenName: 'Portal' },
        { email: '', familyName: 'Linked', givenName: 'Portal' },
        { linkedPid: true },
      ),
    ).toBe(true);
  });

  it('skips corresponding block when linked contrib slot conflicts', () => {
    mountNatureMtsFixture({
      slots: 1,
      authors: [
        {
          first: 'Portal',
          last: 'Linked',
          email: 'portal@example.org',
          linkedPid: 'PID-999',
        },
      ],
    });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Roster',
        familyName: 'Person',
        email: 'roster@example.org',
        sequence: 1,
        isCorresponding: true,
      }),
    ]);
    const report = natureMtsAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(report.skippedConflicts).toBeGreaterThan(0);
    expect(
      (document.getElementById('corr_auth_first_nm') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement)
        .value,
    ).toBe('Portal');
  });

  it('detects snake_case final_submit as forbidden', () => {
    expect(normalizeControlText('final_submit')).toBe('final submit');
    document.body.innerHTML =
      '<button id="final_submit" type="submit">Go</button>';
    const el = document.getElementById('final_submit')!;
    expect(isForbiddenControl(el)).toBe(true);
  });

  it('does not match short country substrings greedily', () => {
    document.body.innerHTML = `
      <select id="country">
        <option value="">Select</option>
        <option value="IN">India</option>
        <option value="US">United States</option>
        <option value="JP">Japan</option>
      </select>
    `;
    const select = document.getElementById('country') as HTMLSelectElement;
    expect(matchSelectOption(select, 'a')).toBeNull();
    expect(matchSelectOption(select, 'Jap')).toBe('JP');
  });

  it('skips disabled fields', () => {
    document.body.innerHTML =
      '<input id="locked" value="" disabled />';
    expect(
      setValue(document, 'locked', 'x', { overwrite: true, dryRun: false }),
    ).toBe('skipped_disabled');
    expect(
      (document.getElementById('locked') as HTMLInputElement).value,
    ).toBe('');
  });

  it('redacts label/option/hash PII from diagnostics', () => {
    document.title = 'Portal | Secret Manuscript Name XYZ';
    document.body.innerHTML = `
      <label for="em">Contact ada@leak.edu for Ada Lovelace</label>
      <input id="em" name="email" value="ignored@example.org" />
      <select id="country">
        <option>United States</option>
        <option>Contact ada@leak.edu</option>
      </select>
    `;
    const capture = captureForm(document, {
      url: 'https://user:pass@journal.example.org/submit#token=abc123&session=xyz',
    });
    const text = previewCapture(capture);
    expect(text).not.toContain('ada@leak.edu');
    expect(text).not.toContain('Ada Lovelace');
    expect(text).not.toContain('#token=abc123');
    expect(text).not.toContain('user:pass');
    expect(capture.urlPattern).not.toContain('#');
    expect(capture.redactionComplete).toBe(true);
  });

  it('escapes CSV formula injection on export', () => {
    expect(neutralizeCsvFormula('=cmd|\'/c calc\'!A0')).toBe(
      "'=cmd|'/c calc'!A0",
    );
    const csv = toCsv(['name'], [['=1+1'], ['+hijack'], ['@sum']]);
    expect(csv).toContain("\"'=1+1\"");
    expect(csv).toContain("\"'+hijack\"");
    expect(csv).toContain("\"'@sum\"");
  });

  it('rejects malformed extension fill messages', () => {
    const bad = parseExtensionRequest({
      type: 'FILL',
      overwrite: true,
      roster: { authors: [] },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/Invalid extension message/);

    const good = parseExtensionRequest({ type: 'PING' });
    expect(good.ok).toBe(true);
  });

  it('sanitizes Sheets API error bodies', () => {
    expect(sanitizeSheetsError(new Error('Sheets API 403: {"error":{"message":"ya29.secret"}}'))).toBe(
      'Access denied to this spreadsheet',
    );
    expect(
      sanitizeSheetsError(new Error('Sheets API 500: ton of cell data ada@example.org')),
    ).toBe('Sheets API temporary error');
  });

  it('fills matching linked author when identities agree', () => {
    mountNatureMtsFixture({
      slots: 1,
      authors: [
        {
          first: 'Given1',
          last: 'Family1',
          email: 'author1@example.org',
          linkedPid: 'PID-1',
        },
      ],
    });
    const roster = makeRoster(makeNAuthors(1));
    const report = natureMtsAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(report.skippedConflicts).toBe(0);
    expect(
      (document.getElementById('contrib_auth_1_org') as HTMLInputElement).value
        .length,
    ).toBeGreaterThan(0);
  });

  it('refuses overwrite of linked PID with blank portal identity fields', () => {
    mountNatureMtsFixture({
      slots: 1,
      authors: [{ linkedPid: 'PID-BLANK' }],
    });
    const roster = makeRoster(makeNAuthors(1));
    const report = natureMtsAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(report.skippedConflicts).toBeGreaterThan(0);
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement)
        .value,
    ).toBe('');
  });

  it('inspect does not return raw field values', () => {
    mountNatureMtsFixture({
      slots: 1,
      authors: [
        {
          first: 'Secret',
          last: 'Name',
          email: 'secret@example.org',
          linkedPid: 'PID-1',
        },
      ],
    });
    const report = natureMtsAdapter.inspect(document);
    expect(report.fields.every((f) => !f.value)).toBe(true);
    expect(JSON.stringify(report)).not.toContain('secret@example.org');
  });
});
