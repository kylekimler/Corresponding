import { collectReadableDocuments } from '@/diagnostics/frames';
import {
  ADD_ANOTHER_AUTHOR_CLASS,
  ADD_ANOTHER_AUTHOR_RE,
  AUTHOR_SAVE_CLASS,
  AUTHOR_SAVE_ID,
  AUTHOR_SAVE_TOOL,
  AUTHORS_LIST_TITLE_RE,
  AUTHOR_FIELD_IDS,
  COLLAPSE_SAVE_ROLES_RE,
  EDIT_ROLES_ID,
  EDIT_ROLES_RE,
  INSTITUTION_WARNING_RE,
  SAVE_THIS_AUTHOR_RE,
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
    const byClass = doc.querySelector<HTMLElement>(
      `button.${ADD_ANOTHER_AUTHOR_CLASS}, .${ADD_ANOTHER_AUTHOR_CLASS}`,
    );
    if (byClass && ADD_ANOTHER_AUTHOR_RE.test(controlBlob(byClass))) {
      return byClass;
    }
    const nodes = doc.querySelectorAll(
      'button, a, input[type="button"], input[type="image"], [role="button"], img[title], img[alt], [title]',
    );
    for (const el of nodes) {
      if (!ADD_ANOTHER_AUTHOR_RE.test(controlBlob(el))) continue;
      const clickable =
        el.closest('button, a, input, [role="button"]') ?? el;
      return clickable as HTMLElement;
    }
  }
  return null;
}

function isShown(el: Element): boolean {
  let current: Element | null = el;
  while (current) {
    if ('hidden' in current && Boolean((current as HTMLElement).hidden)) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

/**
 * Author-dialog save. Prefer the captured toolbar floppy
 * (`data-toolname="AuthorSave"` / `.fl-flToolSave` in `.fl-toolbox`) over
 * id=SaveButton, which is also the CRediT collapse floppy.
 */
export function findAuthorSaveControl(root: Document): HTMLElement | null {
  const selectors = [
    `.fl-toolbox [data-toolname="${AUTHOR_SAVE_TOOL}"]`,
    `.ui-dialog [data-toolname="${AUTHOR_SAVE_TOOL}"]`,
    `[data-toolname="${AUTHOR_SAVE_TOOL}"]`,
    `.fl-toolbox button.${AUTHOR_SAVE_CLASS}`,
    `button.${AUTHOR_SAVE_CLASS}`,
    `.${AUTHOR_SAVE_CLASS}`,
  ];
  for (const doc of documentsIn(root)) {
    for (const selector of selectors) {
      const match = Array.from(doc.querySelectorAll<HTMLElement>(selector)).find(
        (el) => isShown(el) && !isRolesCollapseSave(el),
      );
      if (match) return match;
    }
    const nodes = doc.querySelectorAll(
      'button, input[type="button"], input[type="image"], [role="button"], [title], [aria-label]',
    );
    for (const el of nodes) {
      if (!isShown(el) || isRolesCollapseSave(el)) continue;
      if (SAVE_THIS_AUTHOR_RE.test(controlBlob(el))) return el as HTMLElement;
    }
    const byId = Array.from(doc.querySelectorAll('input, button, a')).find(
      (el) =>
        el.id === AUTHOR_SAVE_ID &&
        isShown(el) &&
        !isRolesCollapseSave(el),
    );
    if (byId) return byId as HTMLElement;
  }
  return null;
}

/**
 * OK on the "Institution could not be identified… Proceed anyway?" warning.
 * Cancel is never returned.
 */
export function findInstitutionWarningOk(root: Document): HTMLElement | null {
  for (const doc of documentsIn(root)) {
    const dialogs = doc.querySelectorAll(
      '.ui-dialog, [role="dialog"], .ui-widget-content',
    );
    for (const dialog of dialogs) {
      if (!isShown(dialog)) continue;
      const text = (dialog.textContent ?? '').replace(/\s+/g, ' ');
      if (!INSTITUTION_WARNING_RE.test(text)) continue;
      const labeled = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [role="button"], .ui-button, .ui-button-text',
        ),
      ).find((el) => {
        const label = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        return /^ok$/i.test(label);
      });
      if (!labeled) continue;
      const button =
        labeled.closest('button') ??
        labeled.closest('[role="button"]') ??
        labeled;
      return button as HTMLElement;
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
