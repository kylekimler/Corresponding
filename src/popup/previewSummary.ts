import type { DetectResult, FieldPlan, FillReport } from '@/adapters/types';

export interface PreviewSummary {
  portalLabel: string;
  portalId: string;
  portalConfidence: number;
  dryRun: boolean;
  totalMappings: number;
  exactMappings: number;
  semanticMappings: number;
  preserved: number;
  unresolved: number;
  conflicts: number;
  overwritten: number;
  filled: number;
  evidence: string[];
  conflictLabels: string[];
  unresolvedLabels: string[];
  /** Short human status for the banner. */
  headline: string;
}

const EXACT_ID_RE =
  /^(num_authors|corr_auth_|contrib_auth_\d+_)/i;

function isExactPlatformField(plan: FieldPlan): boolean {
  return EXACT_ID_RE.test(plan.fieldId);
}

function actionable(plan: FieldPlan): boolean {
  return (
    plan.action === 'fill' ||
    plan.action === 'overwrite' ||
    plan.action === 'preserve'
  );
}

/**
 * Build a user-visible Preview summary from a dry-run (or fill) report.
 * Nature MTS plans use tested selectors → counted as exact/tested.
 * Semantic bucket reserved for generic recognizer-driven fills.
 */
export function summarizePreview(
  report: FillReport,
  detected?: DetectResult | null,
): PreviewSummary {
  const exactMappings = report.plans.filter(
    (p) =>
      (p.action === 'fill' || p.action === 'overwrite') &&
      isExactPlatformField(p),
  ).length;

  // Semantic: actionable plans that are not exact platform IDs (future adapters).
  const semanticMappings = report.plans.filter(
    (p) =>
      (p.action === 'fill' || p.action === 'overwrite') &&
      !isExactPlatformField(p),
  ).length;

  const totalMappings = report.plans.filter(actionable).length;
  const unresolved = report.missingSource + report.unmapped;
  const portalLabel = detected?.label || report.platformId;
  const portalId = detected?.platformId || report.platformId;

  const conflictLabels = report.plans
    .filter((p) => p.action === 'skip_conflict')
    .map((p) => p.label)
    .slice(0, 12);

  const unresolvedLabels = report.plans
    .filter((p) => p.action === 'missing_source' || p.action === 'unmapped')
    .map((p) => p.label)
    .slice(0, 12);

  const headline = report.dryRun
    ? `Preview ready — ${totalMappings} mappings, form unchanged`
    : `Fill complete — ${report.filled + report.overwritten} fields written`;

  return {
    portalLabel,
    portalId,
    portalConfidence: detected?.confidence ?? 0,
    dryRun: report.dryRun,
    totalMappings,
    exactMappings,
    semanticMappings,
    preserved: report.preserved,
    unresolved,
    conflicts: report.skippedConflicts,
    overwritten: report.overwritten,
    filled: report.filled,
    evidence: detected?.evidence?.slice(0, 6) ?? [],
    conflictLabels,
    unresolvedLabels,
    headline,
  };
}
