import { collectReadableDocuments } from '@/diagnostics/frames';
import {
  ADD_ANOTHER_AUTHOR_RE,
  AUTHORS_LIST_TITLE_RE,
  AUTHOR_FIELD_IDS,
  COLLAPSE_SAVE_ROLES_RE,
  EDIT_ROLES_ID,
  EDIT_ROLES_RE,
  SELECT_ROLES_RE,
} from './ids';

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

/**
 * The Manuscript Data authors list (`SubManuscriptData.aspx`, title
 * Add/Edit/Remove Authors) is Editorial Manager, but the author form lives in
 * the Add New Author window. Observed 2026-08-17 on PLOS Genetics.
 */
export function isAuthorsListPage(root: Document): boolean {
  for (const doc of documentsIn(root)) {
    if (AUTHORS_LIST_TITLE_RE.test(doc.title || '')) return true;
    const hasStep = Boolean(
      doc.getElementById('StepIndicator_stepManuscriptDataButton'),
    );
    const hasAuthorForm = Boolean(doc.getElementById(AUTHOR_FIELD_IDS.firstName));
    if (hasStep && !hasAuthorForm) return true;
  }
  return false;
}

export function authorsListGuidance(): string {
  return 'This is Editorial Manager’s Authors list page. The author form lives in the Add New Author window — click inside that window, then click Corresponding.';
}

function controlBlob(el: Element): string {
  return [
    el.textContent,
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
    el.getAttribute('alt'),
    el.tagName.toLowerCase() === 'input' ? el.getAttribute('value') : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Pencil / EditButton that reveals the 14 CRediT checkboxes. */
export function findSelectRolesControl(root: Document): HTMLElement | null {
  for (const doc of documentsIn(root)) {
    const byId = doc.getElementById(EDIT_ROLES_ID);
    if (byId) return byId as HTMLElement;
    const nodes = doc.querySelectorAll(
      'input[type="image"], a, button, [role="button"], span, img, [title]',
    );
    for (const el of nodes) {
      const blob = controlBlob(el);
      if (!EDIT_ROLES_RE.test(blob) && !SELECT_ROLES_RE.test(blob)) continue;
      const clickable =
        el.closest('a, button, input, [role="button"]') ?? el;
      return clickable as HTMLElement;
    }
  }
  return null;
}

/**
 * Floppy that saves the ticked roles and collapses the grid. Distinguished
 * from the author SaveButton by title, because both can use id="SaveButton".
 */
export function findRolesCollapseSave(root: Document): HTMLElement | null {
  for (const doc of documentsIn(root)) {
    const nodes = doc.querySelectorAll(
      'input[type="image"], input[type="button"], button, a',
    );
    for (const el of nodes) {
      if (COLLAPSE_SAVE_ROLES_RE.test(controlBlob(el))) {
        return el as HTMLElement;
      }
    }
  }
  return null;
}

export function isRolesCollapseSave(el: Element): boolean {
  return COLLAPSE_SAVE_ROLES_RE.test(controlBlob(el));
}
