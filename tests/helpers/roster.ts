import {
  ROSTER_SCHEMA_VERSION,
  type Author,
  type Roster,
} from '@/schema/author';

export function makeAuthor(
  partial: Partial<Author> & Pick<Author, 'givenName' | 'familyName' | 'sequence'>,
): Author {
  return {
    id: partial.id ?? crypto.randomUUID(),
    givenName: partial.givenName,
    middleName: partial.middleName,
    familyName: partial.familyName,
    email: partial.email,
    orcid: partial.orcid,
    isCorresponding: partial.isCorresponding ?? false,
    equalContribution: partial.equalContribution ?? false,
    affiliations: partial.affiliations ?? [],
    sequence: partial.sequence,
  };
}

export function makeRoster(
  authors: Author[],
  name = 'Test roster',
): Roster {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    authors,
    schemaVersion: ROSTER_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    source: 'manual',
  };
}

export function makeNAuthors(n: number, options?: { correspondingIndex?: number }): Author[] {
  const corr = options?.correspondingIndex ?? 0;
  return Array.from({ length: n }, (_, i) =>
    makeAuthor({
      givenName: `Given${i + 1}`,
      familyName: `Family${i + 1}`,
      email: `author${i + 1}@example.org`,
      sequence: i + 1,
      isCorresponding: i === corr,
      affiliations: [
        {
          institution: `Inst ${i + 1}`,
          city: `City${i + 1}`,
          country: i % 2 === 0 ? 'United States' : 'Germany',
          isPrimary: true,
        },
      ],
    }),
  );
}
