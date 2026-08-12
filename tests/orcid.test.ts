import { describe, expect, it } from 'vitest';
import { normalizeOrcid } from '@/schema/orcid';

describe('normalizeOrcid', () => {
  it('formats digit strings and URLs', () => {
    expect(normalizeOrcid('0000000123456789')).toBe('0000-0001-2345-6789');
    expect(normalizeOrcid('https://orcid.org/0000-0001-2345-6789')).toBe(
      '0000-0001-2345-6789',
    );
  });

  it('preserves checksum X', () => {
    expect(normalizeOrcid('000000021825009X')).toBe('0000-0002-1825-009X');
  });

  it('returns undefined for empty and original for garbage', () => {
    expect(normalizeOrcid('')).toBeUndefined();
    expect(normalizeOrcid('not-an-orcid')).toBe('not-an-orcid');
  });
});
