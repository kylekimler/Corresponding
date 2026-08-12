import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '@/import/csv';
import { suggestColumnMapping, mappingIsComplete } from '@/import/columnMap';
import { rowsToRoster } from '@/import/rosterFromTable';

describe('CSV import', () => {
  it('parses quoted commas and escaped quotes', () => {
    // Standard CSV escaping: "" for quote
    const text =
      'First Name,Last Name,Institution\n"Ada, Countess",Lovelace,"""Analytical"", Engine"\n';
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(['First Name', 'Last Name', 'Institution']);
    expect(rows[0]).toEqual(['Ada, Countess', 'Lovelace', '"Analytical", Engine']);
  });

  it('handles Unicode and BOM', () => {
    const text = '\uFEFFFirst Name,Last Name,Email\n田中,Müller,t@example.org\n';
    const { rows } = parseCsv(text);
    expect(rows[0]?.[0]).toBe('田中');
    expect(rows[0]?.[1]).toBe('Müller');
  });

  it('round-trips via toCsv', () => {
    const csv = toCsv(
      ['First Name', 'Last Name'],
      [['Ada', 'Lovelace'], ['Has, comma', 'Quote "x"']],
    );
    const parsed = parseCsv(csv);
    expect(parsed.rows[1]?.[0]).toBe('Has, comma');
  });

  it('recognizes common headings without silent ambiguity', () => {
    const mapping = suggestColumnMapping([
      'First Name',
      'Family name',
      'Email',
      'ORCID',
      'Affiliation 1',
      'City',
      'Country',
    ]);
    expect(mapping.map[0]).toBe('givenName');
    expect(mapping.map[1]).toBe('familyName');
    expect(mapping.map[4]).toBe('institution');
    expect(mappingIsComplete(mapping.map)).toBe(true);
    expect(mapping.requiresConfirmation).toBe(false);
  });

  it('requires confirmation for ambiguous/unknown columns', () => {
    const mapping = suggestColumnMapping(['Name', 'Contact', 'Place']);
    expect(mapping.requiresConfirmation).toBe(true);
    expect(mappingIsComplete(mapping.map)).toBe(false);
  });

  it('builds a roster from mapped rows', () => {
    const headers = ['given_name', 'Last name', 'Email', 'Institution', 'Corresponding'];
    const mapping = suggestColumnMapping(headers);
    const roster = rowsToRoster({
      name: 'Demo',
      headers,
      rows: [
        ['Ada', 'Lovelace', 'ada@example.org', 'AE', 'yes'],
        ['Alan', 'Turing', 'alan@example.org', 'Bletchley', ''],
      ],
      mapping: mapping.map,
      source: 'csv',
    });
    expect(roster.authors).toHaveLength(2);
    expect(roster.authors[0]?.isCorresponding).toBe(true);
    expect(roster.authors[0]?.affiliations[0]?.institution).toBe('AE');
  });
});
