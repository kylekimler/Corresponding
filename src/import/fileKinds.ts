/**
 * File import abstraction — CSV today; Excel/XLSX and Sheets as first-class kinds.
 * Excel parsing is intentionally not wired to a heavy dependency yet
 * (see docs/EXCEL_IMPORT.md).
 */

export type ImportFileKind = 'csv' | 'excel' | 'docx' | 'unknown';

export function detectImportFileKind(file: {
  name: string;
  type?: string;
}): ImportFileKind {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  if (name.endsWith('.csv') || type.includes('csv') || type === 'text/plain') {
    return 'csv';
  }
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type.includes('spreadsheetml') ||
    type.includes('ms-excel')
  ) {
    return 'excel';
  }
  if (
    name.endsWith('.docx') ||
    type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  return 'unknown';
}

export interface ExcelImportStatus {
  supported: false;
  reason: string;
  recommendationDoc: string;
}

export function excelImportStatus(): ExcelImportStatus {
  return {
    supported: false,
    reason:
      'Excel import is designed but not enabled yet. Export as CSV or paste from your spreadsheet.',
    recommendationDoc: 'docs/EXCEL_IMPORT.md',
  };
}
