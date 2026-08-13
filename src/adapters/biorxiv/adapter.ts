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
const SETTLE_TIMEOUT_MS = 2_000;
const SETTLE_INTERVAL_MS = 50;
const COMMIT_CONFIRM_TIMEOUT_MS = 8_000;
/** Shorter wait once row counting has proven unreliable on this page. */
const COMMIT_RECHECK_TIMEOUT_MS = 1_500;
const COMMIT_FALLBACK_SETTLE_MS = 1_200;
/** Longer than one frame so a late re-render is seen before Save. */
const WRITE_VERIFY_DELAY_MS = 150;
/** Generous: the email lookup is a network round trip. */
const LOOKUP_TIMEOUT_MS = 6_000;
const LOOKUP_INTERVAL_MS = 120;

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
  // Several dialogs stay mounted, and a stale one can keep the active class,
  // so the first match is not necessarily the dialog on screen.
  return (
    Array.from(doc.querySelectorAll<HTMLElement>(DIALOG_SELECTOR)).find(
      isVisible,
    ) ?? null
  );
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

function authorTableRowCount(doc: Document): number {
  // Import-authors previews add their own hidden data tables, so the first
  // match in the document is not necessarily the visible author list.
  const table = Array.from(
    doc.querySelectorAll<HTMLTableElement>(AUTHOR_TABLE_SELECTOR),
  ).find((candidate) => !candidate.closest(DIALOG_SELECTOR) && isVisible(candidate));
  if (!table) return 0;
  return Array.from(table.querySelectorAll('tbody > tr')).filter((row) => {
    if (!isVisible(row) || row.classList.contains('v-datatable__progress')) {
      return false;
    }
    return row.querySelectorAll(':scope > td').length > 1;
  }).length;
}

/**
 * Each committed author row carries its own edit and delete controls. Counting
 * them is independent of table markup, so detection survives layout changes.
 */
function authorRowControlCount(doc: Document): number {
  const labels = Array.from(
    doc.querySelectorAll<HTMLElement>('button, [role="button"]'),
  )
    .filter((el) => !el.closest(DIALOG_SELECTOR) && isVisible(el))
    .map(buttonLabel);
  const edits = labels.filter((label) => label === 'edit').length;
  const deletes = labels.filter((label) => label === 'delete').length;
  return Math.min(edits, deletes);
}

