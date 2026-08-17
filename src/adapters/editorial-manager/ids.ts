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

/**
 * CRediT checkboxes from the 2026-08-15 PLOS ONE RequiredRegistrationQuestions
 * capture. Index is not a role mapping — match by the visible label.
 */
export const CONTRIBUTOR_ROLE_PREFIX = 'ContributorRole_';

/** Visible trigger next to the pencil icon on Add New Author. */
export const SELECT_ROLES_RE = /click here to select roles/i;

/** Portal dialog that refuses a save with no role chosen. */
export const ROLES_WARNING_RE = /please select at least one contributor role/i;

/** Parent Manuscript Data authors list, not the Add New Author form. */
export const AUTHORS_LIST_TITLE_RE = /add\/edit\/remove authors/i;
