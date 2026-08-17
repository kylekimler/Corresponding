import { describe, expect, it } from 'vitest';
import {
  describeRequirementIssue,
  evaluatePortalRequirements,
} from '@/adapters/requirements';
import { createSampleRoster } from '@/roster/sample';
import { parseCreditRoles, CREDIT_ROLES } from '@/schema/credit';
import { makeAuthor, makeRoster } from '../helpers/roster';

function emReadyAuthor(sequence: number) {
  return makeAuthor({
    givenName: `Given${sequence}`,
    familyName: `Family${sequence}`,
    email: `author${sequence}@example.org`,
    sequence,
    creditRoles: ['conceptualization'],
    affiliations: [
      {
        institution: 'Example Institute',
        department: 'Example Department',
        city: 'Boston',
        postalCode: '02115',
        country: 'United States',
        isPrimary: true,
      },
    ],
  });
}

describe('CRediT contributor roles', () => {
  it('covers the fourteen taxonomy roles', () => {
    expect(CREDIT_ROLES).toHaveLength(14);
  });

  it('parses real spreadsheet spellings including en dashes', () => {
    expect(
      parseCreditRoles('Conceptualization; Writing – review & editing'),
    ).toEqual(['conceptualization', 'writing_review_editing']);
    expect(parseCreditRoles('Writing - original draft, Methodology')).toEqual([
      'writing_original_draft',
      'methodology',
    ]);
    // Duplicates collapse and unknown text is dropped rather than guessed.
    expect(parseCreditRoles('Software, software, Sorcery')).toEqual(['software']);
    expect(parseCreditRoles('')).toEqual([]);
  });
});

describe('portal requirements', () => {
  it('reports nothing when Editorial Manager has everything it needs', () => {
    const roster = makeRoster([emReadyAuthor(1), emReadyAuthor(2)]);
    expect(evaluatePortalRequirements('editorial-manager', roster)).toEqual([]);
  });

  it('flags missing contributor roles as blocking for Editorial Manager', () => {
    const author = emReadyAuthor(1);
    author.creditRoles = [];
    const roster = makeRoster([author, emReadyAuthor(2)]);

    const issues = evaluatePortalRequirements('editorial-manager', roster);
    const credit = issues.find((issue) => issue.code === 'credit_roles_required');

    expect(credit).toEqual(
      expect.objectContaining({
        field: 'Contributor Roles',
        authorSequences: [1],
        blocksFill: true,
      }),
    );
    expect(describeRequirementIssue(credit!, 2)).toBe(
      'Contributor Roles is missing for author 1. Editorial Manager will not save an author without at least one CRediT role.',
    );
  });

  it('names every required Editorial Manager field a bare roster lacks', () => {
    const roster = makeRoster([
      makeAuthor({ givenName: 'Ada', familyName: 'Lovelace', sequence: 1 }),
    ]);

    const codes = evaluatePortalRequirements('editorial-manager', roster).map(
      (issue) => issue.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        'credit_roles_required',
        'department_required',
        'postal_code_required',
        'country_required',
        'email_required',
        'institution_required',
      ]),
    );
  });

  it('summarizes whole-roster gaps without listing every author', () => {
    const authors = [1, 2, 3, 4, 5].map((sequence) => {
      const author = emReadyAuthor(sequence);
      author.creditRoles = [];
      return author;
    });
    const issue = evaluatePortalRequirements(
      'editorial-manager',
      makeRoster(authors),
    )[0]!;

    expect(describeRequirementIssue(issue, 5)).toMatch(
      /missing for all 5 authors/,
    );
  });

  it('ships an example roster that satisfies Editorial Manager', () => {
    // The example set is how someone first tries a portal, so it must not trip
    // the very requirement we warn about.
    const issues = evaluatePortalRequirements(
      'editorial-manager',
      createSampleRoster(),
    );
    expect(issues).toEqual([]);
  });

  it('does not invent requirements for portals without captured rules', () => {
    const roster = makeRoster([
      makeAuthor({ givenName: 'Ada', familyName: 'Lovelace', sequence: 1 }),
    ]);
    expect(evaluatePortalRequirements('nature-mts', roster)).toEqual([]);
    expect(evaluatePortalRequirements('unknown', roster)).toEqual([]);
  });
});
