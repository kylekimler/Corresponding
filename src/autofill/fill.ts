import { isFillablePlatform } from '@/adapters/hosts';
import { defaultRegistry } from '@/adapters/registry';
import type { FillReport } from '@/adapters/types';
import { mayFill } from '@/recognition/confidence';
import type { Author, Roster } from '@/schema/author';
import { rosterForOneAuthor } from './suggest';

export type ContextualFillMode = 'one' | 'all';

export type ContextualFillResult =
  | { ok: true; report: FillReport }
  | { ok: false; reason: string; report?: FillReport };

/** Keep adapter warnings intact; successful writes do not mean submission-ready. */
export function contextualReviewMessages(report: FillReport): string[] {
  return [...new Set([
    ...report.warnings,
    ...(report.requirements ?? []).map((issue) =>
      `${issue.field}: missing for author ${issue.authorSequences.join(', ')}. ${issue.explanation}`),
    ...report.plans.filter((plan) => plan.action === 'unmapped').map((plan) =>
      `${plan.authorSequence ? `Author ${plan.authorSequence}: ` : ''}${plan.reason ?? `${plan.label} was not mapped. Review it in the journal form.`}`),
    ...(report.unmapped > 0 && !report.plans.some((plan) => plan.action === 'unmapped')
      ? ['Some fields were not mapped. Review them in the journal form.'] : []),
  ])];
}

/**
 * Reuses the existing adapter fill path. Never mutates until the page
 * still matches a fillable adapter with fill-threshold confidence.
 */
export async function runContextualFill(
  doc: Document,
  roster: Roster,
  options: {
    mode: ContextualFillMode;
    author?: Author;
    pageUrl?: string;
    overwrite?: boolean;
  },
): Promise<ContextualFillResult> {
  if (roster.source === 'sample') {
    const url = new URL(options.pageUrl ?? doc.URL);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/fixtures/')) {
      return { ok: false, reason: 'Example authors are for local practice only. Choose your manuscript roster in the extension.' };
    }
  }
  const detected = defaultRegistry.detect(doc, options.pageUrl);
  if (
    detected.platformId === 'unknown' ||
    !isFillablePlatform(detected.platformId) ||
    !mayFill(detected.confidence)
  ) {
    return {
      ok: false,
      reason:
        'This page is not a confidently recognized author form. Use the Corresponding popup.',
    };
  }

  const adapter = defaultRegistry.get(detected.platformId);
  if (!adapter) {
    return { ok: false, reason: 'Unsupported platform.' };
  }

  const payload =
    options.mode === 'one'
      ? options.author
        ? rosterForOneAuthor(roster, options.author)
        : null
      : roster;
  if (!payload || payload.authors.length === 0) {
    return { ok: false, reason: 'No author is available to fill.' };
  }

  const fillOptions = {
    overwrite: options.overwrite ?? false,
    dryRun: false as const,
    onlySequences:
      options.mode === 'one' && options.author
        ? [options.author.sequence]
        : undefined,
  };
  const preview = adapter.fill(doc, payload, { ...fillOptions, dryRun: true });
  if (preview.errors.length > 0) {
    return {
      ok: false,
      reason: preview.errors[0] ?? 'Fill preview failed.',
      report: preview,
    };
  }

  const report = adapter.fillAsync
    ? await adapter.fillAsync(doc, payload, fillOptions)
    : adapter.fill(doc, payload, fillOptions);
  if (report.errors.length > 0 || report.skippedConflicts > 0) {
    return {
      ok: false,
      reason: report.errors[0] ?? 'Some author fields conflicted with existing information and were preserved. Review them in the journal form.',
      report,
    };
  }
  return { ok: true, report };
}
