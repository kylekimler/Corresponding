import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FREE_ACCESS, getAccess } from '@/entitlements/types';

function readRepo(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const PAYWALL_PHRASES = [
  'start trial',
  'start your trial',
  'freemium',
  'upgrade to pro',
  'pro plan',
  'team plan',
  'all rights reserved',
  'proprietary',
];

describe('radically free product', () => {
  it('leads the README with the hated-form hook', () => {
    const readme = readRepo('README.md');
    expect(readme).toMatch(
      /Stop entering every author into journal submission forms by hand/,
    );
    expect(readme).toMatch(/MIT license\. No account\. No trial\. No freemium gate/);
    expect(readme).toMatch(
      /Install the extension → import a spreadsheet or ORCIDs → fill the form → submit the paper yourself/,
    );
    expect(readme).not.toMatch(/Proprietary/);
    expect(readme).not.toMatch(/all rights reserved/i);
  });

  it('ships an MIT license and package metadata', () => {
    const license = readRepo('LICENSE');
    expect(license).toMatch(/^MIT License/);
    expect(license).toMatch(/Permission is hereby granted, free of charge/);
    const pkg = JSON.parse(readRepo('package.json')) as { license?: string };
    expect(pkg.license).toBe('MIT');
  });

  it('does not grow a paywall in access, popup, or store copy', () => {
    const access = getAccess();
    expect(access).toEqual(FREE_ACCESS);
    expect(access.accountRequired).toBe(false);
    expect(access.trialRequired).toBe(false);
    expect(access.paidPlanRequired).toBe(false);
    expect(access.authorLimit).toBeNull();
    expect(access.canFill).toBe(true);

    const surfaces = [
      readRepo('src/entitlements/types.ts'),
      readRepo('src/entrypoints/popup/App.tsx'),
      readRepo('wxt.config.ts'),
    ]
      .join('\n')
      .toLowerCase();

    for (const phrase of PAYWALL_PHRASES) {
      expect(surfaces).not.toContain(phrase);
    }

    // The popup must still state plainly that the product costs nothing.
    expect(readRepo('src/entrypoints/popup/App.tsx')).toContain(
      'Free for scientists forever!',
    );
  });
});
