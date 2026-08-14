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
 * ScholarOne Authors & Institutions + Details & Comments.
 * Labels and workflow come from the official Author Center User Guide
 * (Silverchair / Clarivate): email search, Create New Author / Create New
 * Co-Author, Add Created Author, and a later Details & Comments step that may
 * collect conflict-of-interest text. Field IDs are not a public contract, so
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
  'conflictOfInterest',
];

export const scholarOneAdapter: PlatformAdapter = {
  id: 'scholarone',
  label: 'ScholarOne Manuscripts',

  detect(doc: Document): DetectResult {
    const evidence: string[] = [];
    let score = 0;
    if (hasPhrase(doc, 'scholarone')) {
      evidence.push('ScholarOne');
      score += 0.35;
    }
    if (
      hasPhrase(doc, 'manuscript central') ||
      hasPhrase(doc, 'manuscriptcentral')
    ) {
      evidence.push('Manuscript Central');
      score += 0.2;
    }
    if (hasPhrase(doc, 'authors & institutions')) {
      evidence.push('Authors & Institutions');
      score += 0.25;
    }
    if (
      hasPhrase(doc, 'create new author') ||
      hasPhrase(doc, 'add created author')
    ) {
      evidence.push('Create New Author');
      score += 0.15;
    }
    if (hasPhrase(doc, 'details & comments')) {
      evidence.push('Details & Comments');
      score += 0.1;
    }
    const slots = findAuthorSlots(doc);
    if (slots.length > 0) {
      evidence.push(`author-slots:${slots.length}`);
      score += 0.15;
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
    return inspectLabeledForm('scholarone', doc);
  },

  fill(doc: Document, roster: Roster, options: FillOptions): FillReport {
    return fillLabeledAuthors({
      platformId: 'scholarone',
      doc,
      roster,
      options,
      enabledKeys: ENABLED_KEYS,
      extraWarnings: [
        'ScholarOne email Search is left to the human so an existing account is never auto-attached.',
      ],
    });
  },

  fillAsync(
    doc: Document,
    roster: Roster,
    options: FillOptions,
  ): Promise<FillReport> {
    return fillLabeledAuthorsAsync({
      platformId: 'scholarone',
      doc,
      roster,
      options,
      enabledKeys: ENABLED_KEYS,
      addAuthorPhrases: ['create new co-author', 'create new author'],
      saveOverlayPhrases: ['add created author', 'save'],
      extraWarnings: [
        'ScholarOne email Search is left to the human so an existing account is never auto-attached.',
      ],
    });
  },

  validate(doc: Document, roster: Roster): ValidateReport {
    return validateLabeledAuthors({
      platformId: 'scholarone',
      doc,
      roster,
    });
  },
};
