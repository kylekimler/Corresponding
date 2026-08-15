/**
 * Public host-family detection. Does not invent form selectors.
 * PLOS journals use Editorial Manager (editorialmanager.com).
 * ScholarOne uses manuscriptcentral.com — a different vendor.
 */

import type { DetectResult, PlatformId } from './types';

export const HOST_FAMILY_CONFIDENCE = 0.72;

const HOST_FAMILIES: Array<{
  platformId: Exclude<PlatformId, 'unknown'>;
  label: string;
  roots: string[];
}> = [
  {
    platformId: 'editorial-manager',
    label: 'Editorial Manager',
    roots: ['editorialmanager.com'],
  },
  {
    platformId: 'scholarone',
    label: 'ScholarOne',
    roots: ['manuscriptcentral.com', 'scholarone.com'],
  },
];

function hostnameMatches(hostname: string, root: string): boolean {
  const host = hostname.toLowerCase();
  const needle = root.toLowerCase();
  return host === needle || host.endsWith(`.${needle}`);
}

/** Implemented adapters that may Fill. Stubs are recognized but not fillable. */
export function isFillablePlatform(id: PlatformId): boolean {
  return id === 'nature-mts' || id === 'biorxiv' || id === 'editorial-manager';
}

export function detectHostFamily(url: string | undefined): DetectResult | null {
  if (!url) return null;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  for (const family of HOST_FAMILIES) {
    const root = family.roots.find((candidate) =>
      hostnameMatches(hostname, candidate),
    );
    if (!root) continue;
    return {
      platformId: family.platformId,
      confidence: HOST_FAMILY_CONFIDENCE,
      label: `${family.label} (unsupported — needs author-form fixture)`,
      evidence: [`host:${hostname}`],
    };
  }
  return null;
}
