import { describe, expect, it } from 'vitest';
import { parsePastedTable, parseTsv, pasteLooksTabular } from '@/import/pasteTable';
import { suggestColumnMapping, mappingIsComplete } from '@/import/columnMap';
import { rowsToRoster } from '@/import/rosterFromTable';

describe('paste from spreadsheet', () => {
  it('parses tab-separated Sheets/Excel paste with headers', () => {
    const text = [
      'First name\tMiddle name\tLast name\tEmail\tORCID\tAffiliation 1\tCity\tCountry\tCorresponding',
      'Ada\t\tLovelace\tada@example.org\t0000-0002-1825-0097\tAnalytical Engine\tLondon\tUnited Kingdom\tyes',
      'Alan\tM\tTuring\talan@example.org\t\tBletchley Park\tMilton Keynes\tUnited Kingdom\t',
    ].join('\n');

    const parsed = parsePastedTable(text);
    expect(parsed.delimiter).toBe('tab');
    expect(parsed.rowCount).toBe(2);
    expect(parsed.headers[0]).toBe('First name');
    expect(parsed.rows[0]?.[3]).toBe('ada@example.org');
    expect(parsed.rows[1]?.[1]).toBe('M');

    const mapping = suggestColumnMapping(parsed.headers);
    expect(mappingIsComplete(mapping.map)).toBe(true);
    expect(mapping.requiresConfirmation).toBe(false);

    const roster = rowsToRoster({
      name: 'Paste',
      headers: parsed.headers,
      rows: parsed.rows,
      mapping: mapping.map,
      source: 'csv',
    });
    expect(roster.authors).toHaveLength(2);
    expect(roster.authors[0]?.isCorresponding).toBe(true);
    expect(roster.authors[0]?.affiliations[0]?.institution).toBe(
      'Analytical Engine',
    );
  });

  it('handles quoted tabs, Unicode, blank cells, CRLF', () => {
    const text =
      'First name\tLast name\tInstitution\r\n"田中\tJr"\tMüller\t"Tokyo, Lab"\r\nAda\tLovelace\t\r\n';
    const parsed = parseTsv(text);
    expect(parsed.rows[0]?.[0]).toBe('田中\tJr');
    expect(parsed.rows[0]?.[1]).toBe('Müller');
    expect(parsed.rows[0]?.[2]).toBe('Tokyo, Lab');
    expect(parsed.rows[1]?.[2]).toBe('');
  });

  it('falls back to CSV when no tabs', () => {
    const text = 'First Name,Last Name,Email\nAda,Lovelace,ada@example.org\n';
    const parsed = parsePastedTable(text);
    expect(parsed.delimiter).toBe('comma');
    expect(parsed.rowCount).toBe(1);
  });

  it('never silently accepts ambiguous headers', () => {
    const text = 'Name\tContact\tPlace\nAda\tx\ty\n';
    const parsed = parsePastedTable(text);
    const mapping = suggestColumnMapping(parsed.headers);
    expect(mapping.requiresConfirmation).toBe(true);
    expect(mappingIsComplete(mapping.map)).toBe(false);
    expect(Object.values(mapping.map)).toEqual(['ignore', 'ignore', 'ignore']);
  });

  it('defaults unrelated workbook columns to Ignore and remains importable', () => {
    const headers = [
      'Order',
      'Author type',
      'Given name',
      'Family name',
      'Name on paper',
      'ORCID',
      'Email (portal)',
      'Affiliation numbers',
      'Affiliation 1',
      'Affiliation 2',
      'Affiliation 3',
      'Affiliation 4',
      'Affiliation 5',
      'Equal contribution',
      'Joint supervision',
      'Portal status',
      'Notes',
    ];

    const mapping = suggestColumnMapping(headers);

    expect(mapping.map).toEqual({
      0: 'sequence',
      1: 'ignore',
      2: 'givenName',
      3: 'familyName',
      4: 'ignore',
      5: 'orcid',
      6: 'email',
      7: 'ignore',
      8: 'institution',
      9: 'ignore',
      10: 'ignore',
      11: 'ignore',
      12: 'ignore',
      13: 'equalContribution',
      14: 'ignore',
      15: 'ignore',
      16: 'ignore',
    });
    expect(mappingIsComplete(mapping.map)).toBe(true);
    expect(Object.keys(mapping.map)).toHaveLength(headers.length);
  });

  it('preserves a leading blank header column without shifting author data', () => {
    const parsed = parsePastedTable(
      [
        '\tFirst name\tLast Name\tName on paper\tORCID',
        '*\tKyle\tKimler\tKyle Kimler\t0000-0002-1825-0097',
        '*\tChristopher\tLance\tChristopher Lance\t',
      ].join('\n'),
    );

    expect(parsed.headers).toEqual([
      '',
      'First name',
      'Last Name',
      'Name on paper',
      'ORCID',
    ]);
    expect(parsed.rows[0]).toEqual([
      '*',
      'Kyle',
      'Kimler',
      'Kyle Kimler',
      '0000-0002-1825-0097',
    ]);
    const mapping = suggestColumnMapping(parsed.headers);
    expect(mapping.map[0]).toBe('ignore');
    expect(mapping.map[1]).toBe('givenName');
    expect(mapping.map[2]).toBe('familyName');
    expect(mapping.map[3]).toBe('ignore');
    expect(mapping.map[4]).toBe('orcid');
    expect(mappingIsComplete(mapping.map)).toBe(true);
  });

  it('imports project funding and disclosure statements separately', () => {
    const text = [
      'First name\tLast Name\tAffiliation 1\tSupport/ Funding Statement\tConflicts of Interest',
      'Ada\tLovelace\tAnalytical Engines\tSupported by Grant A\tNo competing interests',
      'Alan\tTuring\tBletchley Park\tSupported by Grant A\tNo competing interests',
    ].join('\n');
    const parsed = parsePastedTable(text);
    const mapping = suggestColumnMapping(parsed.headers);

    expect(mapping.map[3]).toBe('fundingStatement');
    expect(mapping.map[4]).toBe('disclosureStatement');
    expect(Object.values(mapping.map)).not.toContain('state');

    const roster = rowsToRoster({
      name: 'Project metadata',
      headers: parsed.headers,
      rows: parsed.rows,
      mapping: mapping.map,
      source: 'csv',
    });
    expect(roster.projectMetadata).toEqual({
      fundingStatements: ['Supported by Grant A'],
      disclosureStatements: ['No competing interests'],
    });
  });

  it('detects tabular paste', () => {
    expect(pasteLooksTabular('a\tb\n1\t2\n')).toBe(true);
    expect(pasteLooksTabular('hello')).toBe(false);
  });
});
