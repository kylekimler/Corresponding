import { AUTHOR_FIELD_IDS, MANUSCRIPT_FIELD_IDS } from '@/adapters/editorial-manager/ids';
import {
  CORR_FIELDS,
  NUM_AUTHORS,
} from '@/adapters/nature-mts/ids';
import {
  AUTHOR_EMAIL,
  AUTHOR_FIRST_NAME,
  AUTHOR_LAST_NAME,
  AUTHOR_SALUTATION,
  AUTHORSHIP_CHANGE,
  FIND_AUTHOR_EMAIL,
  SEARCH_AUTHOR,
} from '@/adapters/scholarone/ids';
import { mayFill } from '@/recognition/confidence';
import { extractControlFeatures } from '@/recognition/features';
import { proposeSemanticMappings } from '@/recognition/semantic';
import type { CanonicalField } from '@/recognition/types';

export type RecognizedAuthorField = {
  field: CanonicalField;
  confidence: number;
  source: 'exact_selector' | 'platform_pattern' | 'semantic_label';
  sequence?: number;
  corresponding?: boolean;
};

const EM_FIELD_BY_ID: Record<string, CanonicalField> = {
  [AUTHOR_FIELD_IDS.firstName]: 'givenName',
  [AUTHOR_FIELD_IDS.middleName]: 'middleName',
  [AUTHOR_FIELD_IDS.lastName]: 'familyName',
  [AUTHOR_FIELD_IDS.email]: 'email',
  [AUTHOR_FIELD_IDS.affiliation]: 'institution',
  [AUTHOR_FIELD_IDS.institution]: 'institution',
  [AUTHOR_FIELD_IDS.department]: 'department',
  [AUTHOR_FIELD_IDS.city]: 'city',
  [AUTHOR_FIELD_IDS.state]: 'state',
  [AUTHOR_FIELD_IDS.country]: 'country',
  [AUTHOR_FIELD_IDS.corresponding]: 'corresponding',
};

const NATURE_CORR_BY_ID: Record<string, CanonicalField> = {
  [CORR_FIELDS.first]: 'givenName',
  [CORR_FIELDS.middle]: 'middleName',
  [CORR_FIELDS.last]: 'familyName',
  [CORR_FIELDS.email]: 'email',
  [CORR_FIELDS.sequence]: 'sequence',
};

const NATURE_CONTRIB_RE =
  /^contrib_auth_(\d+)_(first_nm|middle_nm|last_nm|email|org|city|country|author_seq)$/;

const NATURE_CONTRIB_FIELD: Record<string, CanonicalField> = {
  first_nm: 'givenName',
  middle_nm: 'middleName',
  last_nm: 'familyName',
  email: 'email',
  org: 'institution',
  city: 'city',
  country: 'country',
  author_seq: 'sequence',
};

const SCHOLARONE_AFFILIATION_RE =
  /^(AUTHOR_DEPARTMENT|AUTHOR_INSTITUTION|COUNTRY|STATE_ID|STATE|CITY)_(\d+)$/;

const BIORXIV_NAME_FIELD: Record<string, CanonicalField> = {
  firstName: 'givenName',
  lastName: 'familyName',
  affiliation: 'institution',
};

const LOOKUP_IDS = new Set([FIND_AUTHOR_EMAIL, SEARCH_AUTHOR]);
const MANUSCRIPT_IDS = new Set<string>([
  ...MANUSCRIPT_FIELD_IDS,
  AUTHORSHIP_CHANGE,
  NUM_AUTHORS,
]);

function isEditableControl(el: Element): el is
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  );
}

function exact(
  field: CanonicalField,
  extras?: Partial<RecognizedAuthorField>,
): RecognizedAuthorField {
  return {
    field,
    confidence: 1,
    source: 'exact_selector',
    ...extras,
  };
}

