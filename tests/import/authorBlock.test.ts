import { describe, expect, it } from 'vitest';
import {
  authorBlockToRoster,
  parseAuthorBlock,
} from '@/import/authorBlock';
import { ingestAuthorText, looksLikeSpreadsheet } from '@/import/ingestAuthors';

describe('author-block parser', () => {
  it('keeps multiple affiliations and a corresponding marker attached to the author', () => {
    const parsed = parseAuthorBlock('Ada Lovelace¹,²,*, Alan Turing²\n¹ First institute\n² Second institute');
    const roster = authorBlockToRoster(parsed);
    expect(roster.authors).toHaveLength(2);
    expect(roster.authors[0]!.isCorresponding).toBe(true);
    expect(roster.authors[0]!.affiliations.map((item) => item.institution)).toEqual(['First institute', 'Second institute']);
  });
  it('parses a numbered manuscript author block', () => {
    const parsed = parseAuthorBlock(
      [
        'Ada Lovelace1,*, Alan M. Turing1, and Grace Hopper2',
        '1 University of London, London, UK',
        '2 Analytical Engines Institute, Paris, France',
        'Corresponding author: Ada Lovelace',
      ].join('\n'),
    );
    expect(parsed.authors.map((author) => author.familyName)).toEqual([
      'Lovelace',
      'Turing',
      'Hopper',
    ]);
    expect(parsed.authors[0]?.isCorresponding).toBe(true);
    expect(parsed.authors[1]?.middleName).toBe('M.');
    const roster = authorBlockToRoster(parsed, { name: 'Demo' });
    expect(roster.authors[0]?.affiliations[0]?.institution).toBe(
      'University of London, London, UK',
    );
    expect(roster.authors[2]?.affiliations[0]?.institution).toContain(
      'Analytical Engines',
    );
    expect(roster.source).toBe('web');
  });

  it('parses one name per line and inline email / ORCID', () => {
    const parsed = parseAuthorBlock(
      [
        'Ada Lovelace <ada@example.org>',
        'Alan Turing https://orcid.org/0000-0002-1825-0097',
      ].join('\n'),
    );
    expect(parsed.authors[0]?.email).toBe('ada@example.org');
    expect(parsed.authors[1]?.orcid).toBe('0000-0002-1825-0097');
  });

  it('does not treat a comma-separated author line as a spreadsheet', () => {
    const text = 'Ada Lovelace, Alan Turing, and Grace Hopper';
    expect(looksLikeSpreadsheet(text)).toBe(false);
    const ingested = ingestAuthorText(text);
    expect(ingested.kind).toBe('block');
    if (ingested.kind === 'block') {
      expect(ingested.roster.authors).toHaveLength(3);
    }
  });

  it('uses the existing table importer when headers are present', () => {
    const text = [
      'First name,Last name,Email',
      'Ada,Lovelace,ada@example.org',
      'Alan,Turing,alan@example.org',
    ].join('\n');
    expect(looksLikeSpreadsheet(text)).toBe(true);
    const ingested = ingestAuthorText(text, { name: 'Sheet' });
    expect(ingested.kind).toBe('table');
    if (ingested.kind === 'table') {
      expect(ingested.roster?.authors).toHaveLength(2);
      expect(ingested.roster?.authors[0]?.email).toBe('ada@example.org');
    }
  });
});
