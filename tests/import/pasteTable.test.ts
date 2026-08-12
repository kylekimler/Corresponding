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
  });

  it('detects tabular paste', () => {
    expect(pasteLooksTabular('a\tb\n1\t2\n')).toBe(true);
    expect(pasteLooksTabular('hello')).toBe(false);
  });
});
