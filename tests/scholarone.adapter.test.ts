import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scholarOneAdapter } from '@/adapters/scholarone/adapter';
import { mountScholarOneFixture } from '@/adapters/scholarone/fixture';
import { defaultRegistry } from '@/adapters/registry';
import { isForbiddenControl } from '@/adapters/safety';
import { makeAuthor, makeNAuthors, makeRoster } from './helpers/roster';

describe('ScholarOne adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects the documented Authors & Institutions chrome', () => {
    mountScholarOneFixture({ slots: 1 });
    const detected = defaultRegistry.detect(document);
    expect(detected.platformId).toBe('scholarone');
    expect(detected.confidence).toBeGreaterThanOrEqual(0.5);
    expect(detected.evidence).toContain('ScholarOne');
    expect(detected.evidence).toContain('Authors & Institutions');
  });

  it('does not claim ScholarOne from a mention alone', () => {
    document.body.innerHTML = '<p>Some journals use ScholarOne.</p>';
    expect(scholarOneAdapter.detect(document).platformId).toBe('unknown');
  });

  it('fills author labels and a later Details & Comments COI textarea', () => {
    mountScholarOneFixture({ slots: 1 });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        email: 'ada@example.org',
        sequence: 1,
        isCorresponding: true,
        conflictOfInterest: 'Advisor to Analytical Engines Ltd',
        affiliations: [
          {
            institution: 'Analytical Engines Institute',
            city: 'London',
            country: 'United Kingdom',
            isPrimary: true,
          },
        ],
      }),
    ]);
    const report = scholarOneAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(report.errors).toHaveLength(0);
    expect(
      (document.getElementById('s1_author_1_first_name') as HTMLInputElement)
        .value,
    ).toBe('Ada');
    expect(
      (document.getElementById('s1_author_1_corresponding') as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (document.getElementById('s1_conflict_of_interest') as HTMLTextAreaElement)
        .value,
    ).toBe('Advisor to Analytical Engines Ltd');
    expect(
      (document.getElementById('s1_coi_attest') as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('fills a COI-only Details & Comments step from project disclosures', () => {
    mountScholarOneFixture({ slots: 0, detailsOnly: true });
    const detected = scholarOneAdapter.detect(document);
    expect(detected.platformId).toBe('scholarone');
    const roster = makeRoster(makeNAuthors(1));
    roster.projectMetadata = {
      fundingStatements: [],
      disclosureStatements: ['The authors declare no competing interests.'],
    };
    scholarOneAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(
      (document.getElementById('s1_conflict_of_interest') as HTMLTextAreaElement)
        .value,
    ).toBe('The authors declare no competing interests.');
    expect(
      (document.getElementById('s1_coi_attest') as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('never clicks Search, Save and Continue, Submit, or COI attestation', () => {
    mountScholarOneFixture({ slots: 1, includeOverlay: true });
    const spy = vi.spyOn(HTMLElement.prototype, 'click');
    scholarOneAdapter.fill(document, makeRoster(makeNAuthors(1)), {
      overwrite: true,
      dryRun: false,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(
      isForbiddenControl(document.getElementById('s1-save-continue')!),
    ).toBe(true);
    expect(isForbiddenControl(document.getElementById('s1-submit')!)).toBe(true);
    expect(isForbiddenControl(document.getElementById('s1_coi_attest')!)).toBe(
      true,
    );
  });

  it('opens Create New Author and saves without using email Search', async () => {
    mountScholarOneFixture({ slots: 0, includeOverlay: true });
    const search = document.getElementById('s1-search') as HTMLButtonElement;
    const searchSpy = vi.spyOn(search, 'click');
    const roster = makeRoster(makeNAuthors(2));
    const report = await scholarOneAdapter.fillAsync!(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(searchSpy).not.toHaveBeenCalled();
    expect(report.errors).toHaveLength(0);
    expect(
      (document.getElementById('s1_author_1_first_name') as HTMLInputElement)
        .value,
    ).toBe('Given1');
    expect(
      (document.getElementById('s1_author_2_last_name') as HTMLInputElement)
        .value,
    ).toBe('Family2');
  });
});
