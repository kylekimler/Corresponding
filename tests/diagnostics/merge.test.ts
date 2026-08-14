import { describe, expect, it } from 'vitest';
import { captureForm } from '@/diagnostics/capture';
import { probeForm } from '@/diagnostics/formProbe';
import { mergeDiagnosticReports } from '@/diagnostics/merge';

describe('merge diagnostic reports', () => {
  it('keeps author fields from a child frame and drops chrome-only guidance', () => {
    document.body.innerHTML = `
      <select id="RoleDropdown" name="RoleDropdown">
        <option>Author</option>
        <option>Reviewer</option>
      </select>
    `;
    const chrome = probeForm(document, {
      url: 'https://www.editorialmanager.com/pgenetics/default2.aspx',
    });

    const frame = document.implementation.createHTMLDocument('author');
    frame.body.innerHTML = `
      <label for="givenName">Given Name</label>
      <input id="givenName" name="givenName" />
      <label for="familyName">Family Name</label>
      <input id="familyName" name="familyName" />
      <label for="email">Email</label>
      <input id="email" name="email" type="email" />
    `;
    const author = probeForm(frame, {
      url: 'https://www.editorialmanager.com/pgenetics/author.aspx',
    });

    const merged = mergeDiagnosticReports([chrome, author]);
    expect(merged.fieldCount).toBeGreaterThanOrEqual(4);
    expect(merged.structuralFields.map((f) => f.idPattern)).toEqual(
      expect.arrayContaining(['RoleDropdown', 'givenName', 'familyName', 'email']),
    );
    expect(merged.notes.some((note) => /Merged 2 injectable frame/.test(note))).toBe(
      true,
    );
    expect(merged.notes.join(' ')).not.toMatch(/Editorial Manager chrome/);
  });

  it('does not leak values while merging', () => {
    document.body.innerHTML =
      '<input id="email" name="email" value="ada@secret.edu" />';
    const a = probeForm(document);
    const b = captureForm(document);
    const merged = mergeDiagnosticReports([
      { ...a, ...b, fields: a.fields, url: a.url, title: a.title },
      a,
    ]);
    const text = JSON.stringify(merged);
    expect(text).not.toContain('ada@secret.edu');
  });
});
