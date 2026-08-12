import { beforeEach, describe, expect, it, vi } from 'vitest';
import { natureMtsAdapter } from '@/adapters/nature-mts/adapter';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { makeAuthor, makeNAuthors, makeRoster } from './helpers/roster';

describe('natureMtsAdapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects Nature MTS fixture', () => {
    mountNatureMtsFixture({ slots: 1 });
    const d = natureMtsAdapter.detect(document);
    expect(d.platformId).toBe('nature-mts');
    expect(d.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('fills a single author roster', () => {
    mountNatureMtsFixture({ slots: 1 });
    const roster = makeRoster(makeNAuthors(1));
    const report = natureMtsAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: false,
    });
    expect(report.filled).toBeGreaterThan(0);
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
    ).toBe('Given1');
    expect(
      (document.getElementById('num_authors') as HTMLInputElement).value,
    ).toBe('1');
  });

  it.each([0, 4, 9])(
    'places corresponding author at roster index %i (begin/middle/end of 10)',
    (corrIndex) => {
      mountNatureMtsFixture({ slots: 10 });
      const roster = makeRoster(makeNAuthors(10, { correspondingIndex: corrIndex }));
      natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: false });
      const corr = roster.authors[corrIndex]!;
      expect(
        (document.getElementById('corr_auth_first_nm') as HTMLInputElement).value,
      ).toBe(corr.givenName);
      expect(
        (document.getElementById('corr_auth_author_seq') as HTMLInputElement).value,
      ).toBe(String(corr.sequence));
    },
  );

  it.each([1, 10, 75, 200])('handles %i-author roster against matching slots', (n) => {
    mountNatureMtsFixture({ slots: n });
    const roster = makeRoster(makeNAuthors(n));
    const report = natureMtsAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: false,
    });
    expect(report.errors).toHaveLength(0);
    expect(
      (document.getElementById('num_authors') as HTMLInputElement).value,
    ).toBe(String(n));
    expect(
      (document.getElementById(`contrib_auth_${n}_last_nm`) as HTMLInputElement)
        .value,
    ).toBe(`Family${n}`);
  });

  it('reports missing emails without inventing them', () => {
    mountNatureMtsFixture({ slots: 2 });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Ada',
        familyName: 'Lovelace',
        sequence: 1,
        isCorresponding: true,
        affiliations: [{ institution: 'Analytical Engine', isPrimary: true }],
      }),
      makeAuthor({
        givenName: 'Alan',
        familyName: 'Turing',
        email: 'alan@example.org',
        sequence: 2,
      }),
    ]);
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: false });
    const v = natureMtsAdapter.validate(document, roster);
    expect(v.summary.missingEmail).toBe(1);
    expect(
      (document.getElementById('contrib_auth_1_email') as HTMLInputElement).value,
    ).toBe('');
  });

  it('selects country options', () => {
    mountNatureMtsFixture({ slots: 1 });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Yuri',
        familyName: 'Gagarin',
        email: 'yuri@example.org',
        sequence: 1,
        isCorresponding: true,
        affiliations: [
          { institution: 'OKB', city: 'Moscow', country: 'United States', isPrimary: true },
        ],
      }),
    ]);
    // Use a country present in the fixture list
    roster.authors[0]!.affiliations[0]!.country = 'Japan';
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: false });
    expect(
      (document.getElementById('contrib_auth_1_country') as HTMLSelectElement).value,
    ).toBe('Japan');
  });

  it('preserves non-empty fields when overwrite=false', () => {
    mountNatureMtsFixture({
      slots: 1,
      authors: [{ first: 'Existing', last: 'Person', email: 'old@example.org' }],
    });
    const roster = makeRoster(makeNAuthors(1));
    const report = natureMtsAdapter.fill(document, roster, {
      overwrite: false,
      dryRun: false,
    });
    expect(report.preserved).toBeGreaterThan(0);
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
    ).toBe('Existing');
  });

  it('overwrites non-empty fields when overwrite=true', () => {
    mountNatureMtsFixture({
      slots: 1,
      authors: [{ first: 'Existing', last: 'Person' }],
    });
    const roster = makeRoster(makeNAuthors(1));
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: false });
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
    ).toBe('Given1');
  });

  it('skips linked author slots with identity conflicts', () => {
    mountNatureMtsFixture({
      slots: 1,
      authors: [
        {
          first: 'Portal',
          last: 'Linked',
          email: 'portal@example.org',
          linkedPid: 'PID-999',
        },
      ],
    });
    const roster = makeRoster(makeNAuthors(1));
    const report = natureMtsAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(report.skippedConflicts).toBeGreaterThan(0);
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
    ).toBe('Portal');
    const v = natureMtsAdapter.validate(document, roster);
    expect(v.summary.conflicts).toBe(1);
    expect(v.ok).toBe(false);
  });

  it('supports Unicode names', () => {
    mountNatureMtsFixture({ slots: 1 });
    const roster = makeRoster([
      makeAuthor({
        givenName: '田中',
        middleName: 'José',
        familyName: 'Müller',
        email: 'unicode@example.org',
        sequence: 1,
        isCorresponding: true,
        affiliations: [
          { institution: '東京大学', city: '東京', country: 'Japan', isPrimary: true },
        ],
      }),
    ]);
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: false });
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
    ).toBe('田中');
    expect(
      (document.getElementById('contrib_auth_1_last_nm') as HTMLInputElement).value,
    ).toBe('Müller');
  });

  it('uses explicitly selected primary affiliation among multiple', () => {
    mountNatureMtsFixture({ slots: 1 });
    const roster = makeRoster([
      makeAuthor({
        givenName: 'Marie',
        familyName: 'Curie',
        email: 'marie@example.org',
        sequence: 1,
        isCorresponding: true,
        affiliations: [
          {
            institution: 'Secondary Lab',
            city: 'Other',
            country: 'France',
            isPrimary: false,
          },
          {
            institution: 'Primary Lab',
            city: 'Paris',
            country: 'France',
            isPrimary: true,
          },
        ],
      }),
    ]);
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: false });
    expect(
      (document.getElementById('contrib_auth_1_org') as HTMLInputElement).value,
    ).toBe('Primary Lab');
    expect(
      (document.getElementById('contrib_auth_1_city') as HTMLInputElement).value,
    ).toBe('Paris');
  });

  it('warns on mismatched num_authors', () => {
    mountNatureMtsFixture({ slots: 3, numAuthors: 99 });
    const roster = makeRoster(makeNAuthors(2));
    const fill = natureMtsAdapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(fill.warnings.some((w) => /slots/i.test(w))).toBe(true);
    // After fill, num_authors should match roster unless preserved
    expect(
      (document.getElementById('num_authors') as HTMLInputElement).value,
    ).toBe('2');
  });

  it('dry-run does not mutate the DOM', () => {
    mountNatureMtsFixture({ slots: 1 });
    const roster = makeRoster(makeNAuthors(1));
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: true });
    expect(
      (document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement).value,
    ).toBe('');
  });

  it('never clicks submit/certify controls', () => {
    mountNatureMtsFixture({ slots: 1, includeSubmitControls: true });
    const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');
    const roster = makeRoster(makeNAuthors(1));
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: false });
    expect(clickSpy).not.toHaveBeenCalled();
    expect(
      (document.getElementById('certify_accuracy') as HTMLInputElement).checked,
    ).toBe(false);
    clickSpy.mockRestore();
  });

  it('inspect lists linked PIDs and dangerous controls', () => {
    mountNatureMtsFixture({
      slots: 2,
      authors: [{ linkedPid: 'A1' }, { linkedPid: '' }],
    });
    const report = natureMtsAdapter.inspect(document);
    expect(report.linkedAuthorPids).toEqual([{ sequence: 1, pid: 'A1' }]);
    expect(report.dangerousControls.length).toBeGreaterThan(0);
  });
});
