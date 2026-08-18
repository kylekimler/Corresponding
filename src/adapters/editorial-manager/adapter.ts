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
  findAuthorSaveControl,
  findInstitutionSuggestion,
  findInstitutionWarningOk,
  findValidationIssuesOk,
  institutionTypeaheadOpen,
  findRolesCollapseSave,
  findSelectRolesControl,
  isAuthorsListPage,
} from './documents';
import {
  ADD_ANOTHER_AUTHOR_CLASS,
  AUTHOR_FIELD_IDS,
  CONTRIBUTOR_ROLE_PREFIX,
  MANUSCRIPT_FIELD_IDS,
  ROLES_WARNING_RE,
} from './ids';

const ROLE_WAIT_MS = 2_000;
const ROLE_INTERVAL_MS = 40;
const TYPEAHEAD_WAIT_MS = 1_200;
const SAVE_WATCH_MS = 6_000;
const SAVE_INTERVAL_MS = 40;
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
): FieldPlan[] {
  const conflict = authorFormConflict(form, author);
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
  // Institution is a typeahead: blur here closes the list before a match can
  // be chosen. Zipcode (and other Knockout fields) update on blur.
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

/**
 * Institution is Ringgold/typeahead. Type (do not only set+blur), wait for a
 * suggestion whose text equals the roster name, click only that. If nothing
 * matches, leave the typed value for the proceed-anyway warning.
 */
async function applyInstitutionTypeahead(
  root: Document,
  form: Document,
  institution: string | undefined,
): Promise<boolean> {
  const desired = institution?.trim();
  if (!desired) return false;
  const input = getInput(form, AUTHOR_FIELD_IDS.institution);
  if (!input || input.tagName.toLowerCase() !== 'input') return false;
  typeIntoInstitution(input as HTMLInputElement, desired);
  const started = Date.now();
  while (Date.now() - started < TYPEAHEAD_WAIT_MS) {
    const suggestion = findInstitutionSuggestion(root, desired);
    if (suggestion) {
      clickControl(suggestion);
      return true;
    }
    const open = institutionTypeaheadOpen(root);
    if (!open && Date.now() - started > 600) break;
    await delay(ROLE_INTERVAL_MS);
  }
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  return false;
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
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
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
  const save = findAuthorSaveControl(root);
  if (!save) return false;
  clickControl(save);
  return true;
}

async function openAuthorFormFromList(
  root: Document,
): Promise<Document | null> {
  if (authorFormVisible(root)) return findAuthorFormDocument(root);
  const add = findAddAnotherAuthorControl(root);
  if (!add) return null;
  clickControl(add);
  return waitForAuthorForm(root);
}

function dismissInstitutionWarning(root: Document): boolean {
  const ok = findInstitutionWarningOk(root);
  if (!ok) return false;
  clickControl(ok);
  return true;
}

function dismissValidationIssues(root: Document): boolean {
  const ok = findValidationIssuesOk(root);
  if (!ok) return false;
  clickControl(ok);
  return true;
}

/** Click through the save-state dialogs; never Cancel. */
function dismissSaveDialogs(root: Document): boolean {
  const validation = dismissValidationIssues(root);
  const institution = dismissInstitutionWarning(root);
  return validation || institution;
}

function givenNameValue(root: Document): string {
  const form = findAuthorFormDocument(root);
  return form ? readValue(form, AUTHOR_FIELD_IDS.firstName) : '';
}

function authorFormVisible(root: Document): boolean {
  const form = findAuthorFormDocument(root);
  const first = form?.getElementById(AUTHOR_FIELD_IDS.firstName);
  return Boolean(first && isVisible(first));
}

/**
 * After Save This Author the dialog closes (live) or the fields clear (fixture).
 * Either means the author was committed and Add Another Author can be clicked.
 */
async function waitAfterAuthorSave(
  root: Document,
  form: Document,
  givenNameBefore: string,
): Promise<'closed' | 'cleared' | 'warning' | 'timeout'> {
  const started = Date.now();
  while (Date.now() - started < SAVE_WATCH_MS) {
    if (rolesWarningText(root) || rolesWarningText(form)) return 'warning';
    dismissSaveDialogs(root);
    if (!authorFormVisible(root)) return 'closed';
    const given = givenNameValue(root);
    if (givenNameBefore && given !== givenNameBefore) return 'cleared';
    if (!given) return 'cleared';
    await delay(SAVE_INTERVAL_MS);
  }
  return 'timeout';
}

async function waitForAuthorForm(root: Document): Promise<Document | null> {
  const started = Date.now();
  while (Date.now() - started < REOPEN_WAIT_MS) {
    const form = findAuthorFormDocument(root);
    if (form && authorFormVisible(root)) return form;
    await delay(SAVE_INTERVAL_MS);
  }
  return null;
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
        const currentForm = findAuthorFormDocument(doc) ?? form;
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
          const institution = primaryAffiliation(author)?.institution;
          const input = getInput(currentForm, AUTHOR_FIELD_IDS.institution);
          if (institution && input && input.tagName.toLowerCase() === 'input') {
            typeIntoInstitution(input as HTMLInputElement, institution);
            const suggestion = findInstitutionSuggestion(doc, institution);
            if (suggestion) clickControl(suggestion);
            else {
              input.dispatchEvent(new Event('change', { bubbles: true }));
              input.dispatchEvent(new Event('blur', { bubbles: true }));
            }
          }
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
        const saved = clickAuthorSave(doc);
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
    let form = findAuthorFormDocument(doc);
    const manuscriptBefore = snapshotManuscript(doc);
    const requirements = evaluatePortalRequirements('editorial-manager', roster);

    if (!form || !authorFormVisible(doc)) {
      const opened = await openAuthorFormFromList(doc);
      if (opened) form = opened;
    }

    if (!form || !authorFormVisible(doc)) {
      return {
        ...this.fill(doc, roster, options),
      };
    }

    for (let index = 0; index < authors.length; index += 1) {
      const author = authors[index]!;
      const currentForm = findAuthorFormDocument(doc) ?? form;
      const conflict = authorFormConflict(currentForm, author);
      const authorPlans = buildAuthorPlans(currentForm, author, options);
      authorPlans.push(
        applyCorresponding(currentForm, author, options, conflict),
      );
      plans.push(...authorPlans);
      for (const plan of authorPlans) {
        if (plan.fieldId === AUTHOR_FIELD_IDS.corresponding) continue;
        applyTextPlan(currentForm, plan, options);
      }
      if (conflict) {
        warnings.push(
          `Author ${author.sequence} skipped because the open form already has a conflicting identity.`,
        );
        break;
      }

      await applyInstitutionTypeahead(
        doc,
        currentForm,
        primaryAffiliation(author)?.institution,
      );
      await openRolesPanel(currentForm);
      plans.push(...planCreditRoles(currentForm, author));
      tickCreditRoles(currentForm, author);
      collapseRolesPanel(currentForm);

      const givenBefore =
        givenNameValue(doc) || author.givenName || `author-${author.sequence}`;
      const saved = clickAuthorSave(doc);
      if (!saved) {
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

      const afterSave = await waitAfterAuthorSave(doc, currentForm, givenBefore);
      if (afterSave === 'warning') {
        const warning = rolesWarningText(doc) || rolesWarningText(currentForm);
        errors.push(
          `Editorial Manager refused author ${author.sequence}: ${warning}`,
        );
        break;
      }
      if (afterSave === 'timeout') {
        // Unverified institution is not a hard stop. The portal may show
        // “Validation found issues…” then “Proceed with this Institution
        // anyway?” — click OK on each and, if the form is still open, save
        // once more. Do not abandon because the inline unverified text is up.
        dismissSaveDialogs(doc);
        if (authorFormVisible(doc)) clickAuthorSave(doc);
        const retry = await waitAfterAuthorSave(doc, currentForm, givenBefore);
        if (retry === 'closed' || retry === 'cleared') {
          // continue to Add Another Author
        } else if (retry === 'warning') {
          const warning = rolesWarningText(doc) || rolesWarningText(currentForm);
          errors.push(
            `Editorial Manager refused author ${author.sequence}: ${warning}`,
          );
          break;
        } else {
          dismissSaveDialogs(doc);
          const third = await waitAfterAuthorSave(doc, currentForm, givenBefore);
          if (third === 'closed' || third === 'cleared') {
            // dialogs were the only remaining step
          } else if (third === 'warning') {
            const warning =
              rolesWarningText(doc) || rolesWarningText(currentForm);
            errors.push(
              `Editorial Manager refused author ${author.sequence}: ${warning}`,
            );
            break;
          } else {
            const save = findAuthorSaveControl(doc);
            warnings.push(
              `Save This Author was clicked for author ${author.sequence} but the form is still open. Clicked ${save ? describeSaveControl(save) : 'Save This Author'}. If Editorial Manager is showing “Validation found issues” or “Proceed with this Institution anyway?”, click OK to finish the save.`,
            );
            break;
          }
        }
      }

      if (index < authors.length - 1) {
        const reopened = await openAuthorFormFromList(doc);
        if (!reopened) {
          const add = findAddAnotherAuthorControl(doc);
          warnings.push(
            add
              ? 'Add Author was clicked but a new author form did not open in this window. If Editorial Manager opened a separate Add New Author window, click Corresponding there.'
              : `${authors.length - index - 1} remaining authors need Add Author — that control was not found after Save.`,
          );
          break;
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

  validate(doc: Document, roster: Roster): ValidateReport {
    const form = findAuthorFormDocument(doc);
    const authors = sortAuthors(roster.authors);
    const issues: ValidateReport['issues'] = [];
    if (!form) {
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
    return {
      platformId: 'editorial-manager',
      ok: issues.every((issue) => issue.severity !== 'error'),
      issues,
      summary: {
        filledLike: form ? 1 : 0,
        missingEmail,
        conflicts: 0,
        mismatchedCount: 0,
      },
    };
  },
};
