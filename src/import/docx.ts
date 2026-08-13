import { strFromU8, unzipSync } from 'fflate';
import { mappingIsComplete, suggestColumnMapping } from './columnMap';

const MAX_DOCX_BYTES = 15 * 1024 * 1024;
const MAX_DOCUMENT_XML_BYTES = 5 * 1024 * 1024;

export interface DocxAuthorTable {
  headers: string[];
  rows: string[][];
  tableCount: number;
}

function directChildrenByLocalName(element: Element, name: string): Element[] {
  return Array.from(element.children).filter(
    (child) => child.localName === name,
  );
}

function cellText(cell: Element): string {
  return Array.from(cell.getElementsByTagNameNS('*', 'p'))
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagNameNS('*', 't'))
        .map((node) => node.textContent ?? '')
        .join(''),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tableRows(table: Element): string[][] {
  return directChildrenByLocalName(table, 'tr').map((row) =>
    directChildrenByLocalName(row, 'tc').map(cellText),
  );
}

function recognizedColumnCount(headers: string[]): number {
  return Object.values(suggestColumnMapping(headers).map).filter(
    (column) => column !== 'ignore',
  ).length;
}

/**
 * Extract a deterministic author table from DOCX without retaining manuscript
 * prose. Paragraph-style front matter intentionally fails closed.
 */
export function extractDocxAuthorTable(
  arrayBuffer: ArrayBuffer,
): DocxAuthorTable {
  if (arrayBuffer.byteLength > MAX_DOCX_BYTES) {
    throw new Error('DOCX is too large for local author-table extraction');
  }

  let oversizedDocument = false;
  const archive = unzipSync(new Uint8Array(arrayBuffer), {
    filter(file) {
      if (file.name !== 'word/document.xml') return false;
      if (file.originalSize > MAX_DOCUMENT_XML_BYTES) {
        oversizedDocument = true;
        return false;
      }
      return true;
    },
  });
  if (oversizedDocument) {
    throw new Error('DOCX document XML is too large to parse safely');
  }
  const documentXml = archive['word/document.xml'];
  if (!documentXml) {
    throw new Error('DOCX is missing word/document.xml');
  }

  const xml = new DOMParser().parseFromString(
    strFromU8(documentXml),
    'application/xml',
  );
  if (xml.querySelector('parsererror')) {
    throw new Error('DOCX document XML is malformed');
  }

  const tables = Array.from(xml.getElementsByTagNameNS('*', 'tbl'))
    .map(tableRows)
    .filter((rows) => rows.length >= 2 && rows[0]!.length >= 2);
  const candidates = tables
    .map((rows) => {
      const headers = rows[0]!.map((header) => header.trim());
      return {
        headers,
        rows: rows.slice(1).filter((row) => row.some((cell) => cell.trim())),
        mapping: suggestColumnMapping(headers),
        recognized: recognizedColumnCount(headers),
      };
    })
    .filter(
      (candidate) =>
        candidate.rows.length > 0 &&
        mappingIsComplete(candidate.mapping.map),
    )
    .sort((left, right) => right.recognized - left.recognized);

  const best = candidates[0];
  if (!best) {
    throw new Error(
      'No author table with separate given-name and family-name columns was found. Paragraph-style manuscript authors are not supported yet.',
    );
  }
  const width = best.headers.length;
  return {
    headers: best.headers,
    rows: best.rows.map((row) => {
      const normalized = row.slice(0, width);
      while (normalized.length < width) normalized.push('');
      return normalized;
    }),
    tableCount: tables.length,
  };
}
