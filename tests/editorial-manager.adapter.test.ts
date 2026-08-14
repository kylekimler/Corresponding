import { beforeEach, describe, expect, it, vi } from 'vitest';
import { editorialManagerAdapter } from '@/adapters/editorial-manager/adapter';
import { mountEditorialManagerFixture } from '@/adapters/editorial-manager/fixture';
import { defaultRegistry } from '@/adapters/registry';
import { isForbiddenControl } from '@/adapters/safety';
import { makeAuthor, makeNAuthors, makeRoster } from './helpers/roster';

describe('Editorial Manager adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects the documented Manuscript Data chrome', () => {
    mountEditorialManagerFixture({ slots: 1 });
    const detected = defaultRegistry.detect(document);
    expect(detected.platformId).toBe('editorial-manager');
    expect(detected.confidence).toBeGreaterThanOrEqual(0.5);
    expect(detected.evidence).toContain('Editorial Manager');
  });

  it('does not claim Editorial Manager from a mention alone', () => {
    document.body.innerHTML = '<p>This journal uses Editorial Manager.</p>';
    expect(editorialManagerAdapter.detect(document).platformId).toBe('unknown');
  });

  it('fills Given/First Name, Family/Last Name, equal contribution, and COI text', () => {
    mountEditorialManagerFixture({ slots: 1 });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        email: 'ada@example.org',
        sequence: 1,
        isCorresponding: true,
        equalContribution: true,
        conflictOfInterest: 'No competing interests',
        affiliations: [
          {
            institution: 'Analytical Engines Institute',
            department: 'Mathematics',
            city: 'London',
            country: 'United Kingdom',
            isPrimary: true,
          },
        ],
      }),
    ]);
    editorialManagerAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(
      (
        document.getElementById(
          'em_author_1_given_first_name',
        ) as HTMLInputElement
      ).value,
    ).toBe('Ada');
    expect(
      (
        document.getElementById(
          'em_author_1_family_last_name',
        ) as HTMLInputElement
      ).value,
    ).toBe('Lovelace');
    expect(
      (document.getElementById('em_author_1_equal') as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (document.getElementById('em_competing_interests') as HTMLTextAreaElement)
        .value,
    ).toBe('No competing interests');
    expect(
      (document.getElementById('em_coi_attest') as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('fills Additional Information COI without author slots present', () => {
    mountEditorialManagerFixture({ slots: 0, additionalInfoOnly: true });
    expect(editorialManagerAdapter.detect(document).platformId).toBe(
      'editorial-manager',
    );
    const roster = makeRoster(makeNAuthors(2));
    roster.authors[0]!.conflictOfInterest = 'Consulting for Lab A';
    roster.authors[1]!.conflictOfInterest = 'Consulting for Lab A';
    editorialManagerAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(
      (document.getElementById('em_competing_interests') as HTMLTextAreaElement)
        .value,
    ).toBe('Consulting for Lab A');
  });

  it('never clicks Proceed, Build PDF, Approve, or COI attestation', () => {
    mountEditorialManagerFixture({ slots: 1 });
    const spy = vi.spyOn(HTMLElement.prototype, 'click');
    editorialManagerAdapter.fill(document, makeRoster(makeNAuthors(1)), {
      overwrite: true,
      dryRun: false,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(isForbiddenControl(document.getElementById('em-proceed')!)).toBe(
      true,
    );
    expect(isForbiddenControl(document.getElementById('em-build-pdf')!)).toBe(
      true,
    );
    expect(isForbiddenControl(document.getElementById('em-approve')!)).toBe(
      true,
    );
    expect(isForbiddenControl(document.getElementById('em_coi_attest')!)).toBe(
      true,
    );
  });

  it('opens Enter Author Details and saves a new author', async () => {
    mountEditorialManagerFixture({ slots: 0, includeOverlay: true });
    const report = await editorialManagerAdapter.fillAsync!(
      document,
      makeRoster(makeNAuthors(1)),
      { overwrite: true, dryRun: false },
    );
    expect(report.errors).toHaveLength(0);
    expect(
      (
        document.getElementById(
          'em_author_1_given_first_name',
        ) as HTMLInputElement
      ).value,
    ).toBe('Given1');
    expect(document.getElementById('em-author-overlay')?.hidden).toBe(true);
  });
});
