import fc from 'fast-check';
import {
  ROSTER_SCHEMA_VERSION,
  type Affiliation,
  type Author,
  type Roster,
} from '@/schema/author';

const unicodeName = fc
  .string({ minLength: 1, maxLength: 40 })
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const fancyName = fc.oneof(
  unicodeName,
  fc.constantFrom(
    "O'Brien",
    'José',
    'Müller',
    '田中',
    'Anne-Marie',
    'van der Berg',
    '李',
    'Александр',
    'J.',
    'Mary Jane',
  ),
);

const emailArb = fc.option(
  fc.tuple(fc.stringMatching(/^[a-z]{1,12}$/), fc.stringMatching(/^[a-z]{2,10}$/)).map(
    ([a, b]) => `${a}@${b}.example`,
  ),
  { nil: undefined },
);

const affiliationArb: fc.Arbitrary<Affiliation> = fc.record({
  institution: fc.oneof(
    fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
    fc.constant('A'.repeat(300)),
    fc.constant('International Consortium for Extremely Long Institutional Names and Collaborative Research Networks'),
  ),
  department: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
  city: fc.option(fancyName, { nil: undefined }),
  state: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  country: fc.option(
    fc.constantFrom('United States', 'Germany', 'Japan', 'France', 'United Kingdom'),
    { nil: undefined },
  ),
  isPrimary: fc.boolean(),
});

export function authorArb(sequence: number): fc.Arbitrary<Author> {
  return fc.record({
    id: fc.uuid(),
    givenName: fancyName,
    middleName: fc.option(fancyName, { nil: undefined }),
    familyName: fancyName,
    email: emailArb,
    orcid: fc.option(
      fc.constantFrom(
        '0000-0001-2345-6789',
        '0000-0002-1825-009X',
        'https://orcid.org/0000-0001-2345-6789',
      ),
      { nil: undefined },
    ),
    isCorresponding: fc.boolean(),
    affiliations: fc.array(affiliationArb, { minLength: 0, maxLength: 3 }),
    sequence: fc.constant(sequence),
  }).map((a) => {
    if (a.affiliations.length && !a.affiliations.some((x) => x.isPrimary)) {
      a.affiliations[0]!.isPrimary = true;
    }
    return a;
  });
}

export function rosterArb(size: number): fc.Arbitrary<Roster> {
  return fc
    .tuple(
      fc.array(fc.integer({ min: 0, max: Math.max(0, size - 1) }), {
        minLength: size,
        maxLength: size,
      }),
      fc.string({ minLength: 1, maxLength: 40 }),
    )
    .chain(([, name]) =>
      fc.tuple(...Array.from({ length: size }, (_, i) => authorArb(i + 1))).map(
        (authors) => {
          const now = new Date().toISOString();
          // Normalize corresponding: allow 0, 1, or many for pathological cases
          return {
            id: crypto.randomUUID(),
            name: name.trim() || 'Roster',
            authors,
            schemaVersion: ROSTER_SCHEMA_VERSION,
            createdAt: now,
            updatedAt: now,
            source: 'manual' as const,
          };
        },
      ),
    );
}

export const SIZE_CASES = [1, 2, 10, 75, 200, 500, 1000] as const;
