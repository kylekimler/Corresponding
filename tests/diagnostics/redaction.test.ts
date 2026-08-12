import { describe, expect, it } from 'vitest';
import { captureForm, previewCapture } from '@/diagnostics/capture';
import { assertNoLeakedSecrets, findLeakedSecrets } from '@/diagnostics/redact';

describe('diagnostics redaction', () => {
  it('never leaks planted PII from field values', () => {
    document.body.innerHTML = `
      <h1>Manuscript TITLE-SECRET-12345</h1>
      <label for="fn">First Name</label>
      <input id="fn" name="first_name" value="Ada Lovelace" />
      <label for="em">Email</label>
      <input id="em" name="email" value="ada@secret.edu" />
      <input id="password" type="password" name="password" value="hunter2" />
      <input type="hidden" name="csrf_token" value="csrf-ABCDEF" />
      <input id="orcid" name="orcid" value="0000-0001-2345-6789" />
    `;
    const capture = captureForm(document, {
      url: 'https://journal.example.org/submit/manuscript/999',
    });
    const text = previewCapture(capture);
    expect(capture.redactionComplete).toBe(true);
    expect(text).not.toContain('ada@secret.edu');
    expect(text).not.toContain('Ada Lovelace');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('csrf-ABCDEF');
    expect(text).not.toContain('0000-0001-2345-6789');
    expect(text).not.toContain('/submit/manuscript/999');
    const planted = [
      'ada@secret.edu',
      'Ada Lovelace',
      'hunter2',
      'csrf-ABCDEF',
      '0000-0001-2345-6789',
      '/submit/manuscript/999',
    ];
    expect(findLeakedSecrets(text, planted)).toEqual([]);
    assertNoLeakedSecrets(text, planted);
  });
});