/** Best available count of authors bioRxiv has actually committed. */
function existingAuthorCount(doc: Document): number {
  return Math.max(authorTableRowCount(doc), authorRowControlCount(doc));
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

/**
 * `insertText` routes through the browser's own editing pipeline, so reactive
 * frameworks observe it exactly as they would real typing. The remaining
 * strategies are fallbacks for inputs that reject document commands.
 */
const INPUT_STRATEGIES = [
  'insertText',
  'nativeSetter',
  'rangeText',
  'keySequence',
] as const;
type InputStrategy = (typeof INPUT_STRATEGIES)[number];

function setNativeValue(input: HTMLInputElement, value: string): void {
  const win = input.ownerDocument.defaultView;
  const setter = win
    ? Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')
        ?.set
    : undefined;
  if (setter) setter.call(input, value);
  else input.value = value;
}

function applyInputStrategy(
  input: HTMLInputElement,
  value: string,
  strategy: InputStrategy,
): void {
  const win = input.ownerDocument.defaultView;
  input.focus();

  if (strategy === 'insertText') {
    input.select();
    const command = value ? 'insertText' : 'delete';
    // execCommand emits its own trusted-shaped input events.
    if (!input.ownerDocument.execCommand(command, false, value)) {
      throw new Error('insertText unavailable');
    }
    return;
  }

  if (strategy === 'keySequence') {
    // Per-character events for portals that track keystrokes rather than value.
    setNativeValue(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    for (const char of value) {
      const key = { key: char, bubbles: true, cancelable: true };
      input.dispatchEvent(new KeyboardEvent('keydown', key));
      setNativeValue(input, input.value + char);
      input.dispatchEvent(
        win?.InputEvent
          ? new win.InputEvent('input', {
              bubbles: true,
              inputType: 'insertText',
              data: char,
            })
          : new Event('input', { bubbles: true }),
      );
      input.dispatchEvent(new KeyboardEvent('keyup', key));
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  if (strategy === 'rangeText') {
    input.setRangeText(value, 0, input.value.length, 'end');
  } else {
    setNativeValue(input, value);
  }

  const InputEventCtor = win?.InputEvent;
  input.dispatchEvent(
    InputEventCtor
      ? new InputEventCtor('input', {
          bubbles: true,
          cancelable: false,
          inputType: value ? 'insertText' : 'deleteContentBackward',
          data: value || null,
        })
      : new Event('input', { bubbles: true }),
  );
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Returns false when the chosen strategy did not leave the value in place. */
function setInputValue(
  input: HTMLInputElement,
  value: string,
  strategy: InputStrategy,
): boolean {
  assertSafeMutationTarget(input);
  if (input.disabled || input.readOnly) return false;
  try {
    applyInputStrategy(input, value, strategy);
  } catch {
    return false;
  }
  input.blur();
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  return input.value.trim() === value.trim();
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  predicate: () => boolean,
  message: string,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < WAIT_TIMEOUT_MS) {
    if (predicate()) return;
    await delay(100);
  }
  throw new Error(message);
}

interface OpenedDialog {
  dialog: HTMLElement;
  /** True when Corresponding opened it, so residual values are stale UI state. */
  openedByUs: boolean;
}

async function openAuthorDialog(doc: Document): Promise<OpenedDialog> {
  const alreadyOpen = activeDialog(doc);
  if (alreadyOpen) return { dialog: alreadyOpen, openedByUs: false };
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
  return { dialog: activeDialog(doc)!, openedByUs: true };
}

/**
 * bioRxiv reuses one dialog element and clears it asynchronously. Wait until
 * the managed inputs stop changing so a late reset cannot wipe our values.
 */
async function waitForDialogSettled(dialog: HTMLElement): Promise<void> {
  const snapshot = () =>
    Array.from(dialog.querySelectorAll<HTMLInputElement>('input'))
      .map((input) => `${input.name}=${input.value}`)
      .join('|');
  let previous = snapshot();
  const started = Date.now();
  while (Date.now() - started < SETTLE_TIMEOUT_MS) {
    await delay(SETTLE_INTERVAL_MS);
    const next = snapshot();
    if (next === previous) return;
    previous = next;
  }
}

/**
 * Entering an email makes bioRxiv look the author up in its own directory and
 * re-render the dialog when the result arrives. Writing the remaining fields
 * during that window loses them, so wait for the whole dialog to stop changing,
 * not just its input values.
 */
async function waitForLookupSettled(
  doc: Document,
  dialog: HTMLElement,
): Promise<void> {
  const snapshot = () =>
    [
      dialog.querySelectorAll('*').length,
      normalizeText(dialog.textContent).length,
      Array.from(dialog.querySelectorAll<HTMLInputElement>('input'))
        .map((input) => `${input.name}=${input.value}`)
        .join('|'),
      // The result appears in a panel beside the dialog.
      lookupOfferPresent(doc) ? 'offer' : '',
    ].join('#');

  let previous = snapshot();
  let stableSamples = 0;
  const started = Date.now();
  while (Date.now() - started < LOOKUP_TIMEOUT_MS) {
    await delay(LOOKUP_INTERVAL_MS);
    const next = snapshot();
    if (next === previous) {
      stableSamples += 1;
      if (stableSamples >= 2) return;
    } else {
      stableSamples = 0;
      previous = next;
    }
  }
}

/**
 * bioRxiv's "fetch author data" offer. Corresponding never accepts it: that
 * would replace the roster's values with the portal's own record.
 */
function lookupOfferPresent(doc: Document): boolean {
  return Array.from(doc.querySelectorAll<HTMLElement>('div, span, p')).some(
    (node) =>
      isVisible(node) &&
      /fetch author data|found author/i.test(normalizeText(node.textContent)),
  );
}

interface ResolvedField {
  field: AuthorField;
  input: HTMLInputElement | null;
}

function resolveAuthorFields(
  dialog: HTMLElement,
  author: Author,
): ResolvedField[] {
  return authorFields(author).map((field) => ({
    field,
    input: findField(dialog, field),
  }));
}

/**
 * Authoritative mode writes every roster value and clears managed fields with
 * no value, so one author's leftovers cannot be saved as the next author.
 * Preserve mode only applies to a dialog the user already had open.
 */
function writeAuthorFields(
  resolved: ResolvedField[],
  authoritative: boolean,
  overwrite: boolean,
  strategy: InputStrategy,
  only?: (field: AuthorField) => boolean,
): void {
  for (const { field, input } of resolved) {
    if (only && !only(field)) continue;
    if (!input) continue;
    const desired = field.value?.trim() ?? '';
    const current = input.value.trim();
    if (!desired) {
      if (authoritative && current) setInputValue(input, '', strategy);
      continue;
    }
    if (current && !authoritative && !overwrite) continue;
    setInputValue(input, desired, strategy);
  }
}

/** Returns a human-readable mismatch, or null when the dialog is correct. */
function authorFieldMismatch(
  resolved: ResolvedField[],
  author: Author,
  authoritative: boolean,
  overwrite: boolean,
): string | null {
  for (const { field, input } of resolved) {
    const desired = field.value?.trim() ?? '';
    if (!input) {
      if (field.required) {
        return `Could not find bioRxiv ${field.label} for author ${author.sequence}`;
      }
      continue;
    }
    const current = input.value.trim();
    if (!desired) {
      if (authoritative && current) {
        return `${field.label} still holds a previous author's value`;
      }
      continue;
    }
    if (current === desired) continue;
    if (current && !authoritative && !overwrite) continue;
    return `${field.label} did not accept the roster value for author ${author.sequence}`;
  }
  return null;
}

/** Page-level banners: a real failure the user must see. */
const PORTAL_BANNER_SELECTOR = '.v-alert, [role="alert"]';
/** Field-level validation: recoverable while the dialog is still open. */
const FIELD_VALIDATION_SELECTOR =
  '.v-messages__message, .error--text, .red--text';

function visibleText(doc: ParentNode, selector: string): string {
  for (const node of Array.from(doc.querySelectorAll(selector))) {
    if (!(node instanceof HTMLElement) || !isVisible(node)) continue;
    const text = normalizeText(node.textContent);
    if (text.length >= 8) return text.slice(0, 200);
  }
  return '';
}

/** bioRxiv's own visible error banner text, if any. */
function portalErrorText(doc: Document): string {
  return visibleText(doc, PORTAL_BANNER_SELECTOR);
}

/** Validation shown against fields inside the open author dialog. */
function dialogValidationText(dialog: HTMLElement): string {
  return visibleText(dialog, FIELD_VALIDATION_SELECTOR);
}

/**
 * A closed dialog only means bioRxiv accepted the click. The author is not
 * committed until it appears in the table, and clicking Add before then makes
 * the portal reconcile against a record it has not stored yet.
 */
/**
 * Confirming the commit prevents the next Add click from racing bioRxiv's
 * save. When the row cannot be counted the save may still have succeeded, so
 * an undetectable commit settles and continues instead of failing the run.
 */
type CommitResult = 'confirmed' | 'unconfirmed' | 'rejected';

async function saveAuthorDialog(
  doc: Document,
  dialog: HTMLElement,
  baselineError: string,
  confirmTimeoutMs: number,
): Promise<CommitResult> {
  const before = existingAuthorCount(doc);
  const save = findButton(dialog, 'Save');
  if (!save) throw new Error('Could not find the active bioRxiv author Save button');
  assertSafeMutationTarget(save);
  save.click();

  const started = Date.now();
  while (Date.now() - started < confirmTimeoutMs) {
    const error = portalErrorText(doc);
    if (error && error !== baselineError) {
      throw new Error(`bioRxiv reported: ${error}`);
    }
    if (activeDialog(doc) === null && existingAuthorCount(doc) > before) {
      return 'confirmed';
    }
    // Validation with the dialog still open means nothing was committed, so
    // the values were lost before Save and the author can be re-entered.
    if (activeDialog(doc) === dialog && dialogValidationText(dialog)) {
      return 'rejected';
    }
    await delay(100);
  }

  if (activeDialog(doc) !== null) {
    const validation = dialogValidationText(dialog);
    throw new Error(
      validation
        ? `bioRxiv rejected the author: ${validation}`
        : 'bioRxiv kept the author dialog open after Save; review its validation messages',
    );
  }
  await delay(COMMIT_FALLBACK_SETTLE_MS);
  return 'unconfirmed';
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
    // A pre-existing banner must not block the run, so only new text is fatal.
    const baselineError = portalErrorText(doc);
    let savedAuthors = 0;
    let unconfirmedCommits = 0;
    let lookupOffers = 0;
    let confirmTimeoutMs = COMMIT_CONFIRM_TIMEOUT_MS;
    try {
      for (const author of authors) {
        const { dialog, openedByUs } = await openAuthorDialog(doc);
        if (openedByUs) await waitForDialogSettled(dialog);
        const openError = portalErrorText(doc);
        if (openError && openError !== baselineError) {
          throw new Error(`bioRxiv reported: ${openError}`);
        }

        let commit: CommitResult = 'rejected';
        let lastMismatch: string | null = null;
        let sawLookupOffer = false;
        // The portal's own validation is the only reliable signal that it
        // accepted our text, so escalate input strategies until it agrees.
        for (const strategy of INPUT_STRATEGIES) {
          if (commit === 'rejected' && strategy !== INPUT_STRATEGIES[0]) {
            await waitForDialogSettled(dialog);
          }

          let resolved = resolveAuthorFields(dialog, author);

          // Email first, alone: it starts bioRxiv's author lookup, which
          // re-renders the dialog and would discard anything written meanwhile.
          writeAuthorFields(
            resolved,
            openedByUs,
            options.overwrite,
            strategy,
            (field) => field.key === 'email',
          );
          await waitForLookupSettled(doc, dialog);
          sawLookupOffer = sawLookupOffer || lookupOfferPresent(doc);

          // Re-resolve: the lookup may have replaced the input elements.
          resolved = resolveAuthorFields(dialog, author);
          writeAuthorFields(
            resolved,
            openedByUs,
            options.overwrite,
            strategy,
            (field) => field.key !== 'email',
          );

          // Re-read after a tick: the portal may reset fields asynchronously.
          await delay(WRITE_VERIFY_DELAY_MS);
          resolved = resolveAuthorFields(dialog, author);
          lastMismatch = authorFieldMismatch(
            resolved,
            author,
            openedByUs,
            options.overwrite,
          );
          if (lastMismatch) continue;

          // Values are in the fields but the portal still reports them missing:
          // its model did not receive this strategy's input.
          if (/required|cannot be blank|must be/i.test(dialogValidationText(dialog))) {
            continue;
          }

          const corresponding = correspondingCheckbox(dialog);
          if (!corresponding) {
            throw new Error(
              `Could not find bioRxiv corresponding-author checkbox for author ${author.sequence}`,
            );
          }
          setCheckbox(corresponding, author.isCorresponding);

          commit = await saveAuthorDialog(
            doc,
            dialog,
            baselineError,
            confirmTimeoutMs,
          );
          if (commit !== 'rejected') break;
        }
        if (commit === 'rejected' && lastMismatch) throw new Error(lastMismatch);

        if (commit === 'rejected') {
          // Distinguish "our text never landed" from "the portal ignored text
          // that was visibly present" so the next fix is not guesswork.
          const shown = resolveAuthorFields(dialog, author)
            .filter(({ field, input }) => input && field.required)
            .map(
              ({ field, input }) =>
                `${field.label}=${input!.value.trim() ? 'present' : 'empty'}`,
            )
            .join(', ');
          throw new Error(
            `bioRxiv rejected author ${author.sequence} after trying every input method: ${
              dialogValidationText(dialog) || 'review the dialog'
            } (fields at Save: ${shown || 'none found'}). Try bioRxiv's own Import Authors control for bulk entry.`,
          );
        }
        if (commit === 'unconfirmed') {
          unconfirmedCommits += 1;
          confirmTimeoutMs = COMMIT_RECHECK_TIMEOUT_MS;
        }
        if (sawLookupOffer) lookupOffers += 1;
        savedAuthors += 1;
      }
      lastFill.set(doc, { rosterId: roster.id, savedAuthors });
      return {
        ...preflight,
        dryRun: false,
        warnings: [
          ...preflight.warnings,
          `Saved ${savedAuthors} author dialogs; page continuation remained untouched`,
          ...(unconfirmedCommits > 0
            ? [
                `Could not read bioRxiv's author list for ${unconfirmedCommits} of ${savedAuthors} authors; confirm the list matches your roster`,
              ]
            : []),
          ...(lookupOffers > 0
            ? [
                `bioRxiv recognised ${lookupOffers} email${lookupOffers === 1 ? '' : 's'} and offered its own author record; your roster values were kept and Fetch/Fill Info was not used`,
              ]
            : []),
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
