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
 * jQuery UI warning after Save This Author when the institution is not in
 * the portal directory. OK proceeds; Cancel must never be clicked.
 * Live OK (PLOS, 2026-08-18):
 * `<button type="button" class="ui-button ui-widget ui-state-default
 *   ui-corner-all ui-button-text-only" role="button">
 *   <span class="ui-button-text">OK</span></button>`
 */
export const INSTITUTION_WARNING_RE =
  /institution could not be identified|proceed with this institution/i;

/**
 * First save dialog when the form still has highlighted issues (often the
 * inline “Author Institution is Unverified” state). OK continues the save;
 * it is not a hard stop.
 */
export const VALIDATION_ISSUES_RE =
  /validation found issues\.?\s*review the highlighted counts and form/i;

/** Inline typeahead state shown when the typed name is not a directory pick. */
export const INSTITUTION_UNVERIFIED_RE =
  /author institution is unverified|start typing to display potentially matching institutions/i;

/**
 * Parent-page control that opens Add New Author. Observed class is
 * `fl-add-btn`; the visible label may be Add Author, Add New Author, or
 * Add Another Author.
 */
export const ADD_ANOTHER_AUTHOR_CLASS = 'fl-add-btn';
export const ADD_AUTHOR_RE = /add\s+(?:another\s+|new\s+)?authors?\b/i;

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
