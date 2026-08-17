import { describe, expect, it } from 'vitest';
import {
  creditRoleCheckboxes,
  scholarOneAdapter,
} from '@/adapters/scholarone/adapter';
import { mountScholarOneFixture } from '@/adapters/scholarone/fixture';
import { makeAuthor, makeRoster } from './helpers/roster';

function author(creditRoles: string[]) {
  return makeAuthor({
    givenName: 'Ada',
    familyName: 'Lovelace',
    email: 'ada@example.org',
    sequence: 1,
    creditRoles: creditRoles as never,
    affiliations: [
      {
        institution: 'Analytical Engines Institute',
        department: 'Computing',
        city: 'London',
        country: 'United Kingdom',
        isPrimary: true,
      },
    ],
  });
}

describe('ScholarOne CRediT contributor roles', () => {
  it('maps all fourteen captured checkbox labels to canonical roles', () => {
    mountScholarOneFixture({ formOpen: true });
    const boxes = creditRoleCheckboxes(document);

    expect(boxes).toHaveLength(14);
    // The capture writes "Writing - review & editing" with a hyphen and an
    // ampersand; it must still resolve to the canonical role.
    expect(boxes.map((box) => box.role)).toEqual(
      expect.arrayContaining([
        'conceptualization',
        'writing_original_draft',
        'writing_review_editing',
      ]),
    );
  });

  it('ticks only the roles the author declared', async () => {
    mountScholarOneFixture({ formOpen: true });

    await scholarOneAdapter.fillAsync!(
      document,
      makeRoster([author(['conceptualization', 'software'])]),
      { overwrite: true, dryRun: false },
    );

    const checked = creditRoleCheckboxes(document)
      .filter((box) => box.input.checked)
      .map((box) => box.role);
    expect(checked).toEqual(['conceptualization', 'software']);
  });

  it('leaves a role a person already ticked in place', async () => {
    mountScholarOneFixture({ formOpen: true });
    const supervision = creditRoleCheckboxes(document).find(
      (box) => box.role === 'supervision',
    )!;
    supervision.input.checked = true;

    await scholarOneAdapter.fillAsync!(
      document,
      makeRoster([author(['methodology'])]),
      { overwrite: true, dryRun: false },
    );

    const checked = creditRoleCheckboxes(document)
      .filter((box) => box.input.checked)
      .map((box) => box.role);
    expect(checked).toEqual(expect.arrayContaining(['methodology', 'supervision']));
  });

  it('reports roles as missing source rather than filling nothing silently', () => {
    mountScholarOneFixture({ formOpen: true });

    const report = scholarOneAdapter.fill(
      document,
      makeRoster([author([])]),
      { overwrite: true, dryRun: true },
    );
    const plan = report.plans.find((item) =>
      item.fieldId.endsWith('.creditRoles'),
    );

    expect(plan?.action).toBe('missing_source');
    expect(plan?.reason).toMatch(/manual selection/i);
  });
});
