import { collectReadableDocuments } from '@/diagnostics/frames';
import {
  primaryAffiliation,
  sortAuthors,
  type Author,
  type Roster,
} from '@/schema/author';
import { parseCreditRoles, type CreditRole } from '@/schema/credit';
import { getInput, identitiesConflict, readValue, setValue } from '../dom';
import { evaluatePortalRequirements } from '../requirements';
import { assertSafeMutationTarget, listDangerousControls } from '../safety';
import type {
  DetectResult,
  FieldPlan,
  FillOptions,
  FillReport,
  InspectReport,
  PlatformAdapter,
  ValidateReport,
} from '../types';
import {
  authorsListGuidance,
  findAddAnotherAuthorControl,
  findAuthorFormDocument,
  findOpenAuthorFormDocument,
  findAuthorSaveControl,
  findInstitutionWarningOk,
  findValidationIssuesOk,
  findRequiredMissingOk,
  findWrongFormatOk,
  hideInstitutionTypeahead,
  isAuthorFormOpen,
  findRolesCollapseSave,
  findSelectRolesControl,
  isAuthorsListPage,
} from './documents';
import {
  ADD_ANOTHER_AUTHOR_CLASS,
  AUTHOR_FIELD_IDS,
  AUTHORS_COUNT_ID,
  CONTRIBUTOR_ROLE_PREFIX,
  MANUSCRIPT_FIELD_IDS,
  ROLES_WARNING_RE,
} from './ids';

const ROLE_WAIT_MS = 2_000;
const ROLE_INTERVAL_MS = 40;
const SAVE_WATCH_MS = 6_000;
const SAVE_INTERVAL_MS = 40;
const SAVE_ATTEMPTS = 3;
const SAVE_ATTEMPT_MS = 1_500;
const DIALOG_OK_ATTEMPTS = 3;
const DIALOG_OK_GAP_MS = 80;
const ADD_ATTEMPTS = 3;
const ADD_ATTEMPT_MS = 1_500;
const REOPEN_WAIT_MS = 6_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function planAction(
  current: string,
  proposed: string | undefined,
  options: FillOptions,
  conflict: boolean,
): FieldPlan['action'] {
  if (conflict) return 'skip_conflict';
  if (proposed === undefined || proposed === '') return 'missing_source';
  if (current && !options.overwrite) return 'preserve';
  return current ? 'overwrite' : 'fill';
}

function authorFormConflict(form: Document, author: Author): boolean {
  const portal = {
    givenName: readValue(form, AUTHOR_FIELD_IDS.firstName),
    familyName: readValue(form, AUTHOR_FIELD_IDS.lastName),
    email: readValue(form, AUTHOR_FIELD_IDS.email),
  };
  if (!portal.givenName && !portal.familyName && !portal.email) return false;
  return identitiesConflict(portal, author);
}

function affiliationText(author: Author): string | undefined {
  const aff = primaryAffiliation(author);
  if (!aff) return undefined;
  return [aff.department, aff.institution].filter(Boolean).join(', ') || undefined;
}

function buildAuthorPlans(
  form: Document,
  author: Author,
  options: FillOptions,
  conflict = authorFormConflict(form, author),
): FieldPlan[] {
  const aff = primaryAffiliation(author);
  const specs: Array<{ id: string; label: string; value?: string }> = [
    {
      id: AUTHOR_FIELD_IDS.firstName,
      label: 'Given name',
      value: author.givenName,
    },
    {
      id: AUTHOR_FIELD_IDS.middleName,
      label: 'Middle name',
      value: author.middleName,
    },
    {
      id: AUTHOR_FIELD_IDS.lastName,
      label: 'Family name',
      value: author.familyName,
    },
    { id: AUTHOR_FIELD_IDS.email, label: 'Email', value: author.email },
    {
      id: AUTHOR_FIELD_IDS.affiliation,
      label: 'Affiliation',
      value: affiliationText(author),
    },
    {
      id: AUTHOR_FIELD_IDS.institution,
      label: 'Institution',
      value: aff?.institution,
    },
    {
      id: AUTHOR_FIELD_IDS.department,
      label: 'Department',
      value: aff?.department,
    },
    { id: AUTHOR_FIELD_IDS.city, label: 'City', value: aff?.city },
    { id: AUTHOR_FIELD_IDS.state, label: 'State', value: aff?.state },
    {
      id: AUTHOR_FIELD_IDS.zipcode,
      label: 'Zip or Postal Code',
      value: aff?.postalCode,
    },
    { id: AUTHOR_FIELD_IDS.country, label: 'Country', value: aff?.country },
  ];

  return specs.map((spec) => {
    const current = readValue(form, spec.id);
    return {
      fieldId: spec.id,
      label: spec.label,
      authorSequence: author.sequence,
      action: planAction(current, spec.value, options, conflict),
      currentValue: current || undefined,
      proposedValue: spec.value,
      reason: conflict
        ? 'Existing author identity conflicts with the roster'
        : undefined,
    };
  });
}