function matchKnownId(
  id: string | undefined,
  name: string | undefined,
): RecognizedAuthorField | null {
  const keys = [id, name].filter((value): value is string => Boolean(value));
  for (const key of keys) {
    if (LOOKUP_IDS.has(key) || MANUSCRIPT_IDS.has(key)) return null;

    if (key in EM_FIELD_BY_ID) {
      return exact(EM_FIELD_BY_ID[key]!);
    }
    if (key in NATURE_CORR_BY_ID) {
      return exact(NATURE_CORR_BY_ID[key]!, { corresponding: true });
    }
    const contrib = NATURE_CONTRIB_RE.exec(key);
    if (contrib) {
      return exact(NATURE_CONTRIB_FIELD[contrib[2]!]!, {
        sequence: Number(contrib[1]),
      });
    }
    if (
      key === AUTHOR_FIRST_NAME ||
      key === AUTHOR_LAST_NAME ||
      key === AUTHOR_EMAIL ||
      key === AUTHOR_SALUTATION
    ) {
      const field =
        key === AUTHOR_FIRST_NAME
          ? 'givenName'
          : key === AUTHOR_LAST_NAME
            ? 'familyName'
            : key === AUTHOR_EMAIL
              ? 'email'
              : 'givenName';
      return exact(field);
    }
    const affiliation = SCHOLARONE_AFFILIATION_RE.exec(key);
    if (affiliation) {
      const kind = affiliation[1];
      const field: CanonicalField =
        kind === 'AUTHOR_DEPARTMENT'
          ? 'department'
          : kind === 'AUTHOR_INSTITUTION'
            ? 'institution'
            : kind === 'COUNTRY'
              ? 'country'
              : kind === 'CITY'
                ? 'city'
                : 'state';
      return exact(field);
    }
    if (key in BIORXIV_NAME_FIELD) {
      return exact(BIORXIV_NAME_FIELD[key]!, { source: 'platform_pattern' });
    }
  }
  return null;
}

/**
 * Confident author-entry field, or null. Prefers tested platform IDs.
 * Rejects search, password, manuscript, and low-confidence guesses.
 */
export function recognizeAuthorField(el: Element): RecognizedAuthorField | null {
  if (!isEditableControl(el)) return null;
  if (el.disabled || ('readOnly' in el && el.readOnly) || el.closest('[hidden], [inert], [aria-hidden="true"]')) return null;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style?.display === 'none' || style?.visibility === 'hidden') return null;

  const inputType =
    el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : undefined;
  if (
    inputType === 'password' ||
    inputType === 'hidden' ||
    inputType === 'submit' ||
    inputType === 'button' ||
    inputType === 'file' ||
    inputType === 'search'
  ) {
    return null;
  }

  const id = el.id || undefined;
  const name = el.getAttribute('name') || undefined;
  if (
    (id && (LOOKUP_IDS.has(id) || MANUSCRIPT_IDS.has(id))) ||
    (name && (LOOKUP_IDS.has(name) || MANUSCRIPT_IDS.has(name)))
  ) {
    return null;
  }

  const known = matchKnownId(id, name);
  if (known) return known;

  const features = extractControlFeatures(el);
  if (!features || features.hidden || features.disabled) return null;
  if (/\b(find|search|lookup)\b/.test(features.normalizedText)) return null;

  const [proposal] = proposeSemanticMappings([features]);
  if (
    !proposal ||
    proposal.canonicalField === 'unknown' ||
    proposal.unresolved ||
    !mayFill(proposal.confidence)
  ) {
    return null;
  }
  if (
    proposal.source !== 'semantic_label' &&
    proposal.source !== 'exact_selector' &&
    proposal.source !== 'platform_pattern'
  ) {
    return null;
  }

  return {
    field: proposal.canonicalField,
    confidence: proposal.confidence,
    source: proposal.source === 'exact_selector' ? 'exact_selector' : 'semantic_label',
  };
}

export function isRecognizedAuthorField(el: Element): boolean {
  return recognizeAuthorField(el) !== null;
}
