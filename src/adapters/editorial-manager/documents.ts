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
    const nodes = doc.querySelectorAll(
      'button, a, input[type="button"], [role="button"]',
    );
    for (const el of nodes) {
      const blob = [
        el.textContent,
        el.getAttribute('aria-label'),
        el instanceof HTMLInputElement ? el.getAttribute('value') : '',
      ]
        .filter(Boolean)
        .join(' ');
      if (ADD_ANOTHER_AUTHOR_RE.test(blob)) {
        return el as HTMLElement;
      }
    }
  }
  return null;
}
