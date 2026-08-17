import { collectReadableDocuments } from '@/diagnostics/frames';
import { ADD_ANOTHER_AUTHOR_RE, AUTHOR_FIELD_IDS } from './ids';

export function documentsIn(root: Document): Document[] {
  return collectReadableDocuments(root).documents.map((frame) => frame.doc);
}

export function findAuthorFormDocument(root: Document): Document | null {
  for (const doc of documentsIn(root)) {
    if (
      doc.getElementById(AUTHOR_FIELD_IDS.firstName) &&
      doc.getElementById(AUTHOR_FIELD_IDS.lastName) &&
      doc.getElementById(AUTHOR_FIELD_IDS.email)
    ) {
      return doc;
    }
  }
  return null;
}

export function findAddAnotherAuthorControl(
  root: Document,
): HTMLElement | null {
  for (const doc of documentsIn(root)) {
    // Editorial Manager renders this as a toolbar icon, so the label lives in
    // title/alt rather than in text. Images are candidates too; the click goes
    // to the nearest actionable ancestor when there is one.
    const nodes = doc.querySelectorAll(
      'button, a, input[type="button"], input[type="image"], [role="button"], img[title], img[alt], [title]',
    );
    for (const el of nodes) {
      const blob = [
        el.textContent,
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.getAttribute('alt'),
        el instanceof HTMLInputElement ? el.getAttribute('value') : '',
      ]
        .filter(Boolean)
        .join(' ');
      if (!ADD_ANOTHER_AUTHOR_RE.test(blob)) continue;
      const clickable =
        el.closest('button, a, input, [role="button"]') ?? el;
      return clickable as HTMLElement;
    }
  }
  return null;
}
