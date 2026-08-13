import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { extractDocxAuthorTable } from '@/import/docx';
import { mappingIsComplete, suggestColumnMapping } from '@/import/columnMap';

function docxWithDocumentXml(body: string): ArrayBuffer {
  const zipped = zipSync({
    'word/document.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>
       <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
         <w:body>${body}</w:body>
       </w:document>`,
    ),
  });
  return zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength,
  ) as ArrayBuffer;
}

function cell(text: string): string {
  return `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
}

describe('local DOCX author-table extraction', () => {
  it('extracts a structured author table without manuscript prose', () => {
    const unrelated = `
      <w:tbl>
        <w:tr>${cell('Experiment')}${cell('Result')}</w:tr>
        <w:tr>${cell('A')}${cell('42')}</w:tr>
      </w:tbl>`;
    const authors = `
      <w:tbl>
        <w:tr>${cell('')}${cell('First name')}${cell('Last name')}${cell('Email')}${cell('Affiliation 1')}</w:tr>
        <w:tr>${cell('*')}${cell('Ada')}${cell('Lovelace')}${cell('ada@example.org')}${cell('Analytical Engines')}</w:tr>
        <w:tr>${cell('')}${cell('Alan')}${cell('Turing')}${cell('alan@example.org')}${cell('Bletchley Park')}</w:tr>
      </w:tbl>`;
    const extracted = extractDocxAuthorTable(
      docxWithDocumentXml(`<w:p><w:r><w:t>Secret manuscript prose</w:t></w:r></w:p>${unrelated}${authors}`),
    );

    expect(extracted.tableCount).toBe(2);
    expect(extracted.headers).toEqual([
      '',
      'First name',
      'Last name',
      'Email',
      'Affiliation 1',
    ]);
    expect(extracted.rows).toEqual([
      [
        '*',
        'Ada',
        'Lovelace',
        'ada@example.org',
        'Analytical Engines',
      ],
      ['', 'Alan', 'Turing', 'alan@example.org', 'Bletchley Park'],
    ]);
    expect(JSON.stringify(extracted)).not.toContain('Secret manuscript prose');
    expect(
      mappingIsComplete(suggestColumnMapping(extracted.headers).map),
    ).toBe(true);
  });

  it('fails closed for paragraph-style front matter', () => {
    const docx = docxWithDocumentXml(
      '<w:p><w:r><w:t>Ada Lovelace, Alan Turing</w:t></w:r></w:p>',
    );
    expect(() => extractDocxAuthorTable(docx)).toThrow(
      /Paragraph-style manuscript authors are not supported yet/,
    );
  });

  it('rejects files without Word document XML', () => {
    const zipped = zipSync({ 'other.txt': strToU8('not a docx') });
    const buffer = zipped.buffer.slice(
      zipped.byteOffset,
      zipped.byteOffset + zipped.byteLength,
    ) as ArrayBuffer;
    expect(() => extractDocxAuthorTable(buffer)).toThrow(
      /missing word\/document\.xml/,
    );
  });
});
