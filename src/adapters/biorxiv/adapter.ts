import type { Author, Roster } from '@/schema/author';
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

const DIALOG_SELECTOR = '.v-dialog.v-dialog--active';
const AUTHOR_TABLE_SELECTOR = 'table.v-datatable';
const WAIT_TIMEOUT_MS = 10_000;

type AuthorField = {
  key: 'email' | 'givenName' | 'middleName' | 'familyName' | 'institution';
  label: string;
  value?: string;
  required: boolean;
  name?: string;
  labelPattern?: RegExp;
};

const lastFill = new WeakMap<
  Document,
  { rosterId: string; savedAuthors: number; error?: string }
>();

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Ancestor-aware visibility. A child of a `display: none` container keeps its
 * own computed display, so checking only the element itself would treat
 * closed-dialog and template controls as clickable.
 */
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
 * Button text without icon ligatures. Vuetify renders Material icons as text
 * nodes inside the button, so raw textContent looks like "person_addAdd Author".
 * The clone is detached: the portal DOM is never modified to read a label.
 */
function buttonLabel(button: HTMLElement): string {
  const aria = button.getAttribute('aria-label');
  if (aria?.trim()) return normalizeText(aria);
  const clone = button.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('i, svg, .v-icon, [aria-hidden="true"]')
    .forEach((node) => node.remove());
  const stripped = normalizeText(clone.textContent);
  return stripped || normalizeText(button.textContent);
}

function activeDialog(doc: Document): HTMLElement | null {
  const dialog = doc.querySelector(DIALOG_SELECTOR);
  return dialog instanceof HTMLElement && isVisible(dialog) ? dialog : null;
}

function labelText(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent) return parentLabel.textContent.trim();
  const inputRoot = el.closest('.v-input');
  const label = inputRoot?.querySelector('label');
  return label?.textContent?.trim() ?? '';
}

function findField(
  dialog: HTMLElement,
  spec: Pick<AuthorField, 'name' | 'labelPattern'>,
): HTMLInputElement | null {
  const inputs = Array.from(
    dialog.querySelectorAll<HTMLInputElement>('input:not([type="hidden"])'),
  ).filter(isVisible);
  if (spec.name) {
    const named = inputs.find((input) => input.name === spec.name);
    if (named) return named;
  }
  if (spec.labelPattern) {
    return (
      inputs.find((input) => spec.labelPattern!.test(labelText(input))) ?? null
    );
  }
  return null;
}

function findButton(
  root: ParentNode,
  text: string,
): HTMLButtonElement | null {
  const desired = normalizeText(text);
  return (
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) =>
        isVisible(button) &&
        !button.disabled &&
        buttonLabel(button) === desired,
    ) ?? null
  );
}

const AUTHOR_WORD_RE = /^co-?authors?$|^authors?$/;

/**
 * Accepts "Add Author", "Add Another Author", "Add New Co-Author", and icon
 * ligature prefixes such as "person_add Add Author". Scanning words keeps the
 * match linear instead of relying on a backtracking-prone pattern.
 */
function looksLikeAddAuthor(label: string): boolean {
  const words = label.split(' ').filter(Boolean);
  const addIndex = words.indexOf('add');
  if (addIndex === -1) return false;
  return words
    .slice(addIndex + 1, addIndex + 4)
    .some((word) => AUTHOR_WORD_RE.test(word));
}

function addAuthorButton(doc: Document): HTMLButtonElement | null {
  return (
    Array.from(doc.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) =>
        !button.disabled &&
        !button.closest(DIALOG_SELECTOR) &&
        !isForbiddenControl(button) &&
        looksLikeAddAuthor(buttonLabel(button)) &&
        isVisible(button),
    ) ?? null
  );
}

function existingAuthorCount(doc: Document): number {
  const table = doc.querySelector(AUTHOR_TABLE_SELECTOR);
  if (!table || !isVisible(table)) return 0;
  return Array.from(table.querySelectorAll('tbody > tr')).filter((row) => {
    if (!isVisible(row) || row.classList.contains('v-datatable__progress')) {
      return false;
    }
    return row.querySelectorAll(':scope > td').length > 1;
  }).length;
}

function sortedAuthors(roster: Roster): Author[] {
  return [...roster.authors].sort((a, b) => a.sequence - b.sequence);
}

