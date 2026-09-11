import { isFillablePlatform } from '@/adapters/hosts';
import { defaultRegistry } from '@/adapters/registry';
import type { DetectResult } from '@/adapters/types';
import { mayFill } from '@/recognition/confidence';

export function pageSupportsContextualAutofill(
  detect: DetectResult,
): boolean {
  return isFillablePlatform(detect.platformId) && mayFill(detect.confidence);
}

export function detectContextualPage(
  doc: Document,
  pageUrl?: string,
): DetectResult {
  return defaultRegistry.detect(doc, pageUrl);
}

export function shouldShowPageChip(
  detect: DetectResult,
  authorCount: number,
  isTopFrame: boolean,
): boolean {
  return (
    isTopFrame &&
    authorCount > 0 &&
    pageSupportsContextualAutofill(detect)
  );
}
