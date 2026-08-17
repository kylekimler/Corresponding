import { collectReadableDocuments } from '@/diagnostics/frames';
import {
  primaryAffiliation,
  sortAuthors,
  type Author,
  type Roster,
} from '@/schema/author';
import { identitiesConflict, readValue, setValue } from '../dom';
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
  findAddAnotherAuthorControl,
  findAuthorFormDocument,
} from './documents';
import {
  AUTHOR_FIELD_IDS,
  AUTHOR_SAVE_ID,
  MANUSCRIPT_FIELD_IDS,
} from './ids';

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

function clickAuthorSave(form: Document): boolean {
  const save = form.getElementById(AUTHOR_SAVE_ID);
  if (!save || typeof (save as HTMLElement).click !== 'function') return false;
  assertSafeMutationTarget(save);
  (save as HTMLElement).click();
  return true;
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
        errors: [
          'Editorial Manager author form was not found. Open Manuscript Data → Authors (Add/Edit Author), then retry.',
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
        const saved = clickAuthorSave(currentForm);
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