function authorFields(author: Author): AuthorField[] {
  const affiliation = author.affiliations.find((item) => item.isPrimary) ??
    author.affiliations[0];
  return [
    {
      key: 'email',
      label: 'Email',
      value: author.email,
      required: true,
      labelPattern: /^email$/i,
    },
    {
      key: 'givenName',
      label: 'First Name',
      value: author.givenName,
      required: true,
      name: 'firstName',
    },
    {
      key: 'middleName',
      label: 'Middle Name(s)/Initial(s)',
      value: author.middleName,
      required: false,
      labelPattern: /^middle name/i,
    },
    {
      key: 'familyName',
      label: 'Last Name',
      value: author.familyName,
      required: true,
      name: 'lastName',
    },
    {
      key: 'institution',
      label: 'Institution',
      value: affiliation?.institution,
      required: true,
      name: 'affiliation',
    },
  ];
}

function requiredRosterErrors(authors: Author[]): string[] {
  const errors: string[] = [];
  for (const author of authors) {
    for (const field of authorFields(author)) {
      if (field.required && !field.value?.trim()) {
        errors.push(`Author ${author.sequence} is missing ${field.label}`);
      }
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

function buildPlans(
  authors: Author[],
  options: FillOptions,
  dialog: HTMLElement | null,
): FieldPlan[] {
  const plans: FieldPlan[] = [];
  authors.forEach((author, authorIndex) => {
    for (const field of authorFields(author)) {
      const input = authorIndex === 0 && dialog ? findField(dialog, field) : null;
      const current = input?.value.trim() ?? '';
      const action = fieldAction(
        current,
        field.value,
        field.required,
        options.overwrite,
      );
      if (!action) continue;
      plans.push({
        fieldId: `biorxiv.author.${author.sequence}.${field.key}`,
        label: `Author ${author.sequence} ${field.label}`,
        authorSequence: author.sequence,
        action,
        currentValue: current || undefined,
        proposedValue: field.value,
        reason:
          action === 'missing_source'
            ? `Roster is missing required ${field.label}`
            : undefined,
      });
    }
    plans.push({
      fieldId: `biorxiv.author.${author.sequence}.corresponding`,
      label: `Author ${author.sequence} corresponding status`,
      authorSequence: author.sequence,
      action: 'fill',
      proposedValue: author.isCorresponding ? 'yes' : 'no',
    });
    if (author.orcid) {
      plans.push({
        fieldId: `biorxiv.author.${author.sequence}.orcid`,
        label: `Author ${author.sequence} ORCiD`,
        authorSequence: author.sequence,
        action: 'unmapped',
        proposedValue: author.orcid,
        reason:
          'bioRxiv requires its separate ORCID linking flow; Corresponding will not automate account authorization',
      });
    }
  });
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
  const existing = existingAuthorCount(doc);
  if (existing > 0) {
    errors.push(
      `bioRxiv already lists ${existing} author${existing === 1 ? '' : 's'}. Remove them with bioRxiv's own Delete controls, then Fill again.`,
    );
  }
  if (!activeDialog(doc) && !addAuthorButton(doc)) {
    errors.push(
      'Could not find a visible bioRxiv Add Author control on this page. Scroll the author step into view, or open the author dialog yourself and Fill again.',
    );
  }
  const plans = buildPlans(authors, options, activeDialog(doc));
  const dangerous = listDangerousControls(doc);
  return {
    platformId: 'biorxiv',
    dryRun: options.dryRun,
    overwrite: options.overwrite,
    plans,
    ...summarize(plans),
    warnings: dangerous.length
      ? [
          `Detected ${dangerous.length} page-submit or legal controls; none will be clicked`,
        ]
      : [],
    errors,
  };
}

function setInputValue(input: HTMLInputElement, value: string): void {
  assertSafeMutationTarget(input);
  if (input.disabled || input.readOnly) return;
  const win = input.ownerDocument.defaultView;
  const setter = win
    ? Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')
        ?.set
    : undefined;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

function setCheckbox(input: HTMLInputElement, checked: boolean): void {
  assertSafeMutationTarget(input);
  if (input.disabled || input.checked === checked) return;
  const win = input.ownerDocument.defaultView;
  const setter = win
    ? Object.getOwnPropertyDescriptor(
        win.HTMLInputElement.prototype,
        'checked',
      )?.set
    : undefined;
  if (setter) setter.call(input, checked);
  else input.checked = checked;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function correspondingCheckbox(dialog: HTMLElement): HTMLInputElement | null {
  return (
    Array.from(
      dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).find(
      (input) =>
        isVisible(input) &&
        /mark as corresponding author/i.test(labelText(input)),
    ) ?? null
  );
}

async function waitFor(
  predicate: () => boolean,
  message: string,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < WAIT_TIMEOUT_MS) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

async function openAuthorDialog(doc: Document): Promise<HTMLElement> {
  const alreadyOpen = activeDialog(doc);
  if (alreadyOpen) return alreadyOpen;
  await waitFor(
    () => addAuthorButton(doc) !== null,
    'Could not find bioRxiv Add Author after the author table refreshed',
  );
  const add = addAuthorButton(doc)!;
  assertSafeMutationTarget(add);
  add.click();
  await waitFor(
    () => activeDialog(doc) !== null,
    'bioRxiv Add Author dialog did not open',
  );
  return activeDialog(doc)!;
}

async function saveAuthorDialog(
  doc: Document,
  dialog: HTMLElement,
): Promise<void> {
  const save = findButton(dialog, 'Save');
  if (!save) throw new Error('Could not find the active bioRxiv author Save button');
  assertSafeMutationTarget(save);
  save.click();
  await waitFor(
    () => activeDialog(doc) === null,
    'bioRxiv did not close the author dialog after Save; review its validation messages',
  );
}

export const biorxivAdapter: PlatformAdapter = {
  id: 'biorxiv',
  label: 'bioRxiv / medRxiv',

  detect(doc: Document): DetectResult {
    const evidence: string[] = [];
    let score = 0;
    if (doc.getElementById('submission_form')) {
      evidence.push('submission_form');
      score += 0.2;
    }
    if (doc.querySelector('input[name="CA_continue"]')) {
      evidence.push('CA_continue');
      score += 0.2;
    }
    if (doc.querySelector('input[name="firstName"]')) {
      evidence.push('firstName');
      score += 0.2;
    }
    if (doc.querySelector('input[name="lastName"]')) {
      evidence.push('lastName');
      score += 0.2;
    }
    if (addAuthorButton(doc)) {
      evidence.push('Add Author');
      score += 0.2;
    }
    const confidence = Math.min(1, score);
    return {
      platformId: confidence >= 0.8 ? 'biorxiv' : 'unknown',
      confidence,
      label: confidence >= 0.8 ? 'bioRxiv / medRxiv' : 'Unknown',
      evidence,
    };
  },

  inspect(doc: Document): InspectReport {
    const dialog = activeDialog(doc);
    const fields: InspectReport['fields'] = [];
    if (dialog) {
      dialog.querySelectorAll('input').forEach((input, index) => {
        fields.push({
          fieldId: input.name || `visible-dialog-field-${index + 1}`,
          tag: 'input',
          type: input.type,
          value: '',
          label: labelText(input),
        });
      });
    }
    return {
      platformId: 'biorxiv',
      authorSlots: 1,
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

    const authors = sortedAuthors(roster);
    let savedAuthors = 0;
    try {
      for (const author of authors) {
        const dialog = await openAuthorDialog(doc);
        for (const field of authorFields(author)) {
          if (!field.value?.trim()) continue;
          const input = findField(dialog, field);
          if (!input) {
            if (field.required) {
              throw new Error(
                `Could not find bioRxiv ${field.label} for author ${author.sequence}`,
              );
            }
            continue;
          }
          const current = input.value.trim();
          if (current && !options.overwrite) continue;
          setInputValue(input, field.value);
        }
        const corresponding = correspondingCheckbox(dialog);
        if (!corresponding) {
          throw new Error(
            `Could not find bioRxiv corresponding-author checkbox for author ${author.sequence}`,
          );
        }
        setCheckbox(corresponding, author.isCorresponding);
        await saveAuthorDialog(doc, dialog);
        savedAuthors += 1;
      }
      lastFill.set(doc, { rosterId: roster.id, savedAuthors });
      return {
        ...preflight,
        dryRun: false,
        warnings: [
          ...preflight.warnings,
          `Saved ${savedAuthors} author dialogs; page continuation remained untouched`,
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastFill.set(doc, { rosterId: roster.id, savedAuthors, error: message });
      throw new Error(
        `bioRxiv Fill stopped after ${savedAuthors} author${savedAuthors === 1 ? '' : 's'}: ${message}`,
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
        message: `bioRxiv saved ${filledLike} authors but the roster contains ${authors.length}`,
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
      platformId: 'biorxiv',
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
