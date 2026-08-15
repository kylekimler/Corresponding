import { describe, expect, it } from 'vitest';
import {
  detectHostFamily,
  isFillablePlatform,
} from '@/adapters/hosts';

describe('host family detection', () => {
  it('maps PLOS Editorial Manager hosts, not ScholarOne', () => {
    const pone = detectHostFamily(
      'https://www.editorialmanager.com/pone/default2.aspx',
    );
    const pgenetics = detectHostFamily(
      'https://www.editorialmanager.com/pgenetics/default2.aspx',
    );
    expect(pone?.platformId).toBe('editorial-manager');
    expect(pgenetics?.platformId).toBe('editorial-manager');
    expect(pone?.evidence[0]).toBe('host:www.editorialmanager.com');
  });

  it('maps ScholarOne only on manuscriptcentral hosts', () => {
    const s1 = detectHostFamily(
      'https://mc.manuscriptcentral.com/bmj',
    );
    expect(s1?.platformId).toBe('scholarone');
    expect(detectHostFamily('https://www.editorialmanager.com/pone/')).not.toEqual(
      expect.objectContaining({ platformId: 'scholarone' }),
    );
  });

  it('ignores unrelated hosts and bad URLs', () => {
    expect(detectHostFamily('https://submit.biorxiv.org/')).toBeNull();
    expect(detectHostFamily('not a url')).toBeNull();
    expect(detectHostFamily(undefined)).toBeNull();
  });

  it('treats Nature, bioRxiv, Editorial Manager, and ScholarOne as fillable', () => {
    expect(isFillablePlatform('nature-mts')).toBe(true);
    expect(isFillablePlatform('biorxiv')).toBe(true);
    expect(isFillablePlatform('editorial-manager')).toBe(true);
    expect(isFillablePlatform('scholarone')).toBe(true);
    expect(isFillablePlatform('unknown')).toBe(false);
  });
});
