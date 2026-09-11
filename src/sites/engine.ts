import {
  primaryAffiliation,
  sortAuthors,
  type Author,
  type Roster,
} from '@/schema/author';
import { identitiesConflict, readValue, setValue } from '@/adapters/dom';
import { listDangerousControls } from '@/adapters/safety';
import type {
  DetectResult,
  FieldPlan,
  FillOptions,
  FillReport,
  InspectReport,
  PlatformAdapter,
  ValidateReport,
} from '@/adapters/types';
import {
  expandId,
  type AuthorFieldKey,
  type SiteDefinition,
} from './schema';

const FIELD_LABELS: Record<AuthorFieldKey, string> = {
  givenName: 'First name',
  middleName: 'Middle name',
  familyName: 'Last name',
  email: 'Email',
  orcid: 'ORCID',
  institution: 'Organization',
  department: 'Department',
  city: 'City',
  state: 'State',
  country: 'Country',
  sequence: 'Author sequence',
};

const CORR_LABELS: Partial<Record<AuthorFieldKey, string>> = {
  givenName: 'Corresponding first name',
  middleName: 'Corresponding middle name',
  familyName: 'Corresponding last name',
  email: 'Corresponding email',
  sequence: 'Corresponding sequence',
};

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

function applyPlan(doc: Document, plan: FieldPlan, options: FillOptions): void {
  if (options.dryRun) return;
  if (plan.action !== 'fill' && plan.action !== 'overwrite') return;
  if (plan.proposedValue === undefined) return;
  setValue(doc, plan.fieldId, plan.proposedValue, {
    overwrite: true,
    dryRun: false,
  });
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

function authorFieldValue(author: Author, key: AuthorFieldKey): string | undefined {
  const aff = primaryAffiliation(author);
  switch (key) {
    case 'givenName':
      return author.givenName;
    case 'middleName':
      return author.middleName ?? '';
    case 'familyName':
      return author.familyName;
    case 'email':
      return author.email || undefined;
    case 'orcid':
      return author.orcid || undefined;
    case 'institution':
      return aff?.institution || undefined;
    case 'department':
      return aff?.department || undefined;
    case 'city':
      return aff?.city || undefined;
    case 'state':
      return aff?.state || undefined;
    case 'country':
      return aff?.country || undefined;
    case 'sequence':
      return String(author.sequence);
    default:
      return undefined;
  }
}

function countSlots(doc: Document, site: SiteDefinition): number {
  const authors = site.authors;
  if (!authors) return 0;
  let n = 0;
  let index = authors.start;
  while (doc.getElementById(expandId(authors.slot, index))) {
    n += 1;
    index += 1;
  }
  return n;
}

function linkedPid(doc: Document, site: SiteDefinition, index: number): string {
  const template = site.authors?.linkedPid;
  if (!template) return '';
  return readValue(doc, expandId(template, index));
}

function authorConflict(
  doc: Document,
  site: SiteDefinition,
  index: number,
  author: Author,
): boolean {
  const pid = linkedPid(doc, site, index);
  if (!pid) return false;
  const fields = site.authors?.fields ?? {};
  const portal = {
    email: fields.email
      ? readValue(doc, expandId(fields.email, index))
      : '',
    familyName: fields.familyName
      ? readValue(doc, expandId(fields.familyName, index))
      : '',
    givenName: fields.givenName
      ? readValue(doc, expandId(fields.givenName, index))
      : '',
  };
  const hasPortalIdentity = Boolean(
    portal.email || portal.familyName || portal.givenName,
  );
  if (!hasPortalIdentity) return true;
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

function readCount(doc: Document, site: SiteDefinition): number | undefined {
  if (!site.countField) return undefined;
  const raw = readValue(doc, site.countField);
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function refusedFill(site: SiteDefinition, options: FillOptions): FillReport {
  return {
    platformId: site.id,
    dryRun: options.dryRun,
    overwrite: options.overwrite,
    plans: [],
    filled: 0,
    preserved: 0,
    overwritten: 0,
    skippedConflicts: 0,
    missingSource: 0,
    unmapped: 0,
    warnings: [
      `${site.label} adapter is a stub. Provide a real DOM fixture before implementing selectors.`,
    ],
    errors: [`Unsupported platform: ${site.id}`],
  };
}

export function createSiteAdapter(site: SiteDefinition): PlatformAdapter {
  const canFill = Boolean(site.autofill && site.authors);

  return {
    id: site.id,
    label: site.label,

    detect(doc: Document): DetectResult {
      const evidence: string[] = [];
      let score = 0;
      for (const item of site.detect.ids) {
        const id = typeof item === 'string' ? item : item.id;
        const weight = typeof item === 'string' ? 0.5 : item.score;
        if (doc.getElementById(id)) {
          evidence.push(id);
          score += weight;
        }
      }
      const haystack = `${doc.body?.innerHTML ?? ''}`.toLowerCase();
      for (const hint of site.detect.text) {
        const needle = hint.toLowerCase();
        if (
          haystack.includes(needle) ||
          doc.querySelector(`[id*="${hint}"], [name*="${hint}"]`)
        ) {
          evidence.push(hint);
          score += 0.1;
        }
      }
      let confidence = Math.min(1, score);
      if (site.detect.maxConfidence !== undefined) {
        confidence = Math.min(confidence, site.detect.maxConfidence);
      }
      const known = confidence >= 0.5;
      return {
        platformId: known ? site.id : 'unknown',
        confidence,
        label: known
          ? site.label
          : evidence.length
            ? `${site.label} (unsupported — needs fixture)`
            : 'Unknown',
        evidence,
      };
    },

    inspect(doc: Document): InspectReport {
      const slots = countSlots(doc, site);
      const linkedAuthorPids: InspectReport['linkedAuthorPids'] = [];
      const fields: InspectReport['fields'] = [];

      const collect = (fieldId: string, label?: string) => {
        const el = doc.getElementById(fieldId);
        if (!el) return;
        fields.push({
          fieldId,
          tag: el.tagName.toLowerCase(),
          type: el instanceof HTMLInputElement ? el.type : undefined,
          value: '',
          label,
        });
      };

      if (site.countField) collect(site.countField, 'Number of authors');
      if (site.corresponding) {
        for (const id of Object.values(site.corresponding)) {
          if (id) collect(id);
        }
      }
      const authorFields = site.authors;
      for (let i = 0; i < slots; i += 1) {
        const index = (authorFields?.start ?? 1) + i;
        if (authorFields) {
          for (const template of Object.values(authorFields.fields)) {
            collect(expandId(template, index));
          }
          if (authorFields.linkedPid) {
            const pid = linkedPid(doc, site, index);
            collect(expandId(authorFields.linkedPid, index), 'Linked author PID');
            if (pid) linkedAuthorPids.push({ sequence: index, pid });
          }
        }
      }

      return {
        platformId: site.id,
        authorSlots: slots,
        numAuthorsField: readCount(doc, site),
        linkedAuthorPids,
        fields,
        dangerousControls: listDangerousControls(doc),
      };
    },

    fill(doc: Document, roster: Roster, options: FillOptions): FillReport {
      if (!canFill || !site.authors) return refusedFill(site, options);

      const scoped = options.onlySequences;
      const authors = sortAuthors(roster.authors).filter(
        (author) => !scoped || scoped.includes(author.sequence),
      );
      const slots = countSlots(doc, site);
      const warnings: string[] = [];
      const errors: string[] = [];
      const plans: FieldPlan[] = [];
      const start = site.authors.start;

      if (site.countField && !scoped) {
        plans.push(
          planField(
            site.countField,
            'Number of authors',
            undefined,
            readValue(doc, site.countField),
            String(authors.length),
            options,
            false,
          ),
        );
      }

      if (!scoped && authors.length > slots) {
        warnings.push(
          `Roster has ${authors.length} authors but form only exposes ${slots} contributor slots`,
        );
      }
      if (!scoped && authors.length < slots) {
        warnings.push(
          `Form has ${slots} contributor slots but roster has ${authors.length} authors`,
        );
      }

      const corresponding = scoped
        ? authors.find((a) => a.isCorresponding)
        : authors.find((a) => a.isCorresponding) ?? authors[0];
      const correspondingContribIndex = corresponding
        ? authors.indexOf(corresponding) + start
        : undefined;
      const corrSlotIndex =
        correspondingContribIndex !== undefined &&
        correspondingContribIndex < start + slots
          ? correspondingContribIndex
          : undefined;

      if (site.corresponding) {
        if (!corresponding) {
          for (const fieldId of Object.values(site.corresponding)) {
            if (!fieldId) continue;
            plans.push({
              fieldId,
              label: fieldId,
              action: 'missing_source',
              currentValue: readValue(doc, fieldId),
              reason: 'No corresponding author in roster',
            });
          }
        } else {
          const conflict =
            corrSlotIndex !== undefined
              ? authorConflict(doc, site, corrSlotIndex, corresponding)
              : false;
          const entries: Array<[AuthorFieldKey, string | undefined]> = [
            ['givenName', site.corresponding.givenName],
            ['middleName', site.corresponding.middleName],
            ['familyName', site.corresponding.familyName],
            ['email', site.corresponding.email],
            ['sequence', site.corresponding.sequence],
          ];
          for (const [key, fieldId] of entries) {
            if (!fieldId) continue;
            const value = authorFieldValue(corresponding, key);
            plans.push(
              planField(
                fieldId,
                CORR_LABELS[key] ?? fieldId,
                corresponding.sequence,
                readValue(doc, fieldId),
                value === '' ? undefined : value,
                options,
                conflict,
              ),
            );
          }
        }
      }

      const limit = Math.min(authors.length, slots);
      for (let i = 0; i < limit; i += 1) {
        const author = authors[i]!;
        const index = scoped ? author.sequence : start + i;
        if (index < start || index >= start + slots) continue;
        const conflict = authorConflict(doc, site, index, author);
        for (const [key, template] of Object.entries(site.authors.fields) as Array<
          [AuthorFieldKey, string]
        >) {
          const fieldId = expandId(template, index);
          const raw = authorFieldValue(author, key);
          const proposed =
            key === 'middleName' ? (author.middleName ?? '') : raw;
          plans.push(
            planField(
              fieldId,
              `Author ${index} ${FIELD_LABELS[key]}`,
              author.sequence,
              readValue(doc, fieldId),
              proposed === '' && key !== 'middleName' ? undefined : proposed,
              options,
              conflict,
            ),
          );
        }
      }

      for (const plan of plans) applyPlan(doc, plan, options);

      const dangerous = listDangerousControls(doc);
      if (dangerous.length) {
        warnings.push(
          `Detected ${dangerous.length} submit/certify-like controls; none were clicked`,
        );
      }

      return {
        platformId: site.id,
        dryRun: options.dryRun,
        overwrite: options.overwrite,
        plans,
        ...summarize(plans),
        warnings,
        errors,
      };
    },

    validate(doc: Document, roster: Roster): ValidateReport {
      if (!canFill || !site.authors) {
        return {
          platformId: site.id,
          ok: false,
          issues: [
            {
              code: 'unsupported_platform',
              severity: 'error',
              message: `${site.label} is not implemented yet. Use the diagnostic tool to capture a redacted form map.`,
            },
          ],
          summary: {
            filledLike: 0,
            missingEmail: 0,
            conflicts: 0,
            mismatchedCount: 0,
          },
        };
      }

      const authors = sortAuthors(roster.authors);
      const slots = countSlots(doc, site);
      const issues: ValidateReport['issues'] = [];
      let missingEmail = 0;
      let conflicts = 0;
      let filledLike = 0;
      const start = site.authors.start;
      const fields = site.authors.fields;

      const num = readCount(doc, site);
      let mismatchedCount = 0;
      if (num !== undefined && num !== authors.length) {
        mismatchedCount = 1;
        issues.push({
          code: 'num_authors_mismatch',
          severity: 'warning',
          message: `num_authors is ${num} but roster has ${authors.length} authors`,
          fieldId: site.countField,
        });
      }

      const limit = Math.min(authors.length, slots);
      for (let i = 0; i < limit; i += 1) {
        const author = authors[i]!;
        const index = start + i;
        if (authorConflict(doc, site, index, author)) {
          conflicts += 1;
          issues.push({
            code: 'linked_identity_conflict',
            severity: 'error',
            message: `Linked author at slot ${index} conflicts with roster identity`,
            authorSequence: author.sequence,
            fieldId: site.authors.linkedPid
              ? expandId(site.authors.linkedPid, index)
              : undefined,
          });
        }

        if (fields.email) {
          const email = readValue(doc, expandId(fields.email, index));
          if (!email) {
            missingEmail += 1;
            issues.push({
              code: 'missing_email',
              severity: 'warning',
              message: `Author slot ${index} has no email`,
              authorSequence: author.sequence,
              fieldId: expandId(fields.email, index),
            });
          }
        }

        const first = fields.givenName
          ? readValue(doc, expandId(fields.givenName, index))
          : '';
        const last = fields.familyName
          ? readValue(doc, expandId(fields.familyName, index))
          : '';
        if (first && last) filledLike += 1;
      }

      return {
        platformId: site.id,
        ok: issues.every((issue) => issue.severity !== 'error'),
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
}
