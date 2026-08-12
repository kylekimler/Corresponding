import {
  primaryAffiliation,
  sortAuthors,
  type Author,
  type Roster,
} from '@/schema/author';
import { identitiesConflict, readValue, setValue } from '../dom';
import { listDangerousControls } from '../safety';
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
  CONTRIB_SUFFIXES,
  CORR_FIELDS,
  NUM_AUTHORS,
  contribField,
  linkedPidField,
} from './ids';

function countContribSlots(doc: Document): number {
  let n = 0;
  while (doc.getElementById(contribField(n + 1, 'first_nm'))) {
    n += 1;
  }
  return n;
}

function readNumAuthors(doc: Document): number | undefined {
  const raw = readValue(doc, NUM_AUTHORS);
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function linkedPid(doc: Document, index: number): string {
  return readValue(doc, linkedPidField(index));
}

function planField(
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

function applyPlan(
  doc: Document,
  plan: FieldPlan,
  options: FillOptions,
): void {
  if (options.dryRun) return;
  if (
    plan.action !== 'fill' &&
    plan.action !== 'overwrite'
  ) {
    return;
  }
  if (plan.proposedValue === undefined) return;
  setValue(doc, plan.fieldId, plan.proposedValue, {
    overwrite: true,
    dryRun: false,
  });
}

function authorConflict(
  doc: Document,
  index: number,
  author: Author,
): boolean {
  const pid = linkedPid(doc, index);
  if (!pid) return false;
  const portal = {
    email: readValue(doc, contribField(index, 'email')),
    familyName: readValue(doc, contribField(index, 'last_nm')),
    givenName: readValue(doc, contribField(index, 'first_nm')),
  };
  // Linked PID with blank portal fields: prefer false negative — refuse overwrite
  // of an account that may still be bound server-side.
  const hasPortalIdentity = Boolean(
    portal.email || portal.familyName || portal.givenName,
  );
  if (!hasPortalIdentity) {
    return true;
  }
  return identitiesConflict(
    portal,
    {
      email: author.email || '',
      familyName: author.familyName,
      givenName: author.givenName,
    },
    { linkedPid: true },
  );
}

function buildAuthorFieldPlans(
  doc: Document,
  author: Author,
  index: number,
  options: FillOptions,
): FieldPlan[] {
  const conflict = authorConflict(doc, index, author);
  const aff = primaryAffiliation(author);
  const specs: Array<{
    suffix: string;
    label: string;
    value: string | undefined;
  }> = [
    { suffix: 'first_nm', label: 'First name', value: author.givenName },
    { suffix: 'middle_nm', label: 'Middle name', value: author.middleName || '' },
    { suffix: 'last_nm', label: 'Last name', value: author.familyName },
    { suffix: 'email', label: 'Email', value: author.email || '' },
    { suffix: 'org', label: 'Organization', value: aff?.institution || '' },
    { suffix: 'city', label: 'City', value: aff?.city || '' },
    { suffix: 'country', label: 'Country', value: aff?.country || '' },
    {
      suffix: 'author_seq',
      label: 'Author sequence',
      value: String(author.sequence),
    },
  ];

  return specs.map((spec) => {
    const fieldId = contribField(index, spec.suffix);
    const current = readValue(doc, fieldId);
    const proposed =
      spec.value === '' && spec.suffix === 'middle_nm'
        ? undefined
        : spec.value || undefined;
    // Allow explicit empty middle name to clear only when overwrite and value is '' — treat empty optional as missing_source unless overwrite wants clear.
    const proposedOrEmpty =
      spec.suffix === 'middle_nm' ? (author.middleName ?? '') : proposed;
    return planField(
      fieldId,
      `Author ${index} ${spec.label}`,
      author.sequence,
      current,
      proposedOrEmpty === '' && spec.suffix !== 'middle_nm'
        ? undefined
        : proposedOrEmpty,
      options,
      conflict,
    );
  });
}

function buildCorrPlans(
  doc: Document,
  corresponding: Author | undefined,
  contribIndex: number | undefined,
  options: FillOptions,
): FieldPlan[] {
  if (!corresponding) {
    return Object.values(CORR_FIELDS).map((fieldId) => ({
      fieldId,
      label: fieldId,
      action: 'missing_source' as const,
      currentValue: readValue(doc, fieldId),
      reason: 'No corresponding author in roster',
    }));
  }

  // If the corresponding author maps to a linked contrib slot in conflict,
  // refuse to fill the corresponding block as well (prefer false negative).
  const conflict =
    contribIndex !== undefined
      ? authorConflict(doc, contribIndex, corresponding)
      : false;

  const specs: Array<{ id: string; label: string; value: string | undefined }> =
    [
      {
        id: CORR_FIELDS.first,
        label: 'Corresponding first name',
        value: corresponding.givenName,
      },
      {
        id: CORR_FIELDS.middle,
        label: 'Corresponding middle name',
        value: corresponding.middleName ?? '',
      },
      {
        id: CORR_FIELDS.last,
        label: 'Corresponding last name',
        value: corresponding.familyName,
      },
      {
        id: CORR_FIELDS.email,
        label: 'Corresponding email',
        value: corresponding.email || undefined,
      },
      {
        id: CORR_FIELDS.sequence,
        label: 'Corresponding sequence',
        value: String(corresponding.sequence),
      },
    ];

  return specs.map((spec) =>
    planField(
      spec.id,
      spec.label,
      corresponding.sequence,
      readValue(doc, spec.id),
      spec.value === '' ? undefined : spec.value,
      options,
      conflict,
    ),
  );
}

function summarize(plans: FieldPlan[]): Omit<
  FillReport,
  | 'platformId'
  | 'dryRun'
  | 'overwrite'
  | 'plans'
  | 'warnings'
  | 'errors'
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

export const natureMtsAdapter: PlatformAdapter = {
  id: 'nature-mts',
  label: 'Nature MTS / eJournalPress',

  detect(doc: Document): DetectResult {
    const evidence: string[] = [];
    let score = 0;
    if (doc.getElementById(NUM_AUTHORS)) {
      evidence.push(NUM_AUTHORS);
      score += 0.35;
    }
    if (doc.getElementById(CORR_FIELDS.first)) {
      evidence.push(CORR_FIELDS.first);
      score += 0.25;
    }
    if (doc.getElementById(contribField(1, 'first_nm'))) {
      evidence.push(contribField(1, 'first_nm'));
      score += 0.25;
    }
    if (doc.getElementById(linkedPidField(1))) {
      evidence.push(linkedPidField(1));
      score += 0.15;
    }
    const confidence = Math.min(1, score);
    return {
      platformId: confidence >= 0.5 ? 'nature-mts' : 'unknown',
      confidence,
      label: confidence >= 0.5 ? 'Nature MTS / eJournalPress' : 'Unknown',
      evidence,
    };
  },

  inspect(doc: Document): InspectReport {
    const slots = countContribSlots(doc);
    const linkedAuthorPids: InspectReport['linkedAuthorPids'] = [];
    const fields: InspectReport['fields'] = [];

    const collect = (fieldId: string, label?: string) => {
      const el = doc.getElementById(fieldId);
      if (!el) return;
      // Never return raw values over messaging — structure only.
      fields.push({
        fieldId,
        tag: el.tagName.toLowerCase(),
        type: el instanceof HTMLInputElement ? el.type : undefined,
        value: '',
        label,
      });
    };

    collect(NUM_AUTHORS, 'Number of authors');
    for (const id of Object.values(CORR_FIELDS)) collect(id);
    for (let i = 1; i <= slots; i += 1) {
      for (const suffix of CONTRIB_SUFFIXES) {
        collect(contribField(i, suffix));
      }
      const pid = linkedPid(doc, i);
      collect(linkedPidField(i), 'Linked author PID');
      if (pid) linkedAuthorPids.push({ sequence: i, pid });
    }

    return {
      platformId: 'nature-mts',
      authorSlots: slots,
      numAuthorsField: readNumAuthors(doc),
      linkedAuthorPids,
      fields,
      dangerousControls: listDangerousControls(doc),
    };
  },

  fill(doc: Document, roster: Roster, options: FillOptions): FillReport {
    const authors = sortAuthors(roster.authors);
    const slots = countContribSlots(doc);
    const warnings: string[] = [];
    const errors: string[] = [];
    const plans: FieldPlan[] = [];

    const numPlan = planField(
      NUM_AUTHORS,
      'Number of authors',
      undefined,
      readValue(doc, NUM_AUTHORS),
      String(authors.length),
      options,
      false,
    );
    plans.push(numPlan);

    if (authors.length > slots) {
      warnings.push(
        `Roster has ${authors.length} authors but form only exposes ${slots} contributor slots`,
      );
    }
    if (authors.length < slots) {
      warnings.push(
        `Form has ${slots} contributor slots but roster has ${authors.length} authors`,
      );
    }

    const corresponding =
      authors.find((a) => a.isCorresponding) ?? authors[0];
    const correspondingContribIndex = corresponding
      ? authors.indexOf(corresponding) + 1
      : undefined;
    const corrSlotIndex =
      correspondingContribIndex !== undefined &&
      correspondingContribIndex <= slots
        ? correspondingContribIndex
        : undefined;

    plans.push(
      ...buildCorrPlans(doc, corresponding, corrSlotIndex, options),
    );

    const limit = Math.min(authors.length, slots);
    for (let i = 0; i < limit; i += 1) {
      const author = authors[i]!;
      const index = i + 1;
      plans.push(...buildAuthorFieldPlans(doc, author, index, options));
    }

    for (const plan of plans) {
      applyPlan(doc, plan, options);
    }

    // Safety: never touch dangerous controls during fill.
    const dangerous = listDangerousControls(doc);
    if (dangerous.length) {
      warnings.push(
        `Detected ${dangerous.length} submit/certify-like controls; none were clicked`,
      );
    }

    return {
      platformId: 'nature-mts',
      dryRun: options.dryRun,
      overwrite: options.overwrite,
      plans,
      ...summarize(plans),
      warnings,
      errors,
    };
  },

  validate(doc: Document, roster: Roster): ValidateReport {
    const authors = sortAuthors(roster.authors);
    const slots = countContribSlots(doc);
    const issues: ValidateReport['issues'] = [];
    let missingEmail = 0;
    let conflicts = 0;
    let filledLike = 0;

    const num = readNumAuthors(doc);
    let mismatchedCount = 0;
    if (num !== undefined && num !== authors.length) {
      mismatchedCount = 1;
      issues.push({
        code: 'num_authors_mismatch',
        severity: 'warning',
        message: `num_authors is ${num} but roster has ${authors.length} authors`,
        fieldId: NUM_AUTHORS,
      });
    }

    const limit = Math.min(authors.length, slots);
    for (let i = 0; i < limit; i += 1) {
      const author = authors[i]!;
      const index = i + 1;
      if (authorConflict(doc, index, author)) {
        conflicts += 1;
        issues.push({
          code: 'linked_identity_conflict',
          severity: 'error',
          message: `Linked author at slot ${index} conflicts with roster identity`,
          authorSequence: author.sequence,
          fieldId: linkedPidField(index),
        });
      }

      const email = readValue(doc, contribField(index, 'email'));
      if (!email) {
        missingEmail += 1;
        issues.push({
          code: 'missing_email',
          severity: 'warning',
          message: `Author slot ${index} has no email`,
          authorSequence: author.sequence,
          fieldId: contribField(index, 'email'),
        });
      }

      const first = readValue(doc, contribField(index, 'first_nm'));
      const last = readValue(doc, contribField(index, 'last_nm'));
      if (first && last) filledLike += 1;
    }

    return {
      platformId: 'nature-mts',
      ok: issues.every((i) => i.severity !== 'error'),
      issues,
      summary: {
        filledLike,
        missingEmail,
        conflicts,
        mismatchedCount,
      },
    };
  },
};
