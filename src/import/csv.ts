/**
 * Minimal RFC4180-ish CSV parser with Unicode support.
 * Handles quoted fields, escaped quotes (""), and CRLF/LF.
 */

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): CsvParseResult {
  const normalized = text.replace(/^\uFEFF/, '');
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
    if (ch === ',') {
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
    if (ch === '\r') {
      // swallow; handle CRLF as single break when followed by \n
      continue;
    }
    field += ch;
  }

  // last field
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0]!.map((h) => h.trim());
  const data = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''));
  return { headers, rows: data };
}

export function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map((c) => escape(c ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}
