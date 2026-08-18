import { collectReadableDocuments } from '@/diagnostics/frames';
import {
  ADD_ANOTHER_AUTHOR_CLASS,
  ADD_ANOTHER_AUTHOR_RE,
  ADD_AUTHOR_RE,
  AUTHOR_SAVE_CLASS,
  AUTHOR_SAVE_ID,
  AUTHOR_SAVE_TOOL,
  AUTHORS_LIST_TITLE_RE,
  AUTHOR_FIELD_IDS,
  COLLAPSE_SAVE_ROLES_RE,
  EDIT_ROLES_ID,
  EDIT_ROLES_RE,
  INSTITUTION_UNVERIFIED_RE,
  INSTITUTION_WARNING_RE,
  VALIDATION_ISSUES_RE,
  SAVE_THIS_AUTHOR_RE,
  SELECT_ROLES_RE,
} from './ids';

export function documentsIn(root: Document): Document[] {
  return collectReadableDocuments(root).documents.map((frame) => frame.doc);
}

/**
 * jQuery UI warnings are appended to the top window body. Fill often runs
 * in the author-form iframe, so dialog search must also look at parent/top.
 */
function ancestorDocuments(root: Document): Document[] {
  const docs: Document[] = [];
  const add = (doc: Document | null | undefined) => {
    if (doc && !docs.includes(doc)) docs.push(doc);
  };
  try {
    const win = root.defaultView;
    add(win?.parent?.document);
    add(win?.top?.document);
    if (win?.opener && !win.opener.closed) add(win.opener.document);
  } catch {
    // Cross-origin parent/opener; skip.
  }
  return docs;
}

