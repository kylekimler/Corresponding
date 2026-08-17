/**
 * Editorial Manager author-form IDs from the 2026-08-15 PLOS ONE
 * RequiredRegistrationQuestions.aspx capture, plus Zipcode and confirmed
 * ContributorRole_# from the 2026-08-17 PLOS Genetics Add New Author dialog.
 * Do not invent additional IDs.
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
  zipcode: 'Zipcode',
  country: 'CountryCode',
  corresponding: 'CorrespondingAuthorCheckbox',
} as const;

export const AUTHOR_SAVE_ID = 'SaveButton';
export const AUTHOR_CANCEL_ID = 'CancelButton';
export const AUTHORS_COUNT_ID = 'authorsCount';

/**
 * Toolbar floppy on Add New Author. Observed 2026-08-17 on PLOS Genetics:
 * `<button class="fl-tool fl-flToolSave" title="Save This Author"
 *   data-toolname="AuthorSave">`.
 */
export const SAVE_THIS_AUTHOR_RE = /save this author/i;
export const AUTHOR_SAVE_TOOL = 'AuthorSave';
export const AUTHOR_SAVE_CLASS = 'fl-flToolSave';

/**
 * jQuery UI warning after Save This Author when Ringgold cannot match the
 * institution. OK proceeds; Cancel must never be clicked.
 */
export const INSTITUTION_WARNING_RE =
  /institution could not be identified|proceed with this institution/i;

/** Parent-page control that opens the next Add New Author dialog. */
export const ADD_ANOTHER_AUTHOR_CLASS = 'fl-add-btn';

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

/**
 * Pencil that runs ToggleToEditMode. Observed 2026-08-17 on PLOS Genetics:
 * `<input type="image" id="EditButton" title="Edit Contributor Roles">`.
 */
export const EDIT_ROLES_ID = 'EditButton';
export const EDIT_ROLES_RE = /edit contributor roles/i;

/** Fallback text next to the pencil when the title is missing. */
export const SELECT_ROLES_RE = /click here to select roles/i;

/**
 * Floppy that commits the ticked roles and collapses the grid.
 * Same id as the author SaveButton (`SaveButton`), distinguished by title:
 * "Collapse and Save Changes" / onclick SaveHandler().
 */
export const COLLAPSE_SAVE_ROLES_RE = /collapse and save changes/i;

/** Portal dialog that refuses a save with no role chosen. */
export const ROLES_WARNING_RE = /please select at least one contributor role/i;

/** Parent Manuscript Data authors list, not the Add New Author form. */
export const AUTHORS_LIST_TITLE_RE = /add\/edit\/remove authors/i;