function applyTextPlan(
  form: Document,
  plan: FieldPlan,
  options: FillOptions,
): void {
  if (options.dryRun) return;
  if (plan.action !== 'fill' && plan.action !== 'overwrite') return;
  if (plan.proposedValue === undefined) return;
  setValue(form, plan.fieldId, plan.proposedValue, {
    overwrite: true,
    dryRun: false,
  });
  // Institution is written separately: a blur here can pick the first
  // Ringgold hit. Zipcode (and other Knockout fields) update on blur.
  if (plan.fieldId === AUTHOR_FIELD_IDS.institution) return;
  const el = getInput(form, plan.fieldId);
  el?.dispatchEvent(new Event('blur', { bubbles: true }));
}

function typeIntoInstitution(input: HTMLInputElement, value: string): void {
  input.focus();
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.value = value;
  input.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      data: value,
      inputType: 'insertText',
    }),
  );
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: value.slice(-1) || 'a' }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: value.slice(-1) || 'a' }));
}

/** Close the Ringgold list without selecting a suggestion. */
function dismissInstitutionTypeahead(input: HTMLInputElement): void {
  input.dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
      code: 'Escape',
    }),
  );
  input.dispatchEvent(
    new KeyboardEvent('keyup', {
      bubbles: true,
      key: 'Escape',
      code: 'Escape',
    }),
  );
}

/**
 * Type the roster institution as free text. Do not wait for or click the
 * Ringgold dropdown — a near match is worse than the typed name. Escape
 * closes the list; do not blur (jQuery UI can select the first item).
 */
function applyInstitutionFreeText(
  form: Document,
  institution: string | undefined,
): void {
  const desired = institution?.trim();
  if (!desired) return;
  const input = getInput(form, AUTHOR_FIELD_IDS.institution);
  if (!input || input.tagName.toLowerCase() !== 'input') return;
  typeIntoInstitution(input as HTMLInputElement, desired);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  dismissInstitutionTypeahead(input as HTMLInputElement);
}

/**
 * Ringgold typing can clear City/Department. Write them again after the
 * institution box is done so Save This Author is not missing required fields.
 */
function refillAffiliationDetails(form: Document, author: Author): void {
  const aff = primaryAffiliation(author);
  if (!aff) return;
  const writes: Array<[string, string | undefined]> = [
    [AUTHOR_FIELD_IDS.department, aff.department],
    [AUTHOR_FIELD_IDS.city, aff.city],
    [AUTHOR_FIELD_IDS.state, aff.state],
    [AUTHOR_FIELD_IDS.zipcode, aff.postalCode],
    [AUTHOR_FIELD_IDS.country, aff.country],
  ];
  for (const [id, value] of writes) {
    if (!value?.trim()) continue;
    setValue(form, id, value, { overwrite: true, dryRun: false });
    getInput(form, id)?.dispatchEvent(new Event('blur', { bubbles: true }));
  }
}

