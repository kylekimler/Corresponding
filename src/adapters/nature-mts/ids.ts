/** Nature MTS / eJournalPress observed field ID helpers. */

export function contribPrefix(index: number): string {
  return `contrib_auth_${index}`;
}

export function contribField(index: number, suffix: string): string {
  return `${contribPrefix(index)}_${suffix}`;
}

export function linkedPidField(index: number): string {
  return `current_contrib_auth_${index}_author_pid`;
}

export const CORR_FIELDS = {
  first: 'corr_auth_first_nm',
  middle: 'corr_auth_middle_nm',
  last: 'corr_auth_last_nm',
  email: 'corr_auth_email',
  sequence: 'corr_auth_author_seq',
} as const;

export const NUM_AUTHORS = 'num_authors';

export const CONTRIB_SUFFIXES = [
  'first_nm',
  'middle_nm',
  'last_nm',
  'email',
  'org',
  'city',
  'country',
  'author_seq',
] as const;

export type ContribSuffix = (typeof CONTRIB_SUFFIXES)[number];
