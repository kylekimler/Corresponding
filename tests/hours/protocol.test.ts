import { describe, expect, it } from 'vitest';
import {
  applyPing,
  hoursFromAuthors,
  parseHoursPing,
  statsFromAuthors,
} from '@/hours/protocol';

describe('hours ping protocol', () => {
  it('accepts a versioned author increment and nothing else', () => {
    expect(parseHoursPing({ v: 1, authors: 12 })).toEqual({
      ok: true,
      authors: 12,
    });
    expect(parseHoursPing({ v: 1, authors: 12, email: 'ada@example.org' }).ok).toBe(
      false,
    );
    expect(parseHoursPing({ v: 1, authors: 12, givenName: 'Ada' }).ok).toBe(false);
    expect(parseHoursPing({ v: 1, authors: 12, url: 'https://plos.org' }).ok).toBe(
      false,
    );
    expect(parseHoursPing({ v: 1, authors: 12, extra: 1 }).ok).toBe(false);
    expect(parseHoursPing({ v: 1, authors: 0 }).ok).toBe(false);
    expect(parseHoursPing({ v: 1, authors: 12.5 }).ok).toBe(false);
    expect(parseHoursPing({ authors: 12 }).ok).toBe(false);
  });

  it('adds authors and converts 40 seconds each into hours', () => {
    expect(applyPing(10, 5)).toBe(15);
    expect(hoursFromAuthors(90)).toBe(1);
    expect(statsFromAuthors(73)).toEqual({
      authorsFilled: 73,
      hoursSaved: 0.8,
      secondsPerAuthor: 40,
    });
  });
});
