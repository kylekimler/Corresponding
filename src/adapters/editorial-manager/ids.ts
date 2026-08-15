/**
 * Editorial Manager author-form IDs from the 2026-08-15 PLOS ONE
 * RequiredRegistrationQuestions.aspx capture. Do not invent additional IDs.
 */

export const AUTHOR_FIELD_IDS = {
  firstName: 'FirstName',
  middleName: 'MiddleName',
  lastName: 'LastName',
  email: 'Email',
  affiliation: 'Affiliation',
  institution: 'Institution',
  department: 'Department',
  city: 'City',
  state: 'State',
  country: 'CountryCode',
  corresponding: 'CorrespondingAuthorCheckbox',
} as const;

export const AUTHOR_SAVE_ID = 'SaveButton';
export const AUTHOR_CANCEL_ID = 'CancelButton';
export const AUTHORS_COUNT_ID = 'authorsCount';

/** Manuscript / legal fields captured on the same page — never write these. */
export const MANUSCRIPT_FIELD_IDS = [
  'txtFullTitle',
  'fullTitleHtml',
  'txtShortTitle',
  'txtAbstract',
  'abstractHtml',
  'txtKeywords',
  'ckScratch',
  'FundingInfoNotAvailable',
] as const;

export const ADD_ANOTHER_AUTHOR_RE = /add\s+another\s+author/i;
