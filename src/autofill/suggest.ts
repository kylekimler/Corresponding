import {
  primaryAffiliation,
  sortAuthors,
  type Author,
  type Roster,
} from '@/schema/author';
import type { RecognizedAuthorField } from './fields';

export function rosterForOneAuthor(roster: Roster, author: Author): Roster {
  return {
    ...roster,
    authors: [{ ...author }],
  };
}

export function suggestAuthor(
  roster: Roster,
  field?: RecognizedAuthorField | null,
): Author | undefined {
  const authors = sortAuthors(roster.authors);
  if (authors.length === 0) return undefined;
  if (field?.corresponding) {
    return authors.find((author) => author.isCorresponding) ?? authors[0];
  }
  if (field?.sequence) {
    return authors.find((author) => author.sequence === field.sequence);
  }
  return authors[0];
}

export function previewEmail(email: string | undefined): string {
  if (!email) return '';
  const at = email.indexOf('@');
  if (at <= 0) return email;
  return `${email.slice(0, at)}@...`;
}

export function authorPreview(author: Author): {
  name: string;
  institution: string;
  email: string;
} {
  return {
    name: [author.givenName, author.familyName].filter(Boolean).join(' '),
    institution: primaryAffiliation(author)?.institution ?? '',
    email: previewEmail(author.email),
  };
}

export function fillAllLabel(count: number): string {
  const noun = count === 1 ? 'author' : 'authors';
  return `Corresponding can fill ${count} ${noun}`;
}
