/**
 * ScholarOne Manuscripts field and control ids observed in the redacted
 * Bioinformatics (mc.manuscriptcentral.com/bioinformatics) compatibility capture
 * capturedAt 2026-08-14T23:13:16.764Z. Digits in live ids are normalized to #
 * in captures; affiliation slots use a trailing index (e.g. AUTHOR_DEPARTMENT_1).
 */

export const FIND_AUTHOR_EMAIL = 'findAuthorEmailId';
export const SEARCH_AUTHOR = 'searchAuthorId';
export const EMAIL_SEARCH_MODAL_YES = 'emailSearchModal_yes';
export const EMAIL_SEARCH_MODAL_NO = 'emailSearchModal_no';

export const AUTHOR_EMAIL = 'AUTHOR_EMAIL_ADDRESS';
export const AUTHOR_SALUTATION = 'AUTHOR_SALUTATION';
export const AUTHOR_FIRST_NAME = 'AUTHOR_FIRST_NAME';
export const AUTHOR_LAST_NAME = 'AUTHOR_LAST_NAME';
export const AUTHORSHIP_CHANGE = 'AUTHORSHIP_CHANGE_TEXTAREA';

/** Affiliation / contact fields use a 1-based trailing index. */
export function authorDepartment(index = 1): string {
  return `AUTHOR_DEPARTMENT_${index}`;
}
export function authorCountry(index = 1): string {
  return `COUNTRY_${index}`;
}
export function authorStateId(index = 1): string {
  return `STATE_ID_${index}`;
}
export function authorState(index = 1): string {
  return `STATE_${index}`;
}
export function authorCity(index = 1): string {
  return `CITY_${index}`;
}
export function authorPhone(index = 1): string {
  return `AUTHOR_PHONE_${index}`;
}
/**
 * Institution is a combobox whose id carries a generated number
 * (`combobox-1014-inputEl`), so only the name attribute is stable.
 * Observed 2026-08-17.
 */
export function authorInstitutionName(index = 1): string {
  return `AUTHOR_INSTITUTION_${index}`;
}

/** ScholarOne's own alert dialog, which can refuse a save. Observed 2026-08-17. */
export const ALERT_BUTTON = 'alertButton';

/**
 * ScholarOne dialog when the institution was typed instead of picked from
 * the Ringgold list. The proceed control is labelled OKAY. Observed 2026-08-17.
 */
export const RINGGOLD_DIALOG_RE = /institution not connected to ringgold/i;
export const RINGGOLD_OKAY_RE = /^okay$/i;

/**
 * Generic ExtJS error that can appear after a Ringgold lookup. Close
 * dismisses it so the create-author form stays usable.
 */
export const GENERIC_ERROR_RE =
  /an error has occurred\.?\s*please try again/i;
export const GENERIC_ERROR_CLOSE_RE = /^close$/i;

/** Inline banner offered when an email search finds no existing co-author. */
export const CREATE_NEW_COAUTHOR_RE = /create\s+a\s+new\s+co-?author/i;

export const UPDATE_AUTHOR_ORDER = 'UpdateAuthorOrderBtn';
export const ADD_REMOVE_AUTHOR = 'addRemoveAuthor';
export const BTN_SAVE = 'btnSave';
export const BTN_SUBMIT = 'btnSubmit';
export const BTN_PREV = 'btnPrev';

/** CRediT role checkbox / degree-of-contribution id prefixes from the capture. */
export const CREDIT_ROLE_PREFIX = 'AUTHOR_CONTRIBUTOR_ROLE_SELECT_';
export const CREDIT_DEGREE_PREFIX = 'AUTHOR_CONTRIBUTOR_DEGREE_OF_CONTRIBUTION_ID_';
