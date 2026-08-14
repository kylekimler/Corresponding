/**
 * ScholarOne Manuscripts adapter — capture-backed from Bioinformatics
 * (mc.manuscriptcentral.com/bioinformatics, 2026-08-14).
 *
 * Workflow evidence: authors are added via email lookup first
 * (`findAuthorEmailId` + `searchAuthorId`), then AUTHOR_* fields, then a safe
 * Add Author commit. Never clicks Save and Continue / btnSubmit / legal.
 */

import type { Author, Roster } from '@/schema/author';
import { identitiesConflict, matchSelectOption } from '../dom';
import {
  assertSafeMutationTarget,
  isForbiddenControl,
  listDangerousControls,
} from '../safety';
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
  BTN_SUBMIT,
  EMAIL_SEARCH_MODAL_YES,
  FIND_AUTHOR_EMAIL,
  SEARCH_AUTHOR,
  authorCity,
  authorCountry,
  authorDepartment,
  authorPhone,
  authorState,
} from './ids';

const WAIT_TIMEOUT_MS = 10_000;
const LOOKUP_TIMEOUT_MS = 6_000;
const LOOKUP_INTERVAL_MS = 80;
const SETTLE_TIMEOUT_MS = 2_000;
const SETTLE_INTERVAL_MS = 40;
const WRITE_VERIFY_DELAY_MS = 80;

const lastFill = new WeakMap<
  Document,
  { rosterId: string; savedAuthors: number; error?: string }
>();

type FillableKey =
  | 'email'
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

function byId<T extends Element>(doc: Document, id: string): T | null {
  const el = doc.getElementById(id);
  return el as T | null;
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
    {
      key: 'department',
      label: 'Department',
      id: authorDepartment(1),
      value: affiliation?.department,
      required: false,
    },
    {
      key: 'city',
      label: 'City',
      id: authorCity(1),
      value: affiliation?.city,
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
      key: 'country',
      label: 'Country',
      id: authorCountry(1),
      value: affiliation?.country,
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

function controlLabel(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return normalizeText(aria);
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

function commitAuthorControl(doc: Document): HTMLElement | null {
  const form = findAuthorForm(doc);
  const root: ParentNode = form ?? doc;
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>('a, button'),
  ).filter(
    (el) =>
      isVisible(el) &&
      !isForbiddenControl(el) &&
      looksLikeAddAuthor(controlLabel(el)),
  );
  return (
    candidates.find((el) => el.id === 'commit-add-author') ??
    candidates.find((el) => normalizeText(el.textContent) === 'add author') ??
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
        action: 'unmapped',
        proposedValue: affiliation.institution,
        reason:
          'Bioinformatics ScholarOne capture has no institution text input (likely Ringgold/typeahead); left for manual entry',
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
      action: 'unmapped',
      reason:
        'CRediT checkboxes are present but roster v1 has no per-author credit roles to fill',
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

function emailSearchModalVisible(doc: Document): boolean {
  const yes = byId<HTMLElement>(doc, EMAIL_SEARCH_MODAL_YES);
  return !!yes && isVisible(yes);
}

function authorDetailsReady(doc: Document): boolean {
  const first = byId<HTMLInputElement>(doc, AUTHOR_FIRST_NAME);
  return !!first && isVisible(first);
}

/**
 * Email search can re-render the author panel. Wait until the modal or the
 * AUTHOR_* details stabilize — never write names while the lookup is in flight.
 */
async function waitForLookupSettled(doc: Document): Promise<void> {
  const snapshot = () =>
    [
      emailSearchModalVisible(doc) ? 'modal' : '',
      authorDetailsReady(doc) ? 'details' : '',
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
      if (stable >= 2 && (emailSearchModalVisible(doc) || authorDetailsReady(doc))) {
        return;
      }
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

function writeAuthorDetails(
  doc: Document,
  author: Author,
  overwrite: boolean,
): void {
  for (const field of fillableFields(author)) {
    if (!field.value?.trim()) continue;
    const el = byId<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(doc, field.id);
    if (!el || !isVisible(el)) continue;
    writeInput(el, field.value, overwrite);
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
  commit.click();
  await waitFor(
    () => existingAuthorCount(doc) > beforeCount,
    'ScholarOne did not add the author to the list after commit',
  );
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
        await delay(WRITE_VERIFY_DELAY_MS);
        writeAuthorDetails(doc, author, options.overwrite || lookup === 'created');

        await delay(WRITE_VERIFY_DELAY_MS);
        const first = byId<HTMLInputElement>(doc, AUTHOR_FIRST_NAME)?.value.trim();
        const last = byId<HTMLInputElement>(doc, AUTHOR_LAST_NAME)?.value.trim();
        if (first !== author.givenName.trim() || last !== author.familyName.trim()) {
          throw new Error(
            `Author ${author.sequence}: ScholarOne did not accept roster name values after email lookup`,
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
