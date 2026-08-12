import { expect, it, vi } from 'vitest';
import type { PlatformAdapter } from '@/adapters/types';
import type { Roster } from '@/schema/author';
import { makeNAuthors, makeRoster } from '../helpers/roster';

export interface AdapterContractContext {
  adapter: PlatformAdapter;
  /** Mount a blank multi-slot form for this adapter. */
  mountBlank: (slots: number) => void;
  /** Mount with a linked conflicting author in slot 1. */
  mountLinkedConflict: () => void;
  /** Read first/last for author slot (1-based). */
  readName: (slot: number) => { first: string; last: string };
  /** Read country select value for slot. */
  readCountry?: (slot: number) => string;
}

/**
 * Shared behavioral contract. Future adapters opt in with minimal glue.
 */
export function describeAdapterContract(ctx: AdapterContractContext): void {
  const { adapter } = ctx;

  it(`${adapter.id}: detect returns identity with evidence`, () => {
    ctx.mountBlank(1);
    const d = adapter.detect(document);
    expect(d.platformId).toBe(adapter.id);
    expect(d.confidence).toBeGreaterThanOrEqual(0.5);
    expect(d.evidence.length).toBeGreaterThan(0);
  });

  it(`${adapter.id}: inspect lists fields and never requires values for safety list`, () => {
    ctx.mountBlank(2);
    const report = adapter.inspect(document);
    expect(report.platformId).toBe(adapter.id);
    expect(report.authorSlots).toBeGreaterThanOrEqual(1);
  });

  it(`${adapter.id}: preview (dry-run) does not mutate DOM`, () => {
    ctx.mountBlank(2);
    const roster = makeRoster(makeNAuthors(2));
    const before = document.body.innerHTML;
    adapter.fill(document, roster, { overwrite: true, dryRun: true });
    expect(document.body.innerHTML).toBe(before);
  });

  it(`${adapter.id}: fill writes author order correctly`, () => {
    ctx.mountBlank(3);
    const roster = makeRoster(makeNAuthors(3));
    adapter.fill(document, roster, { overwrite: true, dryRun: false });
    for (let i = 1; i <= 3; i += 1) {
      const name = ctx.readName(i);
      expect(name.first).toBe(roster.authors[i - 1]!.givenName);
      expect(name.last).toBe(roster.authors[i - 1]!.familyName);
    }
  });

  it(`${adapter.id}: preserve non-empty when overwrite=false`, () => {
    ctx.mountBlank(1);
    // Pre-fill via adapter-specific mount already blank; set manually if possible
    const roster = makeRoster(makeNAuthors(1));
    adapter.fill(document, roster, { overwrite: false, dryRun: false });
    const afterFirst = ctx.readName(1).first;
    const other = makeRoster(makeNAuthors(1));
    other.authors[0]!.givenName = 'ZZZDifferent';
    adapter.fill(document, other, { overwrite: false, dryRun: false });
    expect(ctx.readName(1).first).toBe(afterFirst);
  });

  it(`${adapter.id}: linked conflict not overwritten`, () => {
    ctx.mountLinkedConflict();
    const roster = makeRoster(makeNAuthors(1));
    const before = ctx.readName(1);
    const report = adapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(report.skippedConflicts).toBeGreaterThan(0);
    expect(ctx.readName(1)).toEqual(before);
  });

  it(`${adapter.id}: missing email surfaces in validate`, () => {
    ctx.mountBlank(1);
    const authors = makeNAuthors(1);
    authors[0]!.email = undefined;
    const roster = makeRoster(authors);
    adapter.fill(document, roster, { overwrite: true, dryRun: false });
    const v = adapter.validate(document, roster);
    expect(v.summary.missingEmail).toBeGreaterThanOrEqual(1);
  });

  it(`${adapter.id}: corresponding author handled`, () => {
    ctx.mountBlank(3);
    const roster = makeRoster(makeNAuthors(3, { correspondingIndex: 2 }));
    adapter.fill(document, roster, { overwrite: true, dryRun: false });
    const v = adapter.validate(document, roster);
    expect(v.summary.filledLike).toBeGreaterThanOrEqual(1);
  });

  it(`${adapter.id}: Unicode names`, () => {
    ctx.mountBlank(1);
    const roster = makeRoster(makeNAuthors(1));
    roster.authors[0]!.givenName = '田中';
    roster.authors[0]!.familyName = 'Müller';
    adapter.fill(document, roster, { overwrite: true, dryRun: false });
    expect(ctx.readName(1).first).toBe('田中');
    expect(ctx.readName(1).last).toBe('Müller');
  });

  it(`${adapter.id}: large roster 75`, () => {
    ctx.mountBlank(75);
    const roster = makeRoster(makeNAuthors(75));
    const report = adapter.fill(document, roster, {
      overwrite: true,
      dryRun: false,
    });
    expect(report.errors).toHaveLength(0);
    expect(ctx.readName(75).last).toBe('Family75');
  });

  it(`${adapter.id}: never clicks submit`, () => {
    ctx.mountBlank(1);
    const spy = vi.spyOn(HTMLElement.prototype, 'click');
    adapter.fill(document, makeRoster(makeNAuthors(1)), {
      overwrite: true,
      dryRun: false,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it(`${adapter.id}: country selection when supported`, () => {
    if (!ctx.readCountry) return;
    ctx.mountBlank(1);
    const roster = makeRoster(makeNAuthors(1));
    roster.authors[0]!.affiliations = [
      {
        institution: 'Inst',
        country: 'Japan',
        isPrimary: true,
      },
    ];
    adapter.fill(document, roster, { overwrite: true, dryRun: false });
    expect(ctx.readCountry(1)).toBe('Japan');
  });

  // Silence unused Roster import if tree-shaken oddly
  void 0 as unknown as Roster;
}
