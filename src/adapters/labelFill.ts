import {
  primaryAffiliation,
  sortAuthors,
  type Author,
  type Roster,
} from '@/schema/author';
import {
  identitiesConflict,
  readControlValue,
  setControlValue,
} from './dom';
import { isForbiddenControl, listDangerousControls } from './safety';
import type {
  FieldPlan,
  FillOptions,
  FillReport,
  InspectReport,
  PlatformId,
  ValidateReport,
} from './types';

export type EditableControl =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement;

export type AuthorFieldKey =
  | 'givenName'
  | 'middleName'
  | 'familyName'
  | 'email'
  | 'orcid'
  | 'institution'
  | 'department'
  | 'city'
  | 'state'
  | 'country'
  | 'corresponding'
  | 'equalContribution'
  | 'conflictOfInterest';

export interface AuthorFieldRule {
  key: AuthorFieldKey;
  label: string;
  phrases: string[];
}

/** Official ScholarOne / Editorial Manager author-entry labels from vendor docs. */
export const AUTHOR_FIELD_RULES: AuthorFieldRule[] = [
  {
    key: 'givenName',
    label: 'First / given name',
    phrases: ['given/first name', 'first name', 'given name', 'firstname'],
  },
  {
    key: 'middleName',
    label: 'Middle name',
    phrases: ['middle name', 'middle initial'],
  },
  {
    key: 'familyName',
    label: 'Last / family name',
    phrases: ['family/last name', 'last name', 'family name', 'surname'],
  },
  {
    key: 'email',
    label: 'Email',
    phrases: ['email address', 'e-mail address', 'e mail address', 'email'],
  },
  {
    key: 'orcid',
    label: 'ORCID',
    phrases: ['orcid id', 'orcid i d', 'orcid'],
  },
  {
    key: 'institution',
    label: 'Institution',
    phrases: ['institution', 'organization', 'organisation', 'affiliation'],
  },
  {
    key: 'department',
    label: 'Department',
    phrases: ['department', 'dept'],
  },
  {
    key: 'city',
    label: 'City',
    phrases: ['city'],
  },
  {
    key: 'state',
    label: 'State / province',
    phrases: ['state or province', 'state/province', 'province', 'state'],
  },
  {
    key: 'country',
    label: 'Country',
    phrases: ['country or region', 'country/region', 'country'],
  },
  {
    key: 'corresponding',
    label: 'Corresponding author',
    phrases: [
      'post-publication corresponding author',
      'corresponding author',
      'corresponding',
    ],
  },
  {
    key: 'equalContribution',
    label: 'Equal contribution',
    phrases: ['equal contribution status', 'equal contribution', 'equal contributor'],
  },
  {
    key: 'conflictOfInterest',
    label: 'Conflict of interest',
    phrases: [
      'conflicts of interest',
      'conflict of interest',
      'competing interests',
      'competing interest',
      'disclosure statement',
      'coi statement',
    ],
  },
];

export interface AuthorSlot {
  index: number;
  root: HTMLElement;
  fields: Partial<Record<AuthorFieldKey, EditableControl>>;
  linkedPid: string;
}

