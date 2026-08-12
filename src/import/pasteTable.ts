/**
 * Parse spreadsheet paste (TSV / mixed) from a user-initiated textarea paste.
 * No clipboard-read permission required.
 */

import { parseCsv, type CsvParseResult } from './csv';

export type PasteParseResult = CsvParseResult & {
  delimiter: 'tab' | 'comma' | 'unknown';
  rowCount: number;
};

function splitLines(text: string): string[] {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

/** Count unquoted delimiter occurrences on a line (CSV-ish). */
function countDelim(line: string, delim: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delim) count += 1;
  }
  return count;
}

function detectDelimiter(sampleLines: string[]): 'tab' | 'comma' | 'unknown' {
  let tabs = 0;
  let commas = 0;
  for (const line of sampleLines) {
    if (!line.trim()) continue;
    tabs += countDelim(line, '\t');
    commas += countDelim(line, ',');
  }
  if (tabs === 0 && commas === 0) return 'unknown';
  if (tabs >= commas) return 'tab';
  return 'comma';
}

/**
 * Parse a TSV block. Supports quoted fields with tabs/newlines inside quotes.
 */
export function parseTsv(text: string): CsvParseResult {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i]!;
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === '\t') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0]!.map((h) => h.trim());
  const data = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''));
  // Normalize row widths to header length (blank cells).
  const width = headers.length;
  const normalizedRows = data.map((r) => {
    const next = r.slice(0, width);
    while (next.length < width) next.push('');
    return next;
  });
  return { headers, rows: normalizedRows };
}

/**
 * Parse pasted spreadsheet content. Prefers tab-separated (Sheets/Excel/Numbers).
 * Falls back to CSV when tabs are absent.
 */
export function parsePastedTable(text: string): PasteParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { headers: [], rows: [], delimiter: 'unknown', rowCount: 0 };
  }

  const sample = splitLines(trimmed).slice(0, 12);
  const delimiter = detectDelimiter(sample);

  const parsed =
    delimiter === 'comma' ? parseCsv(trimmed) : parseTsv(trimmed);

  return {
    ...parsed,
    delimiter: delimiter === 'unknown' ? (parsed.headers.length > 1 ? 'tab' : 'unknown') : delimiter,
    rowCount: parsed.rows.length,
  };
}

export function pasteLooksTabular(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const lines = splitLines(t).filter((l) => l.trim());
  if (lines.length < 2) return false;
  const delim = detectDelimiter(lines.slice(0, 8));
  return delim !== 'unknown' || lines[0]!.includes('\t') || lines[0]!.includes(',');
}
