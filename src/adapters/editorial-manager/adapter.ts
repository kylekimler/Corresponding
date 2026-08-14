import type { Roster } from '@/schema/author';
import {
  fillLabeledAuthors,
  fillLabeledAuthorsAsync,
  findAuthorSlots,
  hasPhrase,
  inspectLabeledForm,
  validateLabeledAuthors,
  type AuthorFieldKey,
} from '../labelFill';
import type {
  DetectResult,
  FillOptions,
  FillReport,
  InspectReport,
  PlatformAdapter,
  ValidateReport,
} from '../types';

/**
 * Editorial Manager Manuscript Data authors + Additional Information.
 * Labels and workflow come from Aries EM Help: +Add Another Author opens
 * Enter Author Details; Given/First Name and Family/Last Name are always
 * required; other author fields are configurable; Additional Information may
 * collect competing-interest text. Field IDs are not a public contract, so
 * matching is by those documented labels.
 */
const ENABLED_KEYS: AuthorFieldKey[] = [
  'givenName',
  'middleName',
  'familyName',
  'email',
  'orcid',
  'institution',
  'department',
  'city',
  'state',
  'country',
  'corresponding',
  'equalContribution',
  'conflictOfInterest',
];

export const editorialManagerAdapter: PlatformAdapter = {
  id: 'editorial-manager',
  label: 'Editorial Manager',

  detect(doc: Document): DetectResult {
    const evidence: string[] = [];
    let score = 0;
    if (hasPhrase(doc, 'editorial manager')) {
      evidence.push('Editorial Manager');
      score += 0.35;
    }
    if (hasPhrase(doc, 'editorialmanager')) {
      evidence.push('editorialmanager');
      score += 0.15;
    }
    if (hasPhrase(doc, 'enter author details')) {
      evidence.push('Enter Author Details');
      score += 0.25;
    }
    if (hasPhrase(doc, 'add another author')) {
      evidence.push('+Add Another Author');
      score += 0.2;
    }
    if (hasPhrase(doc, 'manuscript data') || hasPhrase(doc, 'given/first name')) {
      evidence.push('Manuscript Data');
      score += 0.15;
    }
    if (hasPhrase(doc, 'additional information')) {
      evidence.push('Additional Information');
      score += 0.2;
    }
    const slots = findAuthorSlots(doc);
    if (slots.length > 0) {
      evidence.push(`author-slots:${slots.length}`);
      score += 0.15;
    }
    const confidence = Math.min(1, score);
    return {
      platformId: confidence >= 0.5 ? 'editorial-manager' : 'unknown',
      confidence,
      label: confidence >= 0.5 ? 'Editorial Manager' : 'Unknown',
      evidence,
    };
  },

  inspect(doc: Document): InspectReport {
    return inspectLabeledForm('editorial-manager', doc);
  },

  fill(doc: Document, roster: Roster, options: FillOptions): FillReport {
    return fillLabeledAuthors({
      platformId: 'editorial-manager',
      doc,
      roster,
      options,
      enabledKeys: ENABLED_KEYS,
    });
  },

  fillAsync(
    doc: Document,
    roster: Roster,
    options: FillOptions,
  ): Promise<FillReport> {
    return fillLabeledAuthorsAsync({
      platformId: 'editorial-manager',
      doc,
      roster,
      options,
      enabledKeys: ENABLED_KEYS,
      addAuthorPhrases: ['add another author'],
      saveOverlayPhrases: ['save'],
    });
  },

  validate(doc: Document, roster: Roster): ValidateReport {
    return validateLabeledAuthors({
      platformId: 'editorial-manager',
      doc,
      roster,
    });
  },
};
