import type { Author, Roster } from '@/schema/author';
import type { RequirementIssue } from './requirements';

/** Stable adapter id. New journals add a `sites/*.json` file; ids are kebab-case. */
export type PlatformId = string;

export interface DetectResult {
  platformId: PlatformId;
  confidence: number;
  label: string;
  evidence: string[];
}

export type FieldAction =
  | 'fill'
  | 'preserve'
  | 'overwrite'
  | 'skip_conflict'
  | 'missing_source'
  | 'unmapped';

export interface FieldPlan {
  fieldId: string;
  label: string;
  authorSequence?: number;
  action: FieldAction;
  currentValue?: string;
  proposedValue?: string;
  reason?: string;
}

export interface InspectReport {
  platformId: PlatformId;
  authorSlots: number;
  numAuthorsField?: number;
  linkedAuthorPids: Array<{ sequence: number; pid: string }>;
  fields: Array<{
    fieldId: string;
    tag: string;
    type?: string;
    value: string;
    label?: string;
  }>;
  dangerousControls: Array<{ id?: string; name?: string; text: string }>;
}

export interface FillOptions {
  /** When false (default), non-empty existing fields are preserved. */
  overwrite: boolean;
  /** When true, plan only — never mutate the DOM. When false, apply fills. */
  dryRun: boolean;
  /**
   * When set, only these roster sequences are written and count fields
   * are left alone. Used by contextual one-author fill.
   */
  onlySequences?: number[];
}

export interface FillReport {
  platformId: PlatformId;
  dryRun: boolean;
  overwrite: boolean;
  plans: FieldPlan[];
  filled: number;
  preserved: number;
  overwritten: number;
  skippedConflicts: number;
  missingSource: number;
  unmapped: number;
  warnings: string[];
  errors: string[];
  /**
   * Portal-specific fields this roster is missing. Reported separately from
   * errors: the fill still proceeds, but the portal will reject a save until
   * these are supplied.
   */
  requirements?: RequirementIssue[];
}

export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  fieldId?: string;
  authorSequence?: number;
}

export interface ValidateReport {
  platformId: PlatformId;
  ok: boolean;
  issues: ValidationIssue[];
  summary: {
    filledLike: number;
    missingEmail: number;
    conflicts: number;
    mismatchedCount: number;
  };
}

export interface PlatformAdapter {
  readonly id: PlatformId;
  readonly label: string;
  detect(doc: Document): DetectResult;
  inspect(doc: Document): InspectReport;
  fill(doc: Document, roster: Roster, options: FillOptions): FillReport;
  /** Optional orchestrator for portals that commit one modal per author. */
  fillAsync?(
    doc: Document,
    roster: Roster,
    options: FillOptions,
  ): Promise<FillReport>;
  validate(doc: Document, roster: Roster): ValidateReport;
}

export interface AdapterRegistry {
  list(): PlatformAdapter[];
  detect(doc: Document, url?: string): DetectResult;
  get(id: PlatformId): PlatformAdapter | undefined;
  require(id: PlatformId): PlatformAdapter;
}

/** Identity used to detect linked portal author conflicts. */
export interface LinkedAuthorIdentity {
  sequence: number;
  portalPid: string;
  email?: string;
  familyName?: string;
  givenName?: string;
}

export function authorDisplayName(author: Author): string {
  return [author.givenName, author.middleName, author.familyName]
    .filter(Boolean)
    .join(' ');
}
