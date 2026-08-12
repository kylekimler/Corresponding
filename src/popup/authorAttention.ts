import { primaryAffiliation, type Author } from '@/schema/author';

export type AttentionReason =
  | 'Missing name'
  | 'Missing email'
  | 'Missing institution';

export interface AuthorAttention {
  author: Author;
  reasons: AttentionReason[];
}

export function isAuthorReady(author: Author): boolean {
  return Boolean(
    author.givenName?.trim() &&
      author.familyName?.trim() &&
      author.email?.trim() &&
      primaryAffiliation(author)?.institution?.trim(),
  );
}

export function attentionReasons(author: Author): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (!author.givenName?.trim() || !author.familyName?.trim()) {
    reasons.push('Missing name');
  }
  if (!author.email?.trim()) reasons.push('Missing email');
  if (!primaryAffiliation(author)?.institution?.trim()) {
    reasons.push('Missing institution');
  }
  return reasons;
}

/**
 * Authors that need action — ready authors are omitted.
 * ORCID is optional in the canonical v1 schema, so its absence is advisory
 * rather than a submission-readiness blocker.
 */
export function authorsNeedingAttention(authors: Author[]): AuthorAttention[] {
  return [...authors]
    .sort((a, b) => a.sequence - b.sequence)
    .map((author) => ({ author, reasons: attentionReasons(author) }))
    .filter((a) => a.reasons.length > 0)
    .sort((a, b) => a.author.sequence - b.author.sequence);
}

/** Ready = required submission basics are present; ORCID remains optional. */
export function readyAuthorCount(authors: Author[]): number {
  return authors.filter((a) => attentionReasons(a).length === 0).length;
}

export function displayAuthorName(author: Author): string {
  const name = [author.givenName, author.familyName].filter(Boolean).join(' ');
  return name || `Author ${author.sequence}`;
}
