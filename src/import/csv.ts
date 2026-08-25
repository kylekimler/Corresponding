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

  const headers = rows[0]!.map((h) => denatureCsvFormula(h.trim()));
  const data = rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => r.map((c) => denatureCsvFormula(c)));
  return { headers, rows: data };
}

/**
 * Neutralize spreadsheet formula injection when a cell is later opened in
 * Excel/Sheets/LibreOffice. Prefixes leading =, +, -, @, tab, CR with a quote.
 */
export function neutralizeCsvFormula(value: string): string {
  if (/^[=+\-@\t\r]/.test(value) || /^'[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/** Reverse neutralizeCsvFormula for round-trip import of our own exports. */
export function denatureCsvFormula(value: string): string {
  if (/^'[=+\-@\t\r]/.test(value)) {
    return value.slice(1);
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    const neutralized = neutralizeCsvFormula(v);
    if (/[",\n\r]/.test(neutralized) || neutralized.startsWith("'")) {
      return `"${neutralized.replace(/"/g, '""')}"`;
    }
    return neutralized;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map((c) => escape(c ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}