export function documentsWithAncestors(root: Document): Document[] {
  const docs = documentsIn(root);
  for (const extra of ancestorDocuments(root)) {
    if (!docs.includes(extra)) docs.push(extra);
  }
  return docs;
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

function documentsForAddAuthor(root: Document): Document[] {
  return documentsWithAncestors(root);
}

export function findAddAnotherAuthorControl(
  root: Document,
): HTMLElement | null {
  for (const doc of documentsForAddAuthor(root)) {
    const byClass = Array.from(
      doc.querySelectorAll<HTMLElement>(
        `button.${ADD_ANOTHER_AUTHOR_CLASS}, .${ADD_ANOTHER_AUTHOR_CLASS}`,
      ),
    ).find((el) => {
      if (!isShown(el)) return false;
      const blob = controlBlob(el);
      return !blob.trim() || ADD_AUTHOR_RE.test(blob);
    });
    if (byClass) return byClass;
    const nodes = doc.querySelectorAll(
      'button, a, input[type="button"], input[type="image"], [role="button"], img[title], img[alt], [title]',
    );
    for (const el of nodes) {
      if (!isShown(el)) continue;
      const blob = controlBlob(el);
      if (!ADD_AUTHOR_RE.test(blob) && !ADD_ANOTHER_AUTHOR_RE.test(blob)) {
        continue;
      }
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
    const style = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) {
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

function findDialogButton(
  root: Document,
  dialogText: RegExp,
  buttonText: RegExp,
): HTMLElement | null {
  for (const doc of documentsWithAncestors(root)) {
    const dialogs = doc.querySelectorAll(
      '[role="alertdialog"], .ui-dialog.ui-dialog-buttons, [role="dialog"], .ui-dialog, .modal',
    );
    for (const dialog of dialogs) {
      if (!isShown(dialog)) continue;
      const text = (dialog.textContent ?? '').replace(/\s+/g, ' ');
      if (!dialogText.test(text)) continue;
      const labeled = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [role="button"], .ui-button, .ui-button-text, a, input[type="button"]',
        ),
      ).find((el) => {
        const label = (
          el.textContent ??
          el.getAttribute('value') ??
          ''
        )
          .replace(/\s+/g, ' ')
          .trim();
        return buttonText.test(label);
      });
      if (!labeled) continue;
      return (
        labeled.closest('button') ??
        labeled.closest('[role="button"]') ??
        labeled
      ) as HTMLElement;
    }
  }
  return null;
}

/**
 * OK on the "Institution could not be identified… Proceed anyway?" warning.
 * Cancel is never returned.
 */
export function findInstitutionWarningOk(root: Document): HTMLElement | null {
  return findDialogButton(root, INSTITUTION_WARNING_RE, /^ok$/i);
}

/**
 * OK on “Validation found issues. Review the highlighted counts and form.”
 * That dialog is a click-through, not a reason to abandon Save This Author.
 */
export function findValidationIssuesOk(root: Document): HTMLElement | null {
  const fromDialog = findDialogButton(root, VALIDATION_ISSUES_RE, /^ok$/i);
  if (fromDialog) return fromDialog;
  for (const doc of documentsWithAncestors(root)) {
    const nodes = doc.querySelectorAll('div, section, aside, p, span');
    for (const node of nodes) {
      if (!isShown(node)) continue;
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (text.length > 400 || !VALIDATION_ISSUES_RE.test(text)) continue;
      const scope =
        node.closest(
          '.ui-dialog, [role="alertdialog"], [role="dialog"], .modal',
        ) ?? node;
      const labeled = Array.from(
        scope.querySelectorAll<HTMLElement>(
          'button, [role="button"], .ui-button, a',
        ),
      ).find((el) => /^ok$/i.test((el.textContent ?? '').trim()));
      if (labeled) {
        return (labeled.closest('button') ?? labeled) as HTMLElement;
      }
    }
  }
  return null;
}

function normalizeInstitution(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * A visible typeahead suggestion whose text equals the roster institution.
 * Never returns the first unmatched item — a near match is not selected.
 */
/**
 * Hide the body-level jQuery UI Institution menu so it cannot eat the
 * Save This Author click. Observed 2026-08-18 on PLOS Add New Author.
 */
export function hideInstitutionTypeahead(root: Document): void {
  for (const doc of documentsIn(root)) {
    for (const el of doc.querySelectorAll<HTMLElement>(
      '.ui-autocomplete, #institution-suggestions',
    )) {
      el.hidden = true;
      el.style.display = 'none';
    }
  }
}

export function institutionTypeaheadOpen(root: Document): boolean {
  for (const doc of documentsIn(root)) {
    const nodes = doc.querySelectorAll<HTMLElement>(
      '[role="option"], [role="listbox"], .ui-autocomplete, .ui-menu-item, #institution-suggestions',
    );
    for (const el of nodes) {
      if (isShown(el) && (el.textContent ?? '').trim()) return true;
    }
  }
  return false;
}

export function findInstitutionSuggestion(
  root: Document,
  desired: string,
): HTMLElement | null {
  const needle = normalizeInstitution(desired);
  if (!needle) return null;
  for (const doc of documentsIn(root)) {
    const nodes = doc.querySelectorAll<HTMLElement>(
      '[role="option"], [role="listbox"] li, .ui-menu-item, .ui-autocomplete li, li, [data-institution]',
    );
    for (const el of nodes) {
      if (!isShown(el)) continue;
      const label = normalizeInstitution(el.textContent ?? '');
      if (label === needle) return el;
    }
  }
  return null;
}

export function institutionLooksUnverified(root: Document): boolean {
  for (const doc of documentsIn(root)) {
    const nodes = doc.querySelectorAll('div, span, p, li, [role="dialog"]');
    for (const node of nodes) {
      if (!isShown(node)) continue;
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (text.length > 400) continue;
      if (INSTITUTION_UNVERIFIED_RE.test(text)) return true;
    }
    if (findInstitutionWarningOk(root)) return true;
  }
  return false;
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
  return 'This is Editorial Manager’s Authors list. Fill clicks Add Author on this page, then Save This Author in the form, then Add Author again. If Add New Author opened as its own window and the form never appears here, click Corresponding in that window after it opens.';
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
