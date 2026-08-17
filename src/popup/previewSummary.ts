import { describeRequirementIssue } from '@/adapters/requirements';
import type {
  DetectResult,
  FieldPlan,
  FillReport,
  PlatformId,
} from '@/adapters/types';

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
  errors: string[];
  /** Portal-required fields this roster is missing, already explained. */
  requirementNotices: string[];
  authorGroups: AuthorPreviewGroup[];
  /** Short human status for the banner. */
  headline: string;
}

export interface AuthorPreviewGroup {
  authorSequence: number;
  selectorConfidence: 'exact' | 'semantic' | 'unresolved';
  completeness: 'complete' | 'needs-attention';
  exactMappings: number;
  semanticMappings: number;
  preserved: number;
  unresolved: number;
  conflicts: number;
}

const EXACT_ID_RE =
  /^(num_authors|corr_auth_|contrib_auth_\d+_)/i;

function isExactPlatformField(plan: FieldPlan, platformId: PlatformId): boolean {
  return platformId === 'nature-mts' && EXACT_ID_RE.test(plan.fieldId);
}

function actionable(plan: FieldPlan): boolean {
  return (
    plan.action === 'fill' ||
    plan.action === 'overwrite' ||
    plan.action === 'preserve'
  );
}

function summarizeAuthorGroups(
  plans: FieldPlan[],
  platformId: PlatformId,
): AuthorPreviewGroup[] {
  const grouped = new Map<number, FieldPlan[]>();
  for (const plan of plans) {
    if (plan.authorSequence === undefined) continue;
    const existing = grouped.get(plan.authorSequence) ?? [];
    existing.push(plan);
    grouped.set(plan.authorSequence, existing);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([authorSequence, authorPlans]) => {
      const actionablePlans = authorPlans.filter(actionable);
      const exactMappings = actionablePlans.filter((plan) =>
        isExactPlatformField(plan, platformId),
      ).length;
      const semanticMappings = actionablePlans.length - exactMappings;
      const selectorConfidence =
        semanticMappings > 0
          ? 'semantic'
          : exactMappings > 0
            ? 'exact'
            : 'unresolved';
      const unresolved = authorPlans.filter(
        (p) => p.action === 'missing_source' || p.action === 'unmapped',
      ).length;
      const conflicts = authorPlans.filter(
        (p) => p.action === 'skip_conflict',
      ).length;
      return {
        authorSequence,
        selectorConfidence,
        completeness:
          unresolved > 0 || conflicts > 0 ? 'needs-attention' : 'complete',
        exactMappings,
        semanticMappings,
        preserved: authorPlans.filter((p) => p.action === 'preserve').length,
        unresolved,
        conflicts,
      };
    });
}

/**
 * Build a user-visible Preview summary from a dry-run (or fill) report.
 * Nature MTS plans use tested selectors → counted as exact/tested.
 * Semantic bucket reserved for generic recognizer-driven fills.
 */
export function summarizePreview(
  report: FillReport,
  detected?: DetectResult | null,
  authorCount = 0,
): PreviewSummary {
  const exactMappings = report.plans.filter(
    (p) =>
      (p.action === 'fill' || p.action === 'overwrite') &&
      isExactPlatformField(p, report.platformId),
  ).length;

  // Semantic: actionable plans that are not exact platform IDs (future adapters).
  const semanticMappings = report.plans.filter(
    (p) =>
      (p.action === 'fill' || p.action === 'overwrite') &&
      !isExactPlatformField(p, report.platformId),
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
    ? report.errors.length > 0
      ? `Preview found ${report.errors.length} blocking issue${report.errors.length === 1 ? '' : 's'} — form unchanged`
      : `Preview ready — ${totalMappings} mappings, form unchanged`
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
    errors: report.errors.slice(0, 12),
    requirementNotices: (report.requirements ?? [])
      .slice(0, 8)
      .map((issue) => describeRequirementIssue(issue, authorCount)),
    authorGroups: summarizeAuthorGroups(report.plans, report.platformId),
    headline,
  };
}