export function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[/*|:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pageText(doc: Document): string {
  return normalizeLabel(doc.body?.textContent ?? '');
}

export function hasPhrase(doc: Document, phrase: string): boolean {
  return pageText(doc).includes(normalizeLabel(phrase));
}

export function isEditableControl(el: Element): el is EditableControl {
  if (
    !(
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    )
  ) {
    return false;
  }
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    if (
      type === 'hidden' ||
      type === 'password' ||
      type === 'submit' ||
      type === 'button' ||
      type === 'file' ||
      type === 'image' ||
      type === 'reset'
    ) {
      return false;
    }
  }
  return true;
}

export function isVisible(el: Element): boolean {
  for (
    let node: Element | null = el;
    node && node !== el.ownerDocument.documentElement;
    node = node.parentElement
  ) {
    if (node instanceof HTMLElement && node.hidden) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
    if (node.hasAttribute('hidden')) return false;
  }
  return true;
}

export function controlLabel(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  if (el.id) {
    const labelled = el.ownerDocument.querySelector(
      `label[for="${cssEscape(el.id)}"]`,
    );
    if (labelled?.textContent) return labelled.textContent.trim();
  }
  const wrapped = el.closest('label');
  if (wrapped?.textContent) return wrapped.textContent.trim();
  const prev = el.previousElementSibling;
  if (prev && ['LABEL', 'SPAN', 'DIV', 'P'].includes(prev.tagName)) {
    const text = prev.textContent?.trim() ?? '';
    if (text && text.length < 80) return text;
  }
  return '';
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function phraseMatches(label: string, phrase: string): boolean {
  const normalized = normalizeLabel(label);
  const wanted = normalizeLabel(phrase);
  if (!wanted) return false;
  if (normalized === wanted) return true;
  return (
    normalized.includes(wanted) &&
    (wanted.length >= 8 || normalized.split(' ').includes(wanted))
  );
}

export function findLabeledControl(
  root: ParentNode,
  phrases: string[],
): EditableControl | null {
  const controls = visibleEditableControls(root);
  for (const phrase of phrases) {
    const match = controls.find((el) => phraseMatches(controlLabel(el), phrase));
    if (match) return match;
  }
  return null;
}

function visibleEditableControls(root: ParentNode): EditableControl[] {
  return Array.from(root.querySelectorAll('input, select, textarea')).filter(
    (el): el is EditableControl => isEditableControl(el) && isVisible(el),
  );
}

function linkedPidIn(root: HTMLElement): string {
  const hidden = Array.from(
    root.querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
  );
  const pid = hidden.find((el) =>
    /people[_-]?id|user[_-]?id|author[_-]?pid|author[_-]?id/i.test(
      `${el.id} ${el.name}`,
    ),
  );
  return (pid?.value ?? '').trim();
}

export function resolveSlotFields(
  root: HTMLElement,
): Partial<Record<AuthorFieldKey, EditableControl>> {
  const fields: Partial<Record<AuthorFieldKey, EditableControl>> = {};
  for (const el of visibleEditableControls(root)) {
    const label = controlLabel(el);
    for (const rule of AUTHOR_FIELD_RULES) {
      if (fields[rule.key]) continue;
      if (rule.phrases.some((phrase) => phraseMatches(label, phrase))) {
        fields[rule.key] = el;
        break;
      }
    }
  }
  return fields;
}

export function findAuthorSlots(doc: Document): AuthorSlot[] {
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>(
      '[data-author-slot], fieldset.s1-author, fieldset.em-author',
    ),
  ).filter((el) => isVisible(el) && !el.closest('[data-author-overlay]'));

  const slots: AuthorSlot[] = [];
  for (const root of candidates) {
    const fields = resolveSlotFields(root);
    if (!fields.givenName || !fields.familyName) continue;
    slots.push({
      index: slots.length + 1,
      root,
      fields,
      linkedPid: linkedPidIn(root),
    });
  }
  return slots;
}

export function findAuthorOverlay(doc: Document): HTMLElement | null {
  const overlay = doc.querySelector<HTMLElement>('[data-author-overlay]');
  if (!overlay || !isVisible(overlay)) return null;
  const fields = resolveSlotFields(overlay);
  if (!fields.givenName || !fields.familyName) return null;
  return overlay;
}

export function overlayToSlot(overlay: HTMLElement, index: number): AuthorSlot {
  return {
    index,
    root: overlay,
    fields: resolveSlotFields(overlay),
    linkedPid: linkedPidIn(overlay),
  };
}

export function findPageCoiControls(
  doc: Document,
  slots: AuthorSlot[],
): EditableControl[] {
  const slotRoots = new Set(slots.map((s) => s.root));
  const rule = AUTHOR_FIELD_RULES.find((r) => r.key === 'conflictOfInterest')!;
  const matches: EditableControl[] = [];
  for (const el of Array.from(doc.querySelectorAll('textarea, input'))) {
    if (!isEditableControl(el) || !isVisible(el)) continue;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') continue;
    if (!rule.phrases.some((phrase) => phraseMatches(controlLabel(el), phrase))) {
      continue;
    }
    if ([...slotRoots].some((root) => root.contains(el))) continue;
    if (isForbiddenControl(el)) continue;
    matches.push(el);
  }
  return matches;
}

export function findButtonByPhrases(
  root: ParentNode,
  phrases: string[],
): HTMLButtonElement | HTMLInputElement | HTMLAnchorElement | null {
  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, input[type="button"], input[type="submit"], a[role="button"]',
    ),
  );
  const candidates = nodes
    .map((el) => {
      if (!isVisible(el)) return null;
      if (
        (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) &&
        el.disabled
      ) {
        return null;
      }
      if (isForbiddenControl(el)) return null;
      const text = normalizeLabel(
        [
          el.getAttribute('aria-label') ?? '',
          el instanceof HTMLInputElement ? el.value : '',
          el.textContent ?? '',
        ].join(' '),
      );
      return { el, text };
    })
    .filter((row): row is { el: HTMLElement; text: string } => row !== null);

  for (const phrase of phrases) {
    const wanted = normalizeLabel(phrase);
    const exact = candidates.find((row) => row.text === wanted);
    if (exact) {
      return exact.el as HTMLButtonElement | HTMLInputElement | HTMLAnchorElement;
    }
  }
  for (const phrase of phrases) {
    const wanted = normalizeLabel(phrase);
    const partial = candidates.find((row) => row.text.includes(wanted));
    if (partial) {
      return partial.el as
        | HTMLButtonElement
        | HTMLInputElement
        | HTMLAnchorElement;
    }
  }
  return null;
}

export function planField(
  fieldId: string,
  label: string,
  authorSequence: number | undefined,
  current: string,
  proposed: string | undefined,
  options: FillOptions,
  conflict: boolean,
): FieldPlan {
  if (conflict) {
    return {
      fieldId,
      label,
      authorSequence,
      action: 'skip_conflict',
      currentValue: current,
      proposedValue: proposed,
      reason: 'Linked portal author identity conflicts with roster',
    };
  }
  if (proposed === undefined || proposed === '') {
    return {
      fieldId,
      label,
      authorSequence,
      action: 'missing_source',
      currentValue: current,
      reason: 'No value in roster for this field',
    };
  }
  if (current && !options.overwrite) {
    return {
      fieldId,
      label,
      authorSequence,
      action: 'preserve',
      currentValue: current,
      proposedValue: proposed,
      reason: 'Existing non-empty value preserved (overwrite=false)',
    };
  }
  if (current && options.overwrite) {
    return {
      fieldId,
      label,
      authorSequence,
      action: 'overwrite',
      currentValue: current,
      proposedValue: proposed,
    };
  }
  return {
    fieldId,
    label,
    authorSequence,
    action: 'fill',
    currentValue: current,
    proposedValue: proposed,
  };
}

export function summarizePlans(
  plans: FieldPlan[],
): Omit<FillReport, 'platformId' | 'dryRun' | 'overwrite' | 'plans' | 'warnings' | 'errors'> {
  return {
    filled: plans.filter((p) => p.action === 'fill').length,
    preserved: plans.filter((p) => p.action === 'preserve').length,
    overwritten: plans.filter((p) => p.action === 'overwrite').length,
    skippedConflicts: plans.filter((p) => p.action === 'skip_conflict').length,
    missingSource: plans.filter((p) => p.action === 'missing_source').length,
    unmapped: plans.filter((p) => p.action === 'unmapped').length,
  };
}

export function applyPlans(
  plans: FieldPlan[],
  controls: Map<string, EditableControl>,
  options: FillOptions,
): void {
  if (options.dryRun) return;
  for (const plan of plans) {
    if (plan.action !== 'fill' && plan.action !== 'overwrite') continue;
    if (plan.proposedValue === undefined) continue;
    const el = controls.get(plan.fieldId);
    if (!el) continue;
    setControlValue(el, plan.proposedValue, { overwrite: true, dryRun: false });
  }
}

export function controlFieldId(
  platformId: PlatformId,
  slot: number | 'page' | 'overlay',
  key: AuthorFieldKey,
  el: EditableControl,
): string {
  return el.id || `${platformId}-${slot}-${key}`;
}

function authorProposed(
  author: Author,
  key: AuthorFieldKey,
): string | undefined {
  const aff = primaryAffiliation(author);
  switch (key) {
    case 'givenName':
      return author.givenName;
    case 'middleName':
      return author.middleName || undefined;
    case 'familyName':
      return author.familyName;
    case 'email':
      return author.email;
    case 'orcid':
      return author.orcid;
    case 'institution':
      return aff?.institution;
    case 'department':
      return aff?.department;
    case 'city':
      return aff?.city;
    case 'state':
      return aff?.state;
    case 'country':
      return aff?.country;
    case 'corresponding':
      return author.isCorresponding ? 'true' : undefined;
    case 'equalContribution':
      return author.equalContribution ? 'true' : undefined;
    case 'conflictOfInterest':
      return author.conflictOfInterest;
    default:
      return undefined;
  }
}

export function rosterCoiText(roster: Roster): string | undefined {
  const fromAuthors = [
    ...new Set(
      roster.authors
        .map((author) => author.conflictOfInterest?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  if (fromAuthors.length) return fromAuthors.join('\n\n');
  const fromProject = roster.projectMetadata?.disclosureStatements ?? [];
  return fromProject.length ? fromProject.join('\n\n') : undefined;
}

export function slotConflicts(slot: AuthorSlot, author: Author): boolean {
  if (!slot.linkedPid) return false;
  const portal = {
    email: slot.fields.email ? readControlValue(slot.fields.email) : '',
    familyName: slot.fields.familyName
      ? readControlValue(slot.fields.familyName)
      : '',
    givenName: slot.fields.givenName
      ? readControlValue(slot.fields.givenName)
      : '',
  };
  const hasPortalIdentity = Boolean(
    portal.email || portal.familyName || portal.givenName,
  );
  if (!hasPortalIdentity) return true;
  return identitiesConflict(portal, {
    email: author.email || '',
    familyName: author.familyName,
    givenName: author.givenName,
  }, { linkedPid: true });
}

export function planAuthorSlot(
  platformId: PlatformId,
  slot: AuthorSlot,
  author: Author,
  options: FillOptions,
  enabledKeys: AuthorFieldKey[],
): { plans: FieldPlan[]; controls: Map<string, EditableControl> } {
  const conflict = slotConflicts(slot, author);
  const plans: FieldPlan[] = [];
  const controls = new Map<string, EditableControl>();
  for (const key of enabledKeys) {
    const el = slot.fields[key];
    if (!el) continue;
    const rule = AUTHOR_FIELD_RULES.find((r) => r.key === key)!;
    const fieldId = controlFieldId(platformId, slot.index, key, el);
    controls.set(fieldId, el);
    plans.push(
      planField(
        fieldId,
        `Author ${slot.index} ${rule.label}`,
        author.sequence,
        readControlValue(el),
        authorProposed(author, key),
        options,
        conflict,
      ),
    );
  }
  return { plans, controls };
}

export function planPageCoi(
  platformId: PlatformId,
  controls: EditableControl[],
  roster: Roster,
  options: FillOptions,
): { plans: FieldPlan[]; controlMap: Map<string, EditableControl> } {
  const proposed = rosterCoiText(roster);
  const plans: FieldPlan[] = [];
  const controlMap = new Map<string, EditableControl>();
  controls.forEach((el, i) => {
    const fieldId = controlFieldId(platformId, 'page', 'conflictOfInterest', el) +
      (el.id ? '' : `-${i + 1}`);
    controlMap.set(fieldId, el);
    plans.push(
      planField(
        fieldId,
        'Conflict of interest statement',
        undefined,
        readControlValue(el),
        proposed,
        options,
        false,
      ),
    );
  });
  return { plans, controlMap };
}

export function inspectLabeledForm(
  platformId: PlatformId,
  doc: Document,
): InspectReport {
  const slots = findAuthorSlots(doc);
  const fields: InspectReport['fields'] = [];
  const linkedAuthorPids: InspectReport['linkedAuthorPids'] = [];
  const seen = new Set<Element>();

  const collect = (el: EditableControl, label: string) => {
    if (seen.has(el)) return;
    seen.add(el);
    fields.push({
      fieldId: el.id || label,
      tag: el.tagName.toLowerCase(),
      type: el instanceof HTMLInputElement ? el.type : undefined,
      value: '',
      label,
    });
  };

  slots.forEach((slot) => {
    for (const [key, el] of Object.entries(slot.fields)) {
      if (!el) continue;
      collect(el, `Author ${slot.index} ${key}`);
    }
    if (slot.linkedPid) {
      linkedAuthorPids.push({ sequence: slot.index, pid: slot.linkedPid });
    }
  });
  for (const el of findPageCoiControls(doc, slots)) {
    collect(el, 'Conflict of interest');
  }

  return {
    platformId,
    authorSlots: slots.length,
    linkedAuthorPids,
    fields,
    dangerousControls: listDangerousControls(doc),
  };
}

export function fillLabeledAuthors(input: {
  platformId: PlatformId;
  doc: Document;
  roster: Roster;
  options: FillOptions;
  enabledKeys: AuthorFieldKey[];
  extraWarnings?: string[];
}): FillReport {
  const authors = sortAuthors(input.roster.authors);
  const slots = findAuthorSlots(input.doc);
  const warnings = [...(input.extraWarnings ?? [])];
  const errors: string[] = [];
  const plans: FieldPlan[] = [];
  const controls = new Map<string, EditableControl>();

  if (authors.length > slots.length) {
    warnings.push(
      `Roster has ${authors.length} authors but the page exposes ${slots.length} author slots`,
    );
  }
  if (slots.length > authors.length) {
    warnings.push(
      `Page has ${slots.length} author slots but roster has ${authors.length} authors`,
    );
  }

  const limit = Math.min(authors.length, slots.length);
  for (let i = 0; i < limit; i += 1) {
    const planned = planAuthorSlot(
      input.platformId,
      slots[i]!,
      authors[i]!,
      input.options,
      input.enabledKeys,
    );
    plans.push(...planned.plans);
    planned.controls.forEach((el, id) => controls.set(id, el));
  }

  const pageCoi = planPageCoi(
    input.platformId,
    findPageCoiControls(input.doc, slots),
    input.roster,
    input.options,
  );
  plans.push(...pageCoi.plans);
  pageCoi.controlMap.forEach((el, id) => controls.set(id, el));

  applyPlans(plans, controls, input.options);

  const dangerous = listDangerousControls(input.doc);
  if (dangerous.length) {
    warnings.push(
      `Detected ${dangerous.length} submit/certify-like controls; none were clicked`,
    );
  }

  return {
    platformId: input.platformId,
    dryRun: input.options.dryRun,
    overwrite: input.options.overwrite,
    plans,
    ...summarizePlans(plans),
    warnings,
    errors,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Fill visible author slots, then open documented add-author overlays for any
 * remaining roster authors. Preview stays dry: this mutates only when
 * dryRun=false.
 */
export async function fillLabeledAuthorsAsync(input: {
  platformId: PlatformId;
  doc: Document;
  roster: Roster;
  options: FillOptions;
  enabledKeys: AuthorFieldKey[];
  addAuthorPhrases: string[];
  saveOverlayPhrases: string[];
  extraWarnings?: string[];
}): Promise<FillReport> {
  const preflight = fillLabeledAuthors(input);
  if (input.options.dryRun || preflight.errors.length > 0) {
    return preflight;
  }

  const authors = sortAuthors(input.roster.authors);
  let slots = findAuthorSlots(input.doc);
  if (slots.length >= authors.length) {
    return fillLabeledAuthors(input);
  }

  const add = findButtonByPhrases(input.doc, input.addAuthorPhrases);
  if (!add) {
    return fillLabeledAuthors(input);
  }

  const warnings = [...preflight.warnings];
  const errors = [...preflight.errors];

  for (let i = slots.length; i < authors.length; i += 1) {
    const author = authors[i]!;
    add.click();
    await delay(0);
    const overlay = findAuthorOverlay(input.doc);
    if (!overlay) {
      errors.push(
        `Could not open the add-author overlay for roster author ${author.sequence}`,
      );
      break;
    }
    const planned = planAuthorSlot(
      input.platformId,
      overlayToSlot(overlay, i + 1),
      author,
      { overwrite: true, dryRun: false },
      input.enabledKeys,
    );
    applyPlans(planned.plans, planned.controls, {
      overwrite: true,
      dryRun: false,
    });
    const save = findButtonByPhrases(overlay, input.saveOverlayPhrases);
    if (!save) {
      errors.push(
        `Add-author overlay has no save control for author ${author.sequence}`,
      );
      break;
    }
    save.click();
    await delay(0);
    slots = findAuthorSlots(input.doc);
  }

  const after = fillLabeledAuthors(input);
  return {
    ...after,
    warnings: [...new Set([...warnings, ...after.warnings])],
    errors: [...errors, ...after.errors],
  };
}

export function validateLabeledAuthors(input: {
  platformId: PlatformId;
  doc: Document;
  roster: Roster;
}): ValidateReport {
  const authors = sortAuthors(input.roster.authors);
  const slots = findAuthorSlots(input.doc);
  const issues: ValidateReport['issues'] = [];
  let missingEmail = 0;
  let conflicts = 0;
  let filledLike = 0;
  const limit = Math.min(authors.length, slots.length);

  for (let i = 0; i < limit; i += 1) {
    const author = authors[i]!;
    const slot = slots[i]!;
    if (slotConflicts(slot, author)) {
      conflicts += 1;
      issues.push({
        code: 'linked_identity_conflict',
        severity: 'error',
        message: `Linked author at slot ${slot.index} conflicts with roster identity`,
        authorSequence: author.sequence,
      });
    }
    const email = slot.fields.email ? readControlValue(slot.fields.email) : '';
    if (!email) {
      missingEmail += 1;
      issues.push({
        code: 'missing_email',
        severity: 'warning',
        message: `Author slot ${slot.index} has no email`,
        authorSequence: author.sequence,
      });
    }
    const first = slot.fields.givenName
      ? readControlValue(slot.fields.givenName)
      : '';
    const last = slot.fields.familyName
      ? readControlValue(slot.fields.familyName)
      : '';
    if (first && last) filledLike += 1;
  }

  if (authors.length && slots.length === 0) {
    const coi = findPageCoiControls(input.doc, []);
    if (coi.some((el) => readControlValue(el))) {
      filledLike += 1;
    }
  }

  return {
    platformId: input.platformId,
    ok: issues.every((issue) => issue.severity !== 'error'),
    issues,
    summary: {
      filledLike,
      missingEmail,
      conflicts,
      mismatchedCount:
        slots.length > 0 && slots.length !== authors.length ? 1 : 0,
    },
  };
}
