import { collectReadableDocuments } from '@/diagnostics/frames';
import {
  ADD_ANOTHER_AUTHOR_CLASS,
  ADD_ANOTHER_AUTHOR_RE,
  ADD_AUTHOR_RE,
  SAVE_AND_ADD_AUTHOR_RE,
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
  WRONG_FORMAT_RE,
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

function isDocumentFrameHidden(doc: Document): boolean {
  const frame = doc.defaultView?.frameElement as HTMLElement | null;
  if (!frame) return false;
  return !isShown(frame);
}

/**
 * Add New Author fields live in an iframe. Closing the dialog hides that
 * iframe on the parent page; FirstName inside the frame still looks shown.
 */
export function isAuthorFormOpen(root: Document): boolean {
  const form = findAuthorFormDocument(root);
  if (!form) return false;
  const first = form.getElementById(AUTHOR_FIELD_IDS.firstName);
  if (!first || !isShown(first)) return false;
  if (isDocumentFrameHidden(form)) return false;
  const dialog = first.closest(
    '#author-dialog, .ui-dialog, [role="dialog"], [role="alertdialog"]',
  );
  if (dialog && !isShown(dialog)) return false;
  return true;
}

function addAuthorCandidates(doc: Document): HTMLElement[] {
  const found: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const remember = (el: HTMLElement | null) => {
    if (!el || seen.has(el)) return;
    seen.add(el);
    found.push(el);
  };
  for (const el of doc.querySelectorAll<HTMLElement>(
    `button.${ADD_ANOTHER_AUTHOR_CLASS}, .${ADD_ANOTHER_AUTHOR_CLASS}`,
  )) {
    remember(el);
  }
  for (const el of doc.querySelectorAll(
    'button, a, input[type="button"], input[type="image"], [role="button"], img[title], img[alt], [title]',
  )) {
    const blob = controlBlob(el);
    if (!ADD_AUTHOR_RE.test(blob) && !ADD_ANOTHER_AUTHOR_RE.test(blob)) {
      continue;
    }
    remember(
      (el.closest('button, a, input, [role="button"]') ?? el) as HTMLElement,
    );
  }
  return found;
}

function addAuthorScore(el: HTMLElement, doc: Document): number {
  const blob = controlBlob(el);
  if (SAVE_AND_ADD_AUTHOR_RE.test(blob)) return -1;
  if (!isShown(el)) return -1;
  const isFormDoc = Boolean(doc.getElementById(AUTHOR_FIELD_IDS.firstName));
  let score = 0;
  if (
    el.classList.contains(ADD_ANOTHER_AUTHOR_CLASS) ||
    el.closest(`.${ADD_ANOTHER_AUTHOR_CLASS}`)
  ) {
    score += 4;
  }
  if (!isFormDoc) score += 3;
  if (!isDocumentFrameHidden(doc)) score += 2;
  if (ADD_AUTHOR_RE.test(blob) || ADD_ANOTHER_AUTHOR_RE.test(blob)) score += 1;
  return score;
}

/**
 * Current Author List “+ Add Another Author” (`button.fl-add-btn`).
 * After the first save the form iframe is hidden and a Save and Add Another
 * toolbar icon may still exist inside it — that is not this control.
 */
export function findAddAnotherAuthorControl(
  root: Document,
): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = -1;
  for (const doc of documentsForAddAuthor(root)) {
    for (const el of addAuthorCandidates(doc)) {
      const score = addAuthorScore(el, doc);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
  }
  return bestScore >= 0 ? best : null;
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

function controlLabel(el: Element): string {
  const span = el.querySelector('.ui-button-text');
  return (
    span?.textContent ??
    el.textContent ??
    el.getAttribute('value') ??
    ''
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Live PLOS Warning OK, captured 2026-08-18:
 * `<button type="button" class="ui-button ui-widget ui-state-default
 *   ui-corner-all ui-button-text-only" role="button">
 *   <span class="ui-button-text">OK</span></button>`
 * Prefer the button, not the inner span — jQuery UI listens on the button.
 */
function findJqueryUiOk(scope: ParentNode): HTMLElement | null {
  const candidates = scope.querySelectorAll<HTMLElement>(
    'button.ui-button-text-only, button.ui-button, .ui-dialog-buttonset button, button[role="button"], .ui-button, span.ui-button-text',
  );
  for (const el of candidates) {
    if (!isShown(el)) continue;
    if (!/^ok$/i.test(controlLabel(el))) continue;
    const button = (el.closest('button.ui-button, button, [role="button"]') ??
      el) as HTMLElement;
    if (isShown(button) && /^ok$/i.test(controlLabel(button))) return button;
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
      '[role="alertdialog"], .ui-dialog.ui-dialog-buttons, [role="dialog"], .ui-dialog, .ui-dialog-buttonpane, .ui-dialog-buttonset, .modal',
    );
    for (const dialog of dialogs) {
      if (!isShown(dialog)) continue;
      const scope =
        dialog.closest(
          '[role="alertdialog"], .ui-dialog, [role="dialog"], .modal',
        ) ?? dialog;
      const text = (scope.textContent ?? '').replace(/\s+/g, ' ');
      if (!dialogText.test(text)) continue;
      const ok = findJqueryUiOk(scope);
      if (ok && buttonText.test(controlLabel(ok))) return ok;
      const labeled = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [role="button"], .ui-button, .ui-button-text, a, input[type="button"]',
        ),
      ).find((el) => buttonText.test(controlLabel(el)));
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
 * OK on a named jQuery UI click-through. Cancel is never returned.
 */
function findClickThroughOk(
  root: Document,
  dialogText: RegExp,
): HTMLElement | null {
  const fromDialog = findDialogButton(root, dialogText, /^ok$/i);
  if (fromDialog) return fromDialog;
  for (const doc of documentsWithAncestors(root)) {
    let warningVisible = false;
    for (const node of doc.querySelectorAll(
      'div, p, span, section, aside, [role="alertdialog"], [role="dialog"]',
    )) {
      if (!isShown(node)) continue;
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (text.length > 400 || !dialogText.test(text)) continue;
      warningVisible = true;
      const scope =
        node.closest(
          '[role="alertdialog"], .ui-dialog, [role="dialog"], .modal',
        ) ??
        node.parentElement ??
        node;
      const ok = findJqueryUiOk(scope);
      if (ok) return ok;
    }
    if (!warningVisible) continue;
    for (const set of doc.querySelectorAll('.ui-dialog-buttonset')) {
      if (!isShown(set)) continue;
      const ok = findJqueryUiOk(set);
      if (ok) return ok;
    }
  }
  return null;
}

/**
 * OK on the "Institution could not be identified… Proceed anyway?" warning.
 * Cancel is never returned.
 */
export function findInstitutionWarningOk(root: Document): HTMLElement | null {
  return findClickThroughOk(root, INSTITUTION_WARNING_RE);
}

/**
 * OK on “Validation found issues. Review the highlighted counts and form.”
 * That dialog is a click-through, not a reason to abandon Save This Author.
 */
export function findValidationIssuesOk(root: Document): HTMLElement | null {
  return findClickThroughOk(root, VALIDATION_ISSUES_RE);
}

/**
 * OK on “Cannot Save Author” / wrong-format after a successful save.
 * Observed 2026-08-19 on PLOS ONE Current Author List. Single OK.
 */
export function findWrongFormatOk(root: Document): HTMLElement | null {
  return findClickThroughOk(root, WRONG_FORMAT_RE);
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
  for (const doc of documentsWithAncestors(root)) {
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
