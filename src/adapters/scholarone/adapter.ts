/**
 * ScholarOne Manuscripts adapter — capture-backed from Bioinformatics
 * (mc.manuscriptcentral.com/bioinformatics, 2026-08-14).
 *
 * Workflow evidence: authors are added via email lookup first
 * (`findAuthorEmailId` + `searchAuthorId`), then AUTHOR_* fields, then a safe
 * Add Author commit. Never clicks Save and Continue / btnSubmit / legal.
 */

import type { Author, Roster } from '@/schema/author';
import {
  creditRoleLabel,
  parseCreditRoles,
  type CreditRole,
} from '@/schema/credit';
import { identitiesConflict, matchSelectOption } from '../dom';
import {
  assertSafeMutationTarget,
  isForbiddenControl,
  listDangerousControls,
} from '../safety';
import { evaluatePortalRequirements } from '../requirements';
import type {
  DetectResult,
  FieldAction,
  FieldPlan,
  FillOptions,
  FillReport,
  InspectReport,
  PlatformAdapter,
  ValidateReport,
} from '../types';
import {
  AUTHOR_EMAIL,
  AUTHOR_FIRST_NAME,
  AUTHOR_LAST_NAME,
  AUTHOR_SALUTATION,
  BTN_SUBMIT,
  EMAIL_SEARCH_MODAL_YES,
  FIND_AUTHOR_EMAIL,
  SEARCH_AUTHOR,
  AFFILIATION_SLOT_INDEXES,
  authorCity,
  authorCountry,
  authorDepartment,
  authorPhone,
  authorState,
  ALERT_BUTTON,
  CREATE_NEW_COAUTHOR_RE,
  CREDIT_ROLE_PREFIX,
  CREATE_VALIDATION_RE,
  GENERIC_ERROR_CLOSE_RE,
  GENERIC_ERROR_RE,
  RINGGOLD_DIALOG_RE,
  RINGGOLD_OKAY_RE,
} from './ids';

const WAIT_TIMEOUT_MS = 10_000;
const LOOKUP_TIMEOUT_MS = 6_000;
const LOOKUP_INTERVAL_MS = 80;
const COMMIT_TIMEOUT_MS = 6_000;
const COMMIT_INTERVAL_MS = 80;
const WRITE_VERIFY_DELAY_MS = 80;
const INSTITUTION_DIALOG_WAIT_MS = 1_200;

const lastFill = new WeakMap<
  Document,
  { rosterId: string; savedAuthors: number; error?: string }
>();

type FillableKey =
  | 'email'
  | 'namePrefix'
  | 'givenName'
  | 'familyName'
  | 'department'
  | 'city'
  | 'state'
  | 'country'
  | 'phone';

