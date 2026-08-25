import { mappingIsComplete, suggestColumnMapping } from './columnMap';
import { parseAuthorBlock, authorBlockToRoster } from './authorBlock';
import { parseCsv } from './csv';
import { parsePastedTable } from './pasteTable';
import { rowsToRoster } from './rosterFromTable';
import type { ColumnMapping } from './columnMap';
import type { Roster } from '@/schema/author';

export type IngestResult =
  | { kind: 'empty'; warnings: string[] }
  | {
      kind: 'table';
      headers: string[];
      rows: string[][];
      mapping: ColumnMapping;
      roster?: Roster;
    }
  | { kind: 'block'; roster: Roster; warnings: string[] };

export function looksLikeSpreadsheet(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '');
  if (!trimmed.trim()) return false;
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  if (lines.length < 2) return false;
  if (lines.slice(0, 8).some((line) => line.includes('\t'))) return true;
  const csv = parseCsv(trimmed);
  if (csv.headers.length < 2) return false;
  return mappingIsComplete(suggestColumnMapping(csv.headers).map);
}

export function ingestAuthorText(
  text: string,
  options: { name?: string; id?: string; now?: string } = {},
): IngestResult {
  if (!text.replace(/^\uFEFF/, '').trim()) {
    return { kind: 'empty', warnings: ['Nothing to import'] };
  }

  if (looksLikeSpreadsheet(text)) {
    const parsed = parsePastedTable(text);
    const mapping = suggestColumnMapping(parsed.headers);
    const result: Extract<IngestResult, { kind: 'table' }> = {
      kind: 'table',
      headers: parsed.headers,
      rows: parsed.rows,
      mapping,
    };
    if (mappingIsComplete(mapping.map)) {
      result.roster = rowsToRoster({
        name: options.name ?? 'Imported authors',
        headers: parsed.headers,
        rows: parsed.rows,
        mapping: mapping.map,
        source: 'csv',
        id: options.id,
        now: options.now,
      });
    }
    return result;
  }

  const parsed = parseAuthorBlock(text);
  if (parsed.authors.length === 0) {
    return {
      kind: 'empty',
      warnings:
        parsed.warnings.length > 0
          ? parsed.warnings
          : ['No author names could be read from that text'],
    };
  }
  return {
    kind: 'block',
    roster: authorBlockToRoster(parsed, options),
    warnings: parsed.warnings,
  };
}
