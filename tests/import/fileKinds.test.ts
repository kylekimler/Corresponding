import { describe, expect, it } from 'vitest';
import { detectImportFileKind, excelImportStatus } from '@/import/fileKinds';
import { sheetsChooserAvailability } from '@/sheets/types';

describe('import file kinds + sheets chooser UX', () => {
  it('detects csv, excel, and DOCX extensions', () => {
    expect(detectImportFileKind({ name: 'authors.csv' })).toBe('csv');
    expect(detectImportFileKind({ name: 'authors.XLSX' })).toBe('excel');
    expect(detectImportFileKind({ name: 'manuscript.docx' })).toBe('docx');
    expect(detectImportFileKind({ name: 'notes.txt' })).toBe('unknown');
  });

  it('keeps excel unsupported without adding a dependency', () => {
    const status = excelImportStatus();
    expect(status.supported).toBe(false);
    expect(status.reason).toMatch(/CSV or paste/i);
  });

  it('never exposes OAuth credentials in scientist-facing sheets copy', () => {
    const off = sheetsChooserAvailability(false);
    expect(off.enabled).toBe(false);
    expect(off.label).toBe('Import Google Sheet');
    expect(off.hint.toLowerCase()).not.toMatch(/oauth|client id|api key|credential/);
    expect(off.hint).toMatch(/paste/i);

    const on = sheetsChooserAvailability(true);
    expect(on.enabled).toBe(true);
    expect(on.hint.toLowerCase()).not.toMatch(/oauth|client id|api key/);
  });
});