function applyCorresponding(
  form: Document,
  author: Author,
  options: FillOptions,
  conflict: boolean,
): FieldPlan {
  const box = form.getElementById(
    AUTHOR_FIELD_IDS.corresponding,
  ) as HTMLInputElement | null;
  const current = box?.checked ? 'true' : 'false';
  const proposed = author.isCorresponding ? 'true' : 'false';
  const plan: FieldPlan = {
    fieldId: AUTHOR_FIELD_IDS.corresponding,
    label: 'Corresponding author',
    authorSequence: author.sequence,
    action: conflict
      ? 'skip_conflict'
      : current === proposed
        ? 'preserve'
        : options.overwrite || current === 'false'
          ? current === 'true'
            ? 'overwrite'
            : 'fill'
          : 'preserve',
    currentValue: current,
    proposedValue: proposed,
  };
  if (
    !options.dryRun &&
    box &&
    (plan.action === 'fill' || plan.action === 'overwrite')
  ) {
    assertSafeMutationTarget(box);
    box.checked = author.isCorresponding;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return plan;
}

function checkboxLabelText(input: HTMLInputElement): string {
  const aria = input.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  if (input.id) {
    const explicit = Array.from(
      input.ownerDocument.querySelectorAll('label[for]'),
    ).find((label) => label.getAttribute('for') === input.id);
    if (explicit?.textContent?.trim()) return explicit.textContent.trim();
  }
  const wrapping = input.closest('label');
  if (wrapping?.textContent?.trim()) return wrapping.textContent.trim();
  return input.nextElementSibling?.textContent?.trim() ?? '';
}

export function creditRoleCheckboxes(doc: Document): Array<{
  input: HTMLInputElement;
  role: CreditRole;
}> {
  const found: Array<{ input: HTMLInputElement; role: CreditRole }> = [];
  for (const input of Array.from(
    doc.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][id^="${CONTRIBUTOR_ROLE_PREFIX}"]`,
    ),
  )) {
    const [role] = parseCreditRoles(checkboxLabelText(input));
    if (role && role !== 'other') found.push({ input, role });
  }
  return found;
}

function planCreditRoles(form: Document, author: Author): FieldPlan[] {
  if (author.creditRoles.length === 0) {
    return [
      {
        fieldId: `${CONTRIBUTOR_ROLE_PREFIX}*`,
        label: 'Contributor Roles',
        authorSequence: author.sequence,
        action: 'missing_source',
        reason: 'Roster has no CRediT roles; Editorial Manager will refuse to save',
      },
    ];
  }
  const boxes = creditRoleCheckboxes(form);
  if (boxes.length === 0) {
    return [
      {
        fieldId: `${CONTRIBUTOR_ROLE_PREFIX}*`,
        label: 'Contributor Roles',
        authorSequence: author.sequence,
        action: 'unmapped',
        proposedValue: author.creditRoles.join(', '),
        reason:
          'ContributorRole_ checkboxes were not in the open form; open Click here to select roles if the panel is collapsed',
      },
    ];
  }
  return author.creditRoles
    .filter((role) => role !== 'other')
    .map((role) => {
      const match = boxes.find((box) => box.role === role);
      return {
        fieldId: match?.input.id ?? `${CONTRIBUTOR_ROLE_PREFIX}${role}`,
        label: `Contributor role: ${role}`,
        authorSequence: author.sequence,
        action: match ? (match.input.checked ? 'preserve' : 'fill') : 'unmapped',
        proposedValue: role,
      };
    });
}

function tickCreditRoles(form: Document, author: Author): void {
  if (author.creditRoles.length === 0) return;
  for (const { input, role } of creditRoleCheckboxes(form)) {
    if (!author.creditRoles.includes(role) || input.checked) continue;
    assertSafeMutationTarget(input);
    input.checked = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function isVisible(el: Element): boolean {
  // iframe documents have their own HTMLElement realm, so instanceof fails.
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

function rolesWarningText(root: Document): string {
  const docs = collectReadableDocuments(root).documents.map((f) => f.doc);
  if (!docs.includes(root)) docs.unshift(root);
  for (const doc of docs) {
    const candidates = [
      ...Array.from(
        doc.querySelectorAll(
          '[role="dialog"], .modal, .ui-dialog, [id*="warning"], [id*="Warning"]',
        ),
      ),
      ...Array.from(doc.querySelectorAll('div, section, aside')).filter((el) =>
        /warning|contributor role/i.test(
          `${el.id} ${el.className} ${el.getAttribute('title') ?? ''}`,
        ),
      ),
    ];
    for (const node of candidates) {
      if (!isVisible(node)) continue;
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!ROLES_WARNING_RE.test(text)) continue;
      const match = text.match(
        /please select at least one contributor role[^.!]*/i,
      );
      return match?.[0]?.trim() ?? 'Please select at least one Contributor Role.';
    }
  }
  return '';
}

function visibleCreditRoleCount(form: Document): number {
  return creditRoleCheckboxes(form).filter(({ input }) => isVisible(input))
    .length;
}

async function openRolesPanel(form: Document): Promise<void> {
  // Checkboxes can already be in the DOM and still hidden until EditButton
  // runs ToggleToEditMode.
  if (visibleCreditRoleCount(form) > 0) return;
  const trigger = findSelectRolesControl(form);
  if (!trigger) return;
  assertSafeMutationTarget(trigger);
  trigger.click();
  const started = Date.now();
  while (Date.now() - started < ROLE_WAIT_MS) {
    if (visibleCreditRoleCount(form) > 0) return;
    await delay(ROLE_INTERVAL_MS);
  }
}

function collapseRolesPanel(form: Document): boolean {
  const save = findRolesCollapseSave(form);
  if (!save) return false;
  assertSafeMutationTarget(save);
  save.click();
  return true;
}

function clickControl(el: HTMLElement): void {
  assertSafeMutationTarget(el);
  // Editorial Manager's toolbox and jQuery UI dialogs listen for a full
  // mouse sequence, not only the synthetic click() used by most forms.
  // Do not set `view`: the Warning OK lives on the parent page while Fill
  // runs in the author-form iframe, and that window is the wrong realm.
  const opts = { bubbles: true, cancelable: true, button: 0 };
  el.dispatchEvent(new MouseEvent('pointerdown', opts));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('pointerup', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.click();
}

function describeSaveControl(el: HTMLElement): string {
  return [
    el.getAttribute('data-toolname'),
    el.getAttribute('title'),
    el.className,
    el.id,
  ]
    .filter((part) => part && String(part).trim())
    .join(' · ');
}

function clickAuthorSave(root: Document): boolean {
  hideInstitutionTypeahead(root);
  const save = findAuthorSaveControl(root);
  if (!save) return false;
  clickControl(save);
  return true;
}

/**
 * The Institution autocomplete sits over the toolbox floppy. Hide it, click
 * Save This Author, OK the proceed-anyway alertdialog, and click Save again
 * if the first click only dismissed the list.
 */
async function saveAuthorAndProceed(
  root: Document,
  form: Document,
  givenBefore: string,
): Promise<
  'closed' | 'cleared' | 'warning' | 'issues' | 'timeout' | 'missing'
> {
  hideInstitutionTypeahead(root);
  const park =
    getInput(form, AUTHOR_FIELD_IDS.department) ??
    getInput(form, AUTHOR_FIELD_IDS.city) ??
    getInput(form, AUTHOR_FIELD_IDS.firstName);
  park?.focus();

  for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt += 1) {
    if (saveDialogVisible(root)) {
      await dismissSaveDialogsWithRetries(root);
      const afterOk = await waitAfterAuthorSave(
        root,
        form,
        givenBefore,
        SAVE_ATTEMPT_MS,
      );
      if (afterOk !== 'timeout') return afterOk;
      continue;
    }
    if (!clickAuthorSave(form) && !clickAuthorSave(root)) {
      return attempt === 1 ? 'missing' : 'timeout';
    }
    const outcome = await waitAfterAuthorSave(
      root,
      form,
      givenBefore,
      SAVE_ATTEMPT_MS,
    );
    if (outcome !== 'timeout') return outcome;
  }
  await dismissSaveDialogsWithRetries(root);
  return waitAfterAuthorSave(root, form, givenBefore);
}

async function openAuthorFormFromList(
  root: Document,
  afterSave = false,
  previous?: Author,
): Promise<Document | null> {
  await dismissSaveDialogsWithRetries(root);
  if (!afterSave && authorFormVisible(root)) {
    return findOpenAuthorFormDocument(root);
  }
  for (let attempt = 1; attempt <= ADD_ATTEMPTS; attempt += 1) {
    const add = findAddAnotherAuthorControl(root);
    if (!add) {
      return findOpenAuthorFormDocument(root);
    }
    clickControl(add);
    const opened = await waitForFreshAuthorForm(
      root,
      ADD_ATTEMPT_MS,
      previous,
    );
    if (opened) return opened;
  }
  return waitForFreshAuthorForm(root, ADD_ATTEMPT_MS, previous);
}

function dismissInstitutionWarning(root: Document): boolean {
  hideInstitutionTypeahead(root);
  const ok = findInstitutionWarningOk(root);
  if (!ok) return false;
  clickControl(ok);
  return true;
}

function dismissValidationIssues(root: Document): boolean {
  hideInstitutionTypeahead(root);
  const ok = findValidationIssuesOk(root);
  if (!ok) return false;
  clickControl(ok);
  return true;
}

function dismissWrongFormat(root: Document): boolean {
  hideInstitutionTypeahead(root);
  const ok = findWrongFormatOk(root);
  if (!ok) return false;
  clickControl(ok);
  return true;
}

function dismissRequiredMissing(root: Document): boolean {
  hideInstitutionTypeahead(root);
  const ok = findRequiredMissingOk(root);
  if (!ok) return false;
  clickControl(ok);
  return true;
}

/** Click through the save-state dialogs; never Cancel. */
function dismissSaveDialogs(root: Document): boolean {
  const validation = dismissValidationIssues(root);
  const required = dismissRequiredMissing(root);
  const institution = dismissInstitutionWarning(root);
  const format = dismissWrongFormat(root);
  return validation || required || institution || format;
}

function saveDialogVisible(root: Document): boolean {
  return Boolean(
    findInstitutionWarningOk(root) ||
      findValidationIssuesOk(root) ||
      findRequiredMissingOk(root) ||
      findWrongFormatOk(root),
  );
}

/**
 * The Warning OK is the same jQuery UI widget as Save This Author: the first
 * click often only focuses the button. Hammer OK (never Cancel) up to three
 * times, re-finding it each time so a replaced node is still hit.
 */
async function dismissSaveDialogsWithRetries(root: Document): Promise<boolean> {
  let clicked = false;
  for (let attempt = 1; attempt <= DIALOG_OK_ATTEMPTS; attempt += 1) {
    if (!saveDialogVisible(root)) return clicked;
    if (dismissSaveDialogs(root)) clicked = true;
    await delay(DIALOG_OK_GAP_MS);
  }
  return clicked;
}

function givenNameValue(root: Document): string {
  const form = findOpenAuthorFormDocument(root);
  return form ? readValue(form, AUTHOR_FIELD_IDS.firstName) : '';
}

function countCommittedAuthors(root: Document): number {
  const docs = collectReadableDocuments(root).documents.map((frame) => frame.doc);
  if (!docs.includes(root)) docs.unshift(root);
  for (const doc of docs) {
    const el = doc.getElementById(AUTHORS_COUNT_ID) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (!el || !('value' in el)) continue;
    const n = Number.parseInt(el.value || '0', 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function authorFormVisible(root: Document): boolean {
  return isAuthorFormOpen(root);
}

/**
 * After Save This Author the dialog closes (live) or the fields clear (fixture).
 * Either means the author was committed and Add Another Author can be clicked.
 */
async function waitAfterAuthorSave(
  root: Document,
  form: Document,
  givenNameBefore: string,
  timeoutMs = SAVE_WATCH_MS,
): Promise<'closed' | 'cleared' | 'warning' | 'issues' | 'timeout'> {
  const started = Date.now();
  const dismissed = await dismissSaveDialogsWithRetries(root);
  while (Date.now() - started < timeoutMs) {
    if (rolesWarningText(root) || rolesWarningText(form)) return 'warning';
    const dismissedAgain = dismissSaveDialogs(root);
    if (!authorFormVisible(root)) return 'closed';
    const given = givenNameValue(root);
    if (givenNameBefore && given !== givenNameBefore) return 'cleared';
    if (!given) return 'cleared';
    // PLOS can keep Add New Author open after OK on “Validation found
    // issues” / required-missing. The row is on the list; do not Save again.
    if (dismissed || dismissedAgain) return 'issues';
    await delay(SAVE_INTERVAL_MS);
  }
  return 'timeout';
}

async function waitForAuthorForm(
  root: Document,
  timeoutMs = REOPEN_WAIT_MS,
): Promise<Document | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const form = findOpenAuthorFormDocument(root);
    if (form) return form;
    await delay(SAVE_INTERVAL_MS);
  }
  return null;
}

function formIdentity(form: Document): {
  givenName: string;
  familyName: string;
  email: string;
} {
  return {
    givenName: readValue(form, AUTHOR_FIELD_IDS.firstName),
    familyName: readValue(form, AUTHOR_FIELD_IDS.lastName),
    email: readValue(form, AUTHOR_FIELD_IDS.email),
  };
}

function samePerson(
  portal: { givenName: string; familyName: string; email: string },
  author: Author,
): boolean {
  const given = portal.givenName.trim().toLowerCase();
  const family = portal.familyName.trim().toLowerCase();
  const email = portal.email.trim().toLowerCase();
  if (email && author.email && email === author.email.trim().toLowerCase()) {
    return true;
  }
  return (
    given === author.givenName.trim().toLowerCase() &&
    family === author.familyName.trim().toLowerCase()
  );
}

/**
 * After Add Another Author the new dialog can still show the previous
 * person's name. Wait for a clear form; leftover previous identity is
 * overwritten by the next roster row (Overwrite is off in the popup).
 */
async function waitForFreshAuthorForm(
  root: Document,
  timeoutMs = ADD_ATTEMPT_MS,
  previous?: Author,
): Promise<Document | null> {
  const opened = await waitForAuthorForm(root, timeoutMs);
  if (!opened) return null;
  const started = Date.now();
  const leftoverDeadline = started + 400;
  while (Date.now() - started < timeoutMs) {
    const form = findOpenAuthorFormDocument(root);
    if (!form) break;
    const portal = formIdentity(form);
    if (!portal.givenName && !portal.familyName && !portal.email) return form;
    if (previous && samePerson(portal, previous)) {
      if (Date.now() >= leftoverDeadline) return form;
      await delay(SAVE_INTERVAL_MS);
      continue;
    }
    return form;
  }
  return findOpenAuthorFormDocument(root);
}

function summarize(plans: FieldPlan[]): Omit<
  FillReport,
  'platformId' | 'dryRun' | 'overwrite' | 'plans' | 'warnings' | 'errors'
> {
  return {
    filled: plans.filter((p) => p.action === 'fill').length,
    preserved: plans.filter((p) => p.action === 'preserve').length,
    overwritten: plans.filter((p) => p.action === 'overwrite').length,
    skippedConflicts: plans.filter((p) => p.action === 'skip_conflict').length,
    missingSource: plans.filter((p) => p.action === 'missing_source').length,
    unmapped: plans.filter((p) => p.action === 'unmapped').length,
  };
}

function snapshotManuscript(root: Document): Map<string, string> {
  const values = new Map<string, string>();
  for (const doc of collectReadableDocuments(root).documents.map((f) => f.doc)) {
    for (const id of MANUSCRIPT_FIELD_IDS) {
      const el = doc.getElementById(id) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (el && 'value' in el) values.set(id, el.value);
    }
  }
  return values;
}

function manuscriptChanged(
  root: Document,
  before: Map<string, string>,
): boolean {
  const after = snapshotManuscript(root);
  if (after.size !== before.size) return true;
  for (const [id, value] of after) {
    if (before.get(id) !== value) return true;
  }
  return false;
}

export const editorialManagerAdapter: PlatformAdapter = {
  id: 'editorial-manager',
  label: 'Editorial Manager',

  detect(doc: Document): DetectResult {
    const form = findAuthorFormDocument(doc);
    if (!form) {
      const add = findAddAnotherAuthorControl(doc);
      if (isAuthorsListPage(doc) || add) {
        return {
          platformId: 'editorial-manager',
          confidence: 0.82,
          label: 'Editorial Manager',
          evidence: [
            ...(isAuthorsListPage(doc) ? ['authors-list'] : []),
            ...(add ? [ADD_ANOTHER_AUTHOR_CLASS] : []),
          ],
        };
      }
      return {
        platformId: 'unknown',
        confidence: 0,
        label: 'Unknown',
        evidence: [],
      };
    }
    const evidence: string[] = [
      AUTHOR_FIELD_IDS.firstName,
      AUTHOR_FIELD_IDS.lastName,
      AUTHOR_FIELD_IDS.email,
    ];
    if (form.getElementById(AUTHOR_FIELD_IDS.institution)) {
      evidence.push(AUTHOR_FIELD_IDS.institution);
    }
    return {
      platformId: 'editorial-manager',
      confidence: 0.95,
      label: 'Editorial Manager',
      evidence,
    };
  },

  inspect(doc: Document): InspectReport {
    const form = findAuthorFormDocument(doc);
    const fields: InspectReport['fields'] = [];
    if (form) {
      for (const [label, fieldId] of Object.entries(AUTHOR_FIELD_IDS)) {
        const el = form.getElementById(fieldId);
        if (!el) continue;
        fields.push({
          fieldId,
          tag: el.tagName.toLowerCase(),
          type: el instanceof HTMLInputElement ? el.type : undefined,
          value: '',
          label,
        });
      }
    }
    return {
      platformId: 'editorial-manager',
      authorSlots: form ? 1 : 0,
      linkedAuthorPids: [],
      fields,
      dangerousControls: listDangerousControls(doc),
    };
  },

  fill(doc: Document, roster: Roster, options: FillOptions): FillReport {
    const authors = sortAuthors(roster.authors);
    const warnings: string[] = [];
    const errors: string[] = [];
    const plans: FieldPlan[] = [];
    const form = findAuthorFormDocument(doc);
    const manuscriptBefore = snapshotManuscript(doc);

    // What this portal will refuse to save. Reported rather than blocking, so
    // Corresponding still fills what it can and the person completes the rest.
    const requirements = evaluatePortalRequirements('editorial-manager', roster);

    if (!form) {
      const add = findAddAnotherAuthorControl(doc);
      if (options.dryRun && (isAuthorsListPage(doc) || add)) {
        warnings.push(
          add
            ? 'Authors list is open. Fill will click Add Author, save each author with Save This Author, then click Add Author again.'
            : authorsListGuidance(),
        );
      }
      return {
        platformId: 'editorial-manager',
        dryRun: options.dryRun,
        overwrite: options.overwrite,
        plans,
        filled: 0,
        preserved: 0,
        overwritten: 0,
        skippedConflicts: 0,
        missingSource: 0,
        unmapped: 0,
        warnings,
        errors: add && options.dryRun
          ? []
          : [
              isAuthorsListPage(doc) || add
                ? authorsListGuidance()
                : 'Editorial Manager author form was not found in this window. If Add New Author opened as its own window, click the Corresponding icon while that window is focused. Otherwise open Manuscript Data → Authors (Add/Edit Author) and retry.',
            ],
        requirements,
      };
    }

    if (options.dryRun) {
      const first = authors[0];
      if (first) {
        plans.push(...buildAuthorPlans(form, first, options));
        plans.push(
          applyCorresponding(form, first, options, authorFormConflict(form, first)),
        );
        plans.push(...planCreditRoles(form, first));
      }
      if (authors.length > 1) {
        warnings.push(
          `${authors.length} authors in roster. Preview shows the open author form only; Fill saves one author at a time, then uses Add Another Author when that control is present.`,
        );
      }
    } else {
      for (let index = 0; index < authors.length; index += 1) {
        const author = authors[index]!;
        const currentForm = findOpenAuthorFormDocument(doc) ?? form;
        const conflict = authorFormConflict(currentForm, author);
        const authorPlans = buildAuthorPlans(currentForm, author, options);
        authorPlans.push(
          applyCorresponding(currentForm, author, options, conflict),
        );
        authorPlans.push(...planCreditRoles(currentForm, author));
        plans.push(...authorPlans);
        for (const plan of authorPlans) {
          if (plan.fieldId === AUTHOR_FIELD_IDS.corresponding) continue;
          if (plan.fieldId.startsWith(CONTRIBUTOR_ROLE_PREFIX)) continue;
          applyTextPlan(currentForm, plan, options);
        }
        if (!conflict && !options.dryRun) {
          applyInstitutionFreeText(
            currentForm,
            primaryAffiliation(author)?.institution,
          );
          refillAffiliationDetails(currentForm, author);
        }
        if (!conflict) {
          tickCreditRoles(currentForm, author);
          collapseRolesPanel(currentForm);
        }
        if (conflict) {
          warnings.push(
            `Author ${author.sequence} skipped because the open form already has a conflicting identity.`,
          );
          break;
        }
        hideInstitutionTypeahead(doc);
        const saved = clickAuthorSave(doc);
        dismissSaveDialogs(doc);
        if (authorFormVisible(doc)) clickAuthorSave(doc);
        dismissSaveDialogs(doc);
        if (!saved) {
          warnings.push(
            'Author Save control was not found. Values were written into the open form only.',
          );
          if (index < authors.length - 1) {
            warnings.push(
              `${authors.length - index - 1} remaining authors were not opened.`,
            );
          }
          break;
        }
        if (index < authors.length - 1) {
          const add = findAddAnotherAuthorControl(doc);
          if (!add) {
            warnings.push(
              `${authors.length - index - 1} remaining authors need Add Another Author — that control was not found after Save.`,
            );
            break;
          }
          assertSafeMutationTarget(add);
          add.click();
        }
      }
    }

    if (manuscriptChanged(doc, manuscriptBefore)) {
      errors.push(
        'Manuscript title/abstract fields changed during fill; author-only write is required.',
      );
    }

    const dangerous = listDangerousControls(doc);
    if (dangerous.length) {
      warnings.push(
        `Detected ${dangerous.length} submit/certify-like controls; none were clicked`,
      );
    }

    return {
      platformId: 'editorial-manager',
      dryRun: options.dryRun,
      overwrite: options.overwrite,
      plans,
      ...summarize(plans),
      warnings,
      errors,
      requirements,
    };
  },

  async fillAsync(
    doc: Document,
    roster: Roster,
    options: FillOptions,
  ): Promise<FillReport> {
    if (options.dryRun) return this.fill(doc, roster, options);

    const authors = sortAuthors(roster.authors);
    const warnings: string[] = [];
    const errors: string[] = [];
    const plans: FieldPlan[] = [];
    let form: Document | null =
      findOpenAuthorFormDocument(doc) ?? findAuthorFormDocument(doc);
    const manuscriptBefore = snapshotManuscript(doc);
    const requirements = evaluatePortalRequirements('editorial-manager', roster);
    let openedFreshDialog = false;

    if (!form || !authorFormVisible(doc)) {
      const opened = await openAuthorFormFromList(doc);
      if (opened) {
        form = opened;
        openedFreshDialog = true;
      }
    }

    if (!form || !authorFormVisible(doc)) {
      return {
        ...this.fill(doc, roster, options),
      };
    }

    for (let index = 0; index < authors.length; index += 1) {
      const author = authors[index]!;
      const currentForm: Document =
        findOpenAuthorFormDocument(doc) ?? form;
      const leftoverPrevious =
        openedFreshDialog &&
        Boolean(authors[index - 1]) &&
        samePerson(formIdentity(currentForm), authors[index - 1]!);
      const writeOptions =
        openedFreshDialog || leftoverPrevious
          ? { ...options, overwrite: true }
          : options;
      const conflict =
        !openedFreshDialog && authorFormConflict(currentForm, author);
      const authorPlans = buildAuthorPlans(
        currentForm,
        author,
        writeOptions,
        conflict,
      );
      authorPlans.push(
        applyCorresponding(currentForm, author, writeOptions, conflict),
      );
      plans.push(...authorPlans);
      for (const plan of authorPlans) {
        if (plan.fieldId === AUTHOR_FIELD_IDS.corresponding) continue;
        applyTextPlan(currentForm, plan, writeOptions);
      }
      if (conflict) {
        warnings.push(
          `Author ${author.sequence} skipped because the open form already has a conflicting identity.`,
        );
        break;
      }

      applyInstitutionFreeText(
        currentForm,
        primaryAffiliation(author)?.institution,
      );
      refillAffiliationDetails(currentForm, author);
      await openRolesPanel(currentForm);
      plans.push(...planCreditRoles(currentForm, author));
      tickCreditRoles(currentForm, author);
      collapseRolesPanel(currentForm);

      const givenBefore =
        givenNameValue(doc) || author.givenName || `author-${author.sequence}`;
      const afterSave = await saveAuthorAndProceed(
        doc,
        currentForm,
        givenBefore,
      );
      if (afterSave === 'missing') {
        warnings.push(
          'Save This Author was not found. Values were written into the open form only.',
        );
        if (index < authors.length - 1) {
          warnings.push(
            `${authors.length - index - 1} remaining authors were not opened.`,
          );
        }
        break;
      }
      if (afterSave === 'warning' || afterSave === 'issues') {
        const warning = rolesWarningText(doc) || rolesWarningText(currentForm);
        warnings.push(
          afterSave === 'warning'
            ? `Editorial Manager warned on author ${author.sequence}: ${warning || 'required information is missing'}. Continuing the roster so you can fix highlighted fields.`
            : `Author ${author.sequence} saved with journal validation marks. Continuing the roster; you can fix highlighted fields on the list.`,
        );
      }
      if (afterSave === 'timeout') {
        const save = findAuthorSaveControl(doc);
        warnings.push(
          `Save This Author was clicked for author ${author.sequence} but the form is still open. Clicked ${save ? describeSaveControl(save) : 'Save This Author'}. Continuing the roster; you can fix “Validation found issues” / required-field marks on the list.`,
        );
      }

      if (index < authors.length - 1) {
        await dismissSaveDialogsWithRetries(doc);
        if (authorFormVisible(doc)) {
          // PLOS can keep Add New Author open after a save that still has
          // highlighted issues. The current person is often already on the
          // list (red bang). Overwrite the leftover and fill the next row.
          form = findOpenAuthorFormDocument(doc) ?? currentForm;
          openedFreshDialog = true;
          continue;
        }
        const reopened = await openAuthorFormFromList(doc, true, author);
        if (!reopened) {
          const add = findAddAnotherAuthorControl(doc);
          warnings.push(
            add
              ? 'Add Author was clicked but a new author form did not open in this window. If Editorial Manager opened a separate Add New Author window, click Corresponding there.'
              : `${authors.length - index - 1} remaining authors need Add Author — that control was not found after Save.`,
          );
          break;
        }
        form = reopened;
        openedFreshDialog = true;
        continue;
      }
      openedFreshDialog = false;
    }

    if (manuscriptChanged(doc, manuscriptBefore)) {
      errors.push(
        'Manuscript title/abstract fields changed during fill; author-only write is required.',
      );
    }

    const dangerous = listDangerousControls(doc);
    if (dangerous.length) {
      warnings.push(
        `Detected ${dangerous.length} submit/certify-like controls; none were clicked`,
      );
    }

    return {
      platformId: 'editorial-manager',
      dryRun: options.dryRun,
      overwrite: options.overwrite,
      plans,
      ...summarize(plans),
      warnings,
      errors,
      requirements,
    };
  },

  validate(doc: Document, roster: Roster): ValidateReport {
    const form = findAuthorFormDocument(doc);
    const authors = sortAuthors(roster.authors);
    const issues: ValidateReport['issues'] = [];
    const onAuthorsList =
      isAuthorsListPage(doc) || Boolean(findAddAnotherAuthorControl(doc));
    // After a multi-author fill the Add New Author dialog is closed. That is
    // success — PLOS list banners / red bangs are for the scientist, not a
    // Corresponding hard stop.
    if (!form && !onAuthorsList) {
      issues.push({
        code: 'author_form_missing',
        severity: 'error',
        message: 'Editorial Manager author form was not found after fill.',
      });
    }
    const missingEmail = authors.filter((author) => !author.email).length;
    if (missingEmail) {
      issues.push({
        code: 'missing_email',
        severity: 'warning',
        message: `${missingEmail} roster author(s) have no email.`,
      });
    }
    const committed = countCommittedAuthors(doc);
    const filledLike = committed > 0 ? committed : form ? 1 : 0;
    return {
      platformId: 'editorial-manager',
      ok: issues.every((issue) => issue.severity !== 'error'),
      issues,
      summary: {
        filledLike,
        missingEmail,
        conflicts: 0,
        mismatchedCount: 0,
      },
    };
  },
};
