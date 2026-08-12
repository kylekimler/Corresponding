import { describe, expect, it } from 'vitest';
import {
  buildRepeatedAuthorHtml,
  type LayoutKind,
} from '@/recognition/fixtures';
import { recognizeForm } from '@/recognition/recognize';

const LAYOUTS: LayoutKind[] = [
  'numbered_ids',
  'fieldset_cards',
  'table_rows',
  'accordion',
  'aria_named',
];

describe('repeated author layout fixtures', () => {
  it.each(LAYOUTS)('detects groups for %s with 3 authors', (kind) => {
    document.body.innerHTML = buildRepeatedAuthorHtml(kind, 3);
    const report = recognizeForm(document);
    expect(report.authorGroups.length).toBeGreaterThanOrEqual(2);
    expect(
      report.proposals.some((p) => p.canonicalField === 'givenName'),
    ).toBe(true);
    expect(
      report.proposals.some((p) => p.canonicalField === 'familyName'),
    ).toBe(true);
  });

  it('scales numbered_ids to 10 authors', () => {
    document.body.innerHTML = buildRepeatedAuthorHtml('numbered_ids', 10);
    const report = recognizeForm(document);
    expect(report.authorGroups).toHaveLength(10);
  });
});