interface FillableField {
  key: FillableKey;
  label: string;
  id: string;
  value?: string;
  required: boolean;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isVisible(el: Element): boolean {
  const view = el.ownerDocument.defaultView;
  if (!view) return false;
  for (
    let node: Element | null = el;
    node && node !== el.ownerDocument.documentElement.parentElement;
    node = node.parentElement
  ) {
    if (node instanceof view.HTMLElement && node.hidden) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
    const style = view.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

/**
 * ExtJS comboboxes keep a real input that is aria-hidden and often readonly.
 * Those still hold Institution/City, so write checks must not treat them as
 * absent the way a hidden dialog is absent.
 */
function isOnPage(el: Element): boolean {
  const view = el.ownerDocument.defaultView;
  if (!view) return false;
  for (
    let node: Element | null = el;
    node && node !== el.ownerDocument.documentElement.parentElement;
    node = node.parentElement
  ) {
    if (node instanceof view.HTMLElement && node.hidden) return false;
    const style = view.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

function documentsIn(root: Document): Document[] {
  const docs: Document[] = [];
  const visit = (doc: Document) => {
    if (docs.includes(doc)) return;
    docs.push(doc);
    for (const frame of Array.from(doc.querySelectorAll('iframe, frame'))) {
      try {
        const child = (frame as HTMLIFrameElement).contentDocument;
        if (child) visit(child);
      } catch {
        // Cross-origin; skip.
      }
    }
  };
  visit(root);
  return docs;
}

function byId<T extends Element>(doc: Document, id: string): T | null {
  const el = doc.getElementById(id);
  return el as T | null;
}

/** Visible label text beside a checkbox, used to identify CRediT roles. */
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
  const sibling = input.nextElementSibling;
  return sibling?.textContent?.trim() ?? '';
}

export interface CreditCheckbox {
  input: HTMLInputElement;
  role: CreditRole;
}

/**
 * CRediT checkboxes on the open author form, matched by their visible label.
 * A label that does not resolve to a taxonomy role is skipped rather than
 * guessed, so a role is never ticked on the strength of a near match.
 */
export function creditRoleCheckboxes(doc: Document): CreditCheckbox[] {
  const found: CreditCheckbox[] = [];
  for (const input of Array.from(
    doc.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][id^="${CREDIT_ROLE_PREFIX}"]`,
    ),
  )) {
    const [role] = parseCreditRoles(checkboxLabelText(input));
    if (role && role !== 'other') found.push({ input, role });
  }
  return found;
}

function sortedAuthors(roster: Roster): Author[] {
  return [...roster.authors].sort((a, b) => a.sequence - b.sequence);
}

function primaryAffiliation(author: Author) {
  return (
    author.affiliations.find((item) => item.isPrimary) ?? author.affiliations[0]
  );
}

function fillableFields(author: Author): FillableField[] {
  const affiliation = primaryAffiliation(author);
  return [
    {
      key: 'email',
      label: 'Email Address',
      id: AUTHOR_EMAIL,
      value: author.email,
      required: true,
    },
    {
      key: 'namePrefix',
      label: 'Prefix',
      id: AUTHOR_SALUTATION,
      value: author.namePrefix,
      required: true,
    },
    {
      key: 'givenName',
      label: 'First Name',
      id: AUTHOR_FIRST_NAME,
      value: author.givenName,
      required: true,
    },
    {
      key: 'familyName',
      label: 'Last Name',
      id: AUTHOR_LAST_NAME,
      value: author.familyName,
      required: true,
    },
    // Country first: City is often disabled until a country is chosen.
    {
      key: 'country',
      label: 'Country',
      id: authorCountry(1),
      value: affiliation?.country,
      required: false,
    },
    {
      key: 'state',
      label: 'State',
      id: authorState(1),
      value: affiliation?.state,
      required: false,
    },
    {
      key: 'city',
      label: 'City',
      id: authorCity(1),
      value: affiliation?.city,
      required: true,
    },
    {
      key: 'department',
      label: 'Department',
      id: authorDepartment(1),
      value: affiliation?.department,
      required: false,
    },
    {
      key: 'phone',
      label: 'Phone',
      id: authorPhone(1),
      value: undefined,
      required: false,
    },
  ];
}

function findField<T extends Element>(doc: Document, id: string): T | null {
  for (const scope of documentsIn(doc)) {
    const match = (byId<T>(scope, id) ??
      scope.querySelector<T>(`[name="${id}"]`)) as T | null;
    if (match) return match;
  }
  return null;
}

function labeledInputs(root: Document, labelRe: RegExp): HTMLInputElement[] {
  const found: HTMLInputElement[] = [];
  for (const doc of documentsIn(root)) {
    for (const label of Array.from(doc.querySelectorAll('label'))) {
      const text = (label.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!labelRe.test(text)) continue;
      const forId = label.getAttribute('for');
      const byFor = forId ? doc.getElementById(forId) : null;
      if (isTextInput(byFor)) found.push(byFor);
      const nested = label.querySelector('input');
      if (isTextInput(nested)) found.push(nested);
    }
    // Live City is `aria-label="City:"` with no label[for] (CITY_0, 2026-08-18).
    for (const el of Array.from(doc.querySelectorAll('input'))) {
      if (!isTextInput(el)) continue;
      const aria = (el.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
      if (labelRe.test(aria)) found.push(el);
    }
  }
  return found;
}

function findIndexedField<T extends Element>(
  doc: Document,
  idFor: (index: number) => string,
): T | null {
  for (const index of AFFILIATION_SLOT_INDEXES) {
    const el = findField<T>(doc, idFor(index));
    if (el && isOnPage(el)) return el;
  }
  return null;
}

function inputsWithIndexedName(
  root: Document,
  namePrefix: string,
): HTMLInputElement[] {
  const found: HTMLInputElement[] = [];
  for (const doc of documentsIn(root)) {
    for (const el of Array.from(
      doc.querySelectorAll(
        `input[name^="${namePrefix}"], input[id^="${namePrefix}"]`,
      ),
    )) {
      if (!isTextInput(el)) continue;
      const token = el.getAttribute('name') || el.id;
      if (new RegExp(`^${namePrefix}\\d+$`).test(token)) found.push(el);
    }
  }
  return uniqueInputs(found);
}

function controlIsEmpty(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): boolean {
  if (el instanceof HTMLSelectElement) {
    const text = el.selectedOptions[0]?.text.trim() ?? '';
    return !el.value.trim() || /none selected|^-+$|select\.\.\./i.test(text);
  }
  return !el.value.trim();
}

function requiredRosterErrors(authors: Author[]): string[] {
  const errors: string[] = [];
  for (const author of authors) {
    if (!author.email?.trim()) {
      errors.push(`Author ${author.sequence} is missing Email`);
    }
    if (!author.givenName?.trim()) {
      errors.push(`Author ${author.sequence} is missing First Name`);
    }
    if (!author.familyName?.trim()) {
      errors.push(`Author ${author.sequence} is missing Last Name`);
    }
  }
  return errors;
}

function fieldAction(
  current: string,
  proposed: string | undefined,
  required: boolean,
  overwrite: boolean,
): FieldAction | null {
  if (!proposed?.trim()) return required ? 'missing_source' : null;
  if (!current) return 'fill';
  return overwrite ? 'overwrite' : 'preserve';
}

function existingAuthorCount(doc: Document): number {
  const rows = doc.querySelectorAll('#author-rows tr, table#author-list tbody tr');
  if (rows.length > 0) return rows.length;
  // Capture shows AuthAction / ORDER selects for listed authors.
  return doc.querySelectorAll('select[name="AuthAction"], select#authActionId')
    .length;
}

function findAuthorForm(doc: Document): HTMLElement | null {
  const emailFind = byId(doc, FIND_AUTHOR_EMAIL);
  if (emailFind && isVisible(emailFind)) {
    return (
      emailFind.closest('#author-form, form, [data-author-form], .author-form') ??
      (emailFind.parentElement as HTMLElement)
    );
  }
  return null;
}

function looksLikeAddAuthor(label: string): boolean {
  const words = label.split(' ').filter(Boolean);
  const addIndex = words.indexOf('add');
  if (addIndex === -1) return false;
  return words
    .slice(addIndex + 1, addIndex + 4)
    .some((word) => /^co-?authors?$|^authors?$/.test(word));
}

/**
 * ScholarOne's anchors often carry their label only in title or aria-label and
 * have no text at all (observed 2026-08-17: "Add Author Link", "Institution").
 */
function controlLabel(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return normalizeText(aria);
  const title = el.getAttribute('title');
  if (title?.trim()) return normalizeText(title);
  return normalizeText(el.textContent);
}

function isDisabledControl(el: HTMLElement): boolean {
  return el instanceof HTMLButtonElement
    ? el.disabled
    : el.getAttribute('aria-disabled') === 'true';
}

function addAuthorControl(doc: Document): HTMLElement | null {
  const form = findAuthorForm(doc);
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>('a, button'),
  ).filter(
    (el) =>
      isVisible(el) &&
      !isDisabledControl(el) &&
      !isForbiddenControl(el) &&
      looksLikeAddAuthor(controlLabel(el)) &&
      el.id !== 'commit-add-author' &&
      // Prefer page-level Add Author over the in-form commit control.
      !(form && form.contains(el) && el.id === 'commit-add-author'),
  );
  return (
    candidates.find((el) => el.id === 'open-add-author') ??
    candidates.find((el) => !form || !form.contains(el)) ??
    candidates[0] ??
    null
  );
}

function looksLikeAuthorCommit(el: HTMLElement): boolean {
  const label = controlLabel(el);
  if (looksLikeAddAuthor(label)) return true;
  if (label === 'save') return true;
  if (/add created author/.test(label)) return true;
  return false;
}

function commitAuthorControl(doc: Document): HTMLElement | null {
  const form = findAuthorForm(doc);
  const root: ParentNode = form ?? doc;
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>('a, button'),
  ).filter(
    (el) =>
      isVisible(el) &&
      !isForbiddenControl(el) &&
      looksLikeAuthorCommit(el),
  );
  return (
    candidates.find((el) => el.id === 'commit-add-author') ??
    candidates.find((el) => /add created author/.test(controlLabel(el))) ??
    candidates.find((el) => normalizeText(el.textContent) === 'add author') ??
    candidates.find((el) => controlLabel(el) === 'save') ??
    null
  );
}

function buildPlans(authors: Author[], options: FillOptions): FieldPlan[] {
  const plans: FieldPlan[] = [];
  for (const author of authors) {
    for (const field of fillableFields(author)) {
      const action = fieldAction('', field.value, field.required, options.overwrite);
      if (!action) continue;
      plans.push({
        fieldId: `scholarone.author.${author.sequence}.${field.key}`,
        label: `Author ${author.sequence} ${field.label}`,
        authorSequence: author.sequence,
        action,
        proposedValue: field.value,
        reason:
          action === 'missing_source'
            ? `Roster is missing required ${field.label}`
            : undefined,
      });
    }
    const affiliation = primaryAffiliation(author);
    if (affiliation?.institution) {
      plans.push({
        fieldId: `scholarone.author.${author.sequence}.institution`,
        label: `Author ${author.sequence} Institution`,
        authorSequence: author.sequence,
        action: 'fill',
        proposedValue: affiliation.institution,
        reason:
          'Typeahead combobox: the text is written, and ScholarOne may still ask for a matching institution',
      });
    }
    plans.push({
      fieldId: `scholarone.author.${author.sequence}.corresponding`,
      label: `Author ${author.sequence} corresponding status`,
      authorSequence: author.sequence,
      action: author.isCorresponding ? 'fill' : 'unmapped',
      proposedValue: author.isCorresponding ? 'Assign as Corresponding Author' : undefined,
      reason: author.isCorresponding
        ? 'Assigned via AuthAction after the author is on the list'
        : undefined,
    });
    plans.push({
      fieldId: `scholarone.author.${author.sequence}.creditRoles`,
      label: `Author ${author.sequence} CRediT roles`,
      authorSequence: author.sequence,
      action: author.creditRoles.length > 0 ? 'fill' : 'missing_source',
      proposedValue:
        author.creditRoles.length > 0
          ? author.creditRoles.map(creditRoleLabel).join(', ')
          : undefined,
      reason:
        author.creditRoles.length > 0
          ? undefined
          : 'No contributor roles in the roster; ScholarOne shows the CRediT checkboxes for manual selection',
    });
  }
  return plans;
}

function summarize(plans: FieldPlan[]) {
  return {
    filled: plans.filter((plan) => plan.action === 'fill').length,
    preserved: plans.filter((plan) => plan.action === 'preserve').length,
    overwritten: plans.filter((plan) => plan.action === 'overwrite').length,
    skippedConflicts: plans.filter((plan) => plan.action === 'skip_conflict')
      .length,
    missingSource: plans.filter((plan) => plan.action === 'missing_source')
      .length,
    unmapped: plans.filter((plan) => plan.action === 'unmapped').length,
  };
}

function report(
  doc: Document,
  roster: Roster,
  options: FillOptions,
): FillReport {
  const authors = sortedAuthors(roster);
  const errors = requiredRosterErrors(authors);
  if (!byId(doc, FIND_AUTHOR_EMAIL) && !addAuthorControl(doc)) {
    errors.push(
      'Could not find ScholarOne email lookup or Add Author control. Open the Authors & Institutions step and try again.',
    );
  }
  const plans = buildPlans(authors, options);
  const dangerous = listDangerousControls(doc);
  const warnings: string[] = [
    'ScholarOne requires an email lookup before author fields unlock; Corresponding searches first, then fills roster values.',
  ];
  if (dangerous.length) {
    warnings.push(
      `Detected ${dangerous.length} page-submit or legal controls; none will be clicked`,
    );
  }
  return {
    platformId: 'scholarone',
    dryRun: options.dryRun,
    overwrite: options.overwrite,
    plans,
    ...summarize(plans),
    warnings,
    errors,
    requirements: evaluatePortalRequirements('scholarone', roster),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  predicate: () => boolean,
  message: string,
  timeoutMs = WAIT_TIMEOUT_MS,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await delay(50);
  }
  throw new Error(message);
}

function setNativeValue(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  const win = input.ownerDocument.defaultView;
  if (input instanceof HTMLSelectElement) {
    const matched = matchSelectOption(input, value);
    if (matched) input.value = matched;
    else return;
  } else {
    const proto =
      input instanceof HTMLTextAreaElement
        ? win?.HTMLTextAreaElement.prototype
        : win?.HTMLInputElement.prototype;
    const setter = proto
      ? Object.getOwnPropertyDescriptor(proto, 'value')?.set
      : undefined;
    if (setter) setter.call(input, value);
    else input.value = value;
  }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function writeInput(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
  overwrite: boolean,
): void {
  assertSafeMutationTarget(input);
  if (
    (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) &&
    (input.disabled || input.readOnly)
  ) {
    return;
  }
  if (input instanceof HTMLSelectElement && input.disabled) return;
  const current = input.value.trim();
  if (current && !overwrite) return;
  setNativeValue(input, value);
  input.blur();
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

/**
 * ExtJS Institution/City comboboxes are often readonly and aria-hidden.
 * writeInput would skip them; this types the roster value into the box anyway.
 * Do not blur: ExtJS can reset a free-text value that is not a picker pick.
 * Do not write while disabled: City stays disabled until Country is set.
 */
function writeCombobox(
  input: HTMLInputElement,
  value: string,
  overwrite: boolean,
): void {
  assertSafeMutationTarget(input);
  if (input.disabled) return;
  const current = input.value.trim();
  if (current && !overwrite) return;
  const wasReadOnly = input.readOnly;
  input.readOnly = false;
  input.focus();
  setNativeValue(input, value);
  const last = value.slice(-1) || 'a';
  input.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      data: value,
      inputType: 'insertText',
    }),
  );
  input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: last }));
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: last }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.readOnly = wasReadOnly;
}

/** The "create a new co-author" link shown when no existing account matches. */
function createNewCoauthorControl(doc: Document): HTMLElement | null {
  return (
    Array.from(doc.querySelectorAll<HTMLElement>('a, button')).find(
      (el) =>
        isVisible(el) && CREATE_NEW_COAUTHOR_RE.test(normalizeText(el.textContent)),
    ) ?? null
  );
}

function emailSearchModalVisible(doc: Document): boolean {
  const yes = byId<HTMLElement>(doc, EMAIL_SEARCH_MODAL_YES);
  return !!yes && isVisible(yes);
}

function authorDetailsReady(doc: Document): boolean {
  const first = byId<HTMLInputElement>(doc, AUTHOR_FIRST_NAME);
  return !!first && isVisible(first);
}

async function waitForCreateFormEmail(doc: Document): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 1_200) {
    const email = findField<HTMLInputElement>(doc, AUTHOR_EMAIL);
    if (email && isVisible(email)) return;
    await delay(50);
  }
}

/**
 * Email search can re-render the author panel. Wait until the modal or the
 * AUTHOR_* details stabilize — never write names while the lookup is in flight.
 */
async function waitForLookupSettled(doc: Document): Promise<void> {
  const settled = () =>
    emailSearchModalVisible(doc) ||
    authorDetailsReady(doc) ||
    // An unknown email settles on the inline "create a new co-author" banner.
    createNewCoauthorControl(doc) !== null;

  const snapshot = () =>
    [
      emailSearchModalVisible(doc) ? 'modal' : '',
      authorDetailsReady(doc) ? 'details' : '',
      createNewCoauthorControl(doc) ? 'banner' : '',
      byId<HTMLInputElement>(doc, AUTHOR_EMAIL)?.value ?? '',
      byId<HTMLInputElement>(doc, AUTHOR_FIRST_NAME)?.value ?? '',
      byId<HTMLInputElement>(doc, AUTHOR_LAST_NAME)?.value ?? '',
    ].join('#');

  let previous = snapshot();
  let stable = 0;
  const started = Date.now();
  while (Date.now() - started < LOOKUP_TIMEOUT_MS) {
    await delay(LOOKUP_INTERVAL_MS);
    const next = snapshot();
    if (next === previous) {
      stable += 1;
      if (stable >= 2 && settled()) return;
    } else {
      stable = 0;
      previous = next;
    }
  }
  throw new Error(
    'ScholarOne email search did not finish unlocking author fields',
  );
}

async function ensureAuthorFormOpen(doc: Document): Promise<void> {
  if (byId(doc, FIND_AUTHOR_EMAIL) && isVisible(byId(doc, FIND_AUTHOR_EMAIL)!)) {
    return;
  }
  const add = addAuthorControl(doc);
  if (!add) {
    throw new Error('Could not find ScholarOne Add Author control');
  }
  assertSafeMutationTarget(add);
  add.click();
  await waitFor(
    () => {
      const find = byId(doc, FIND_AUTHOR_EMAIL);
      return !!find && isVisible(find);
    },
    'ScholarOne Add Author did not reveal the email lookup field',
  );
}

async function searchByEmail(doc: Document, email: string): Promise<'created' | 'linked'> {
  const find = byId<HTMLInputElement>(doc, FIND_AUTHOR_EMAIL);
  const search = byId<HTMLElement>(doc, SEARCH_AUTHOR);
  if (!find || !search) {
    throw new Error('ScholarOne email lookup controls are missing');
  }
  assertSafeMutationTarget(find);
  assertSafeMutationTarget(search);
  writeInput(find, email, true);
  search.click();
  await waitForLookupSettled(doc);

  if (emailSearchModalVisible(doc)) {
    const yes = byId<HTMLElement>(doc, EMAIL_SEARCH_MODAL_YES);
    if (!yes) throw new Error('ScholarOne email search modal Yes control missing');
    assertSafeMutationTarget(yes);
    yes.click();
    await waitFor(
      () => authorDetailsReady(doc),
      'ScholarOne did not open author details after Create New confirmation',
    );
    return 'created';
  }

  // An unknown email produces an inline banner instead of the modal, offering
  // "create a new co-author" as a link.
  const createLink = createNewCoauthorControl(doc);
  if (createLink) {
    assertSafeMutationTarget(createLink);
    createLink.click();
    await waitFor(
      () => authorDetailsReady(doc),
      'ScholarOne did not open author details after choosing to create a new co-author',
    );
    return 'created';
  }

  await waitFor(
    () => authorDetailsReady(doc),
    'ScholarOne did not show author details after email search',
  );
  return 'linked';
}

function readAuthorIdentity(doc: Document): {
  email?: string;
  givenName?: string;
  familyName?: string;
} {
  return {
    email: byId<HTMLInputElement>(doc, AUTHOR_EMAIL)?.value,
    givenName: byId<HTMLInputElement>(doc, AUTHOR_FIRST_NAME)?.value,
    familyName: byId<HTMLInputElement>(doc, AUTHOR_LAST_NAME)?.value,
  };
}

function isTextInput(el: Element | null): el is HTMLInputElement {
  return !!el && el.tagName.toLowerCase() === 'input';
}

function uniqueInputs(inputs: HTMLInputElement[]): HTMLInputElement[] {
  return [...new Set(inputs)];
}

function institutionInputs(root: Document): HTMLInputElement[] {
  const found = inputsWithIndexedName(root, 'AUTHOR_INSTITUTION_');
  found.push(...labeledInputs(root, /^\s*institution\b/i));
  return uniqueInputs(found).filter(isOnPage);
}

function cityInputs(root: Document): HTMLInputElement[] {
  const found = inputsWithIndexedName(root, 'CITY_');
  found.push(...labeledInputs(root, /^\s*city\b/i));
  return uniqueInputs(found).filter(isOnPage);
}

function missingCreateRequirements(
  doc: Document,
  author: Author,
): string[] {
  const missing: string[] = [];
  const prefix = findField<HTMLSelectElement>(doc, AUTHOR_SALUTATION);
  if (prefix && isVisible(prefix) && controlIsEmpty(prefix)) {
    missing.push(
      author.namePrefix?.trim()
        ? 'Prefix is required.'
        : 'Prefix is required. Add a Prefix/Salutation column to the roster (Dr., Prof., Mx, Ms., Mr., …).',
    );
  }
  const institution = institutionInputs(doc)[0];
  if (institution && controlIsEmpty(institution)) {
    missing.push('Institution is a required field');
  }
  const city = cityInputs(doc)[0];
  if (city && controlIsEmpty(city)) {
    missing.push('City is a required field');
  }
  return missing;
}

function createValidationText(doc: Document): string {
  const nodes = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '#create-validation, [role="alert"], .error, .x-form-invalid, p, li, div',
    ),
  );
  for (const node of nodes) {
    if (!isVisible(node)) continue;
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    // Skip the whole form: hidden banner text still appears in ancestor
    // textContent. The live banner is a short red box.
    if (text.length > 400 || text.length < 20) continue;
    if (CREATE_VALIDATION_RE.test(text)) return text;
  }
  return '';
}

async function writeAuthorDetails(
  doc: Document,
  author: Author,
  overwrite: boolean,
): Promise<void> {
  for (const field of fillableFields(author)) {
    if (field.key === 'city') continue;
    if (!field.value?.trim()) continue;
    const el =
      field.key === 'country'
        ? findIndexedField<HTMLInputElement | HTMLSelectElement>(
            doc,
            authorCountry,
          )
        : field.key === 'state'
          ? findIndexedField<HTMLInputElement | HTMLSelectElement>(
              doc,
              authorState,
            )
          : field.key === 'department'
            ? findIndexedField<HTMLInputElement>(doc, authorDepartment)
            : findField<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
              >(doc, field.id);
    if (!el || !isOnPage(el)) continue;
    // Country/state can also be ExtJS inputs (readonly). City is applied
    // after Country so the box is no longer disabled.
    if (
      el instanceof HTMLInputElement &&
      (field.key === 'country' || field.key === 'state')
    ) {
      writeCombobox(el, field.value, overwrite);
    } else {
      writeInput(el, field.value, overwrite);
    }
    if (field.key === 'country') {
      await waitForCityWritable(doc);
    }
  }
  applyCity(doc, author, overwrite);
  applyCreditRoles(doc, author);
  applyInstitution(doc, author, overwrite);
  await settleInstitutionDialogs(doc);
}

async function waitForCityWritable(root: Document): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 2_000) {
    if (cityInputs(root).some((input) => !input.disabled)) return;
    await delay(LOOKUP_INTERVAL_MS);
  }
}

function orderedAffiliations(author: Author) {
  const primary = primaryAffiliation(author);
  const rest = author.affiliations.filter((item) => item !== primary);
  return primary ? [primary, ...rest] : rest;
}

function applyCity(
  root: Document,
  author: Author,
  overwrite: boolean,
): void {
  const inputs = cityInputs(root);
  const values = orderedAffiliations(author).map((item) => item.city);
  inputs.forEach((input, index) => {
    const desired = (values[index] ?? values[0])?.trim();
    if (!desired) return;
    writeCombobox(input, desired, overwrite);
  });
}

/**
 * Institution is a typeahead located by name (`AUTHOR_INSTITUTION_0` or `_1`)
 * or by its Institution / aria-label. ExtJS marks the box readonly/aria-hidden;
 * write anyway, then dismiss Ringgold or the generic error if that lookup fires.
 * Extra boxes already on the page (Add Another Institution) get later roster
 * affiliations; we do not click that control without a captured selector.
 */
function applyInstitution(
  doc: Document,
  author: Author,
  overwrite: boolean,
): void {
  const inputs = institutionInputs(doc);
  const values = orderedAffiliations(author).map((item) => item.institution);
  inputs.forEach((input, index) => {
    const institution = (values[index] ?? values[0])?.trim();
    if (!institution) return;
    writeCombobox(input, institution, overwrite);
  });
}

function dialogLabel(el: HTMLElement): string {
  return (
    el.textContent ??
    el.getAttribute('value') ??
    el.getAttribute('aria-label') ??
    ''
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function findDialogWithText(doc: Document, textRe: RegExp): HTMLElement | null {
  const nodes = doc.querySelectorAll<HTMLElement>(
    '[role="dialog"], .modal, .ui-dialog, .x-window, .x-message-box, .x-window-dlg',
  );
  for (const node of nodes) {
    if (!isVisible(node)) continue;
    const text = (node.textContent ?? '').replace(/\s+/g, ' ');
    if (textRe.test(text)) return node;
  }
  // Headings only — do not scan every div, or a hidden dialog's text inside
  // the page root would match after the dialog is dismissed.
  for (const node of Array.from(
    doc.querySelectorAll<HTMLElement>('h1, h2, h3, h4, p, legend'),
  )) {
    if (!isVisible(node)) continue;
    const text = (node.textContent ?? '').replace(/\s+/g, ' ');
    if (text.length > 400 || !textRe.test(text)) continue;
    return (
      (node.closest(
        '[role="dialog"], .modal, .ui-dialog, .x-window, .x-message-box',
      ) as HTMLElement | null) ??
      node.parentElement
    );
  }
  return null;
}

function findButtonIn(
  scope: HTMLElement,
  labelRe: RegExp,
): HTMLElement | null {
  const labeled = Array.from(
    scope.querySelectorAll<HTMLElement>(
      'button, [role="button"], a, input[type="button"], .x-btn',
    ),
  ).find((el) => {
    if (!isVisible(el)) return false;
    return labelRe.test(dialogLabel(el));
  });
  if (!labeled) return null;
  return (
    labeled.closest('button') ??
    labeled.closest('[role="button"]') ??
    labeled.closest('a') ??
    labeled
  );
}

/** Proceed control on “Institution not connected to Ringgold”. */
export function findRinggoldOkay(doc: Document): HTMLElement | null {
  const dialog = findDialogWithText(doc, RINGGOLD_DIALOG_RE);
  if (!dialog) return null;
  return findButtonIn(dialog, RINGGOLD_OKAY_RE);
}

/** Close on the generic “An error has occurred. Please try again.” dialog. */
export function findGenericErrorClose(doc: Document): HTMLElement | null {
  const dialog = findDialogWithText(doc, GENERIC_ERROR_RE);
  if (!dialog) return null;
  return findButtonIn(dialog, GENERIC_ERROR_CLOSE_RE);
}

function dismissRinggoldOkay(doc: Document): boolean {
  const okay = findRinggoldOkay(doc);
  if (!okay) return false;
  assertSafeMutationTarget(okay);
  okay.click();
  return true;
}

function dismissGenericError(doc: Document): boolean {
  const close = findGenericErrorClose(doc);
  if (!close) return false;
  assertSafeMutationTarget(close);
  close.click();
  return true;
}

function dismissScholarOneProceedDialogs(doc: Document): boolean {
  const ringgold = dismissRinggoldOkay(doc);
  const error = dismissGenericError(doc);
  return ringgold || error;
}

function isDismissibleScholarOneAlert(text: string): boolean {
  return RINGGOLD_DIALOG_RE.test(text) || GENERIC_ERROR_RE.test(text);
}

async function settleInstitutionDialogs(doc: Document): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < INSTITUTION_DIALOG_WAIT_MS) {
    dismissScholarOneProceedDialogs(doc);
    const ringgold = findDialogWithText(doc, RINGGOLD_DIALOG_RE);
    const error = findDialogWithText(doc, GENERIC_ERROR_RE);
    if (!ringgold && !error && Date.now() - started > 240) return;
    await delay(LOOKUP_INTERVAL_MS);
  }
  dismissScholarOneProceedDialogs(doc);
}

/**
 * Tick the CRediT boxes this author declared. Only ticks: a role a person
 * already selected is never cleared, and unmatched labels are left alone.
 */
function applyCreditRoles(doc: Document, author: Author): void {
  if (author.creditRoles.length === 0) return;
  for (const { input, role } of creditRoleCheckboxes(doc)) {
    if (!isVisible(input) || input.disabled) continue;
    if (!author.creditRoles.includes(role) || input.checked) continue;
    assertSafeMutationTarget(input);
    input.checked = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

async function commitAuthor(doc: Document, beforeCount: number): Promise<void> {
  const commit = commitAuthorControl(doc);
  if (!commit) {
    throw new Error(
      'Could not find ScholarOne Add Author commit control after filling details',
    );
  }
  assertSafeMutationTarget(commit);
  dismissScholarOneProceedDialogs(doc);
  const alertBefore = portalAlertText(doc);
  commit.click();
  try {
    await waitForAuthorCommit(doc, beforeCount, alertBefore);
  } catch (error) {
    // Retry only when Ringgold / generic-error was in the way. A real
    // alertButton refusal (contributor roles, etc.) is left open.
    const dismissed = dismissScholarOneProceedDialogs(doc);
    if (existingAuthorCount(doc) > beforeCount) return;
    if (!dismissed) throw error;
    commit.click();
    await waitForAuthorCommit(doc, beforeCount, portalAlertText(doc));
  }
}

/**
 * ScholarOne refuses some saves through an alert modal (its own "Ok" dialog)
 * rather than by rejecting the field. Report the portal's wording instead of
 * waiting out the timeout, and leave the modal for the person to dismiss.
 */
function portalAlertText(doc: Document): string {
  const button = byId<HTMLElement>(doc, ALERT_BUTTON);
  if (!button || !isVisible(button)) return '';
  const container =
    button.closest<HTMLElement>('[role="dialog"], .modal, .ui-dialog') ??
    button.parentElement;
  if (!container) return '';
  // Keep the portal's own casing: this text is shown to the person verbatim.
  const text = (container.textContent ?? '').replace(/\s+/g, ' ').trim();
  return text.replace(/\bok\b\s*$/i, '').trim();
}

async function waitForAuthorCommit(
  doc: Document,
  beforeCount: number,
  alertBefore: string,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < COMMIT_TIMEOUT_MS) {
    if (existingAuthorCount(doc) > beforeCount) return;
    dismissScholarOneProceedDialogs(doc);
    const validation = createValidationText(doc);
    if (validation) {
      throw new Error(`ScholarOne reported: ${validation}`);
    }
    const alertNow = portalAlertText(doc);
    if (
      alertNow &&
      alertNow !== alertBefore &&
      !isDismissibleScholarOneAlert(alertNow)
    ) {
      throw new Error(`ScholarOne reported: ${alertNow}`);
    }
    await delay(COMMIT_INTERVAL_MS);
  }
  throw new Error('ScholarOne did not add the author to the list after commit');
}

function assignCorresponding(doc: Document, email: string): boolean {
  const selects = Array.from(
    doc.querySelectorAll<HTMLSelectElement>(
      'select[name="AuthAction"], select#authActionId',
    ),
  ).filter(isVisible);
  for (const select of selects) {
    const rowEmail =
      select.dataset.authorEmail ??
      select.closest('tr')?.querySelector('td:nth-child(3)')?.textContent ??
      '';
    if (normalizeText(rowEmail) !== normalizeText(email)) continue;
    assertSafeMutationTarget(select);
    const matched = matchSelectOption(select, 'Assign as Corresponding Author');
    if (!matched) return false;
    select.value = matched;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

export const scholarOneAdapter: PlatformAdapter = {
  id: 'scholarone',
  label: 'ScholarOne Manuscripts',

  detect(doc: Document): DetectResult {
    const evidence: string[] = [];
    let score = 0;

    if (byId(doc, FIND_AUTHOR_EMAIL)) {
      evidence.push(FIND_AUTHOR_EMAIL);
      score += 0.35;
    }
    if (byId(doc, SEARCH_AUTHOR)) {
      evidence.push(SEARCH_AUTHOR);
      score += 0.2;
    }
    if (byId(doc, AUTHOR_FIRST_NAME) || byId(doc, AUTHOR_LAST_NAME)) {
      evidence.push('AUTHOR_FIRST/LAST_NAME');
      score += 0.25;
    }
    if (byId(doc, AUTHOR_EMAIL)) {
      evidence.push(AUTHOR_EMAIL);
      score += 0.15;
    }
    const blob = normalizeText(doc.body?.innerHTML ?? '');
    if (blob.includes('scholarone') || blob.includes('manuscriptcentral')) {
      evidence.push('manuscriptcentral');
      score += 0.2;
    }
    if (byId(doc, BTN_SUBMIT)?.getAttribute('name') === 'AUTHOR_REVIEWERS') {
      evidence.push('AUTHOR_REVIEWERS');
      score += 0.1;
    }
    if (addAuthorControl(doc)) {
      evidence.push('Add Author');
      score += 0.1;
    }

    const confidence = Math.min(1, score);
    return {
      platformId: confidence >= 0.5 ? 'scholarone' : 'unknown',
      confidence,
      label: confidence >= 0.5 ? 'ScholarOne Manuscripts' : 'Unknown',
      evidence,
    };
  },

  inspect(doc: Document): InspectReport {
    const fields: InspectReport['fields'] = [];
    const ids = [
      FIND_AUTHOR_EMAIL,
      AUTHOR_EMAIL,
      AUTHOR_SALUTATION,
      AUTHOR_FIRST_NAME,
      AUTHOR_LAST_NAME,
      authorDepartment(1),
      authorCity(1),
      authorState(1),
      authorCountry(1),
      authorPhone(1),
    ];
    for (const id of ids) {
      const el = byId(doc, id);
      if (!el) continue;
      fields.push({
        fieldId: id,
        tag: el.tagName.toLowerCase(),
        type: el instanceof HTMLInputElement ? el.type : undefined,
        value: '',
        label: id,
      });
    }
    return {
      platformId: 'scholarone',
      authorSlots: Math.max(1, existingAuthorCount(doc)),
      numAuthorsField: existingAuthorCount(doc),
      linkedAuthorPids: [],
      fields,
      dangerousControls: listDangerousControls(doc),
    };
  },

  fill(doc: Document, roster: Roster, options: FillOptions): FillReport {
    return report(doc, roster, options);
  },

  async fillAsync(
    doc: Document,
    roster: Roster,
    options: FillOptions,
  ): Promise<FillReport> {
    const preflight = report(doc, roster, options);
    if (options.dryRun || preflight.errors.length > 0) return preflight;

    // Safety: never allow accidental submit clicks via this path.
    const submit = byId(doc, BTN_SUBMIT);
    if (submit && isForbiddenControl(submit) === false) {
      // btnSubmit with Save and Continue is still forbidden by text patterns.
    }

    const authors = sortedAuthors(roster);
    let savedAuthors = 0;
    let createdViaModal = 0;
    let linkedLookups = 0;
    let correspondingAssigned = 0;
    const warnings = [...preflight.warnings];

    try {
      for (const author of authors) {
        const email = author.email!.trim();
        await ensureAuthorFormOpen(doc);
        const before = existingAuthorCount(doc);

        const lookup = await searchByEmail(doc, email);
        if (lookup === 'created') createdViaModal += 1;
        else linkedLookups += 1;

        // If ScholarOne attached a linked account, refuse identity conflicts.
        const portalIdentity = readAuthorIdentity(doc);
        const linked =
          lookup === 'linked' &&
          Boolean(
            portalIdentity.email ||
              portalIdentity.givenName ||
              portalIdentity.familyName,
          );
        if (
          linked &&
          identitiesConflict(portalIdentity, author, { linkedPid: true })
        ) {
          throw new Error(
            `Author ${author.sequence}: ScholarOne linked account conflicts with the roster (email/name). Resolve in the portal, then retry.`,
          );
        }

        // Roster values win after lookup settles (never write during search).
        // The create-author form can paint First Name before E-Mail; wait
        // briefly so the email box is written when it is present.
        await waitForCreateFormEmail(doc);
        await delay(WRITE_VERIFY_DELAY_MS);
        await writeAuthorDetails(doc, author, options.overwrite || lookup === 'created');

        await delay(WRITE_VERIFY_DELAY_MS);
        const first = findField<HTMLInputElement>(doc, AUTHOR_FIRST_NAME)?.value.trim();
        const last = findField<HTMLInputElement>(doc, AUTHOR_LAST_NAME)?.value.trim();
        if (first !== author.givenName.trim() || last !== author.familyName.trim()) {
          throw new Error(
            `Author ${author.sequence}: ScholarOne did not accept roster name values after email lookup`,
          );
        }

        let gaps = missingCreateRequirements(doc, author);
        if (gaps.length > 0) {
          await writeAuthorDetails(doc, author, true);
          await delay(WRITE_VERIFY_DELAY_MS);
          gaps = missingCreateRequirements(doc, author);
        }
        if (gaps.length > 0) {
          throw new Error(
            `ScholarOne will not save author ${author.sequence}: ${gaps.join(' ')} Please fix the following issues then click Save — Corresponding did not click Save & Continue.`,
          );
        }

        await commitAuthor(doc, before);
        savedAuthors += 1;

        if (author.isCorresponding) {
          if (assignCorresponding(doc, email)) correspondingAssigned += 1;
          else {
            warnings.push(
              `Author ${author.sequence}: could not assign Corresponding via AuthAction; set it manually`,
            );
          }
        }
      }

      lastFill.set(doc, { rosterId: roster.id, savedAuthors });
      return {
        ...preflight,
        dryRun: false,
        warnings: [
          ...warnings,
          `Saved ${savedAuthors} ScholarOne author${savedAuthors === 1 ? '' : 's'}; Save and Continue remained untouched`,
          ...(createdViaModal > 0
            ? [
                `Created ${createdViaModal} new ScholarOne author record${createdViaModal === 1 ? '' : 's'} after email search found no match`,
              ]
            : []),
          ...(linkedLookups > 0
            ? [
                `Email search matched ${linkedLookups} existing ScholarOne record${linkedLookups === 1 ? '' : 's'}; roster values were applied when identity agreed`,
              ]
            : []),
          ...(correspondingAssigned > 0
            ? [
                `Assigned corresponding author on ${correspondingAssigned} row${correspondingAssigned === 1 ? '' : 's'} via AuthAction`,
              ]
            : []),
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastFill.set(doc, { rosterId: roster.id, savedAuthors, error: message });
      throw new Error(
        `ScholarOne Fill stopped after ${savedAuthors} author${savedAuthors === 1 ? '' : 's'}: ${message}`,
        { cause: error },
      );
    }
  },

  validate(doc: Document, roster: Roster): ValidateReport {
    const authors = sortedAuthors(roster);
    const state = lastFill.get(doc);
    const observed = existingAuthorCount(doc);
    const filledLike =
      state?.rosterId === roster.id ? state.savedAuthors : observed;
    const issues: ValidateReport['issues'] = [];
    const missingEmail = authors.filter((author) => !author.email).length;

    if (filledLike !== authors.length) {
      issues.push({
        code: 'author_count_mismatch',
        severity: 'error',
        message: `ScholarOne lists ${filledLike} authors but the roster contains ${authors.length}`,
      });
    }
    if (state?.error) {
      issues.push({
        code: 'modal_fill_failed',
        severity: 'error',
        message: state.error,
      });
    }
    return {
      platformId: 'scholarone',
      ok: issues.length === 0 && missingEmail === 0,
      issues,
      summary: {
        filledLike,
        missingEmail,
        conflicts: 0,
        mismatchedCount: filledLike === authors.length ? 0 : 1,
      },
    };
  },
};
