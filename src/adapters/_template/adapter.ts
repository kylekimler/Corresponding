import type { Roster } from '@/schema/author';
import { listDangerousControls } from '../safety';
import type {
  DetectResult,
  FillOptions,
  FillReport,
  InspectReport,
  PlatformAdapter,
  ValidateReport,
} from '../types';

/**
 * Template adapter — copy this module when a real anonymized fixture exists.
 * Do not invent selectors.
 */
export const templateAdapter: PlatformAdapter = {
  id: 'unknown',
  label: 'Template Adapter',

  detect(_doc: Document): DetectResult {
    return {
      platformId: 'unknown',
      confidence: 0,
      label: 'Template (not registered)',
      evidence: [],
    };
  },

  inspect(doc: Document): InspectReport {
    return {
      platformId: 'unknown',
      authorSlots: 0,
      linkedAuthorPids: [],
      fields: [],
      dangerousControls: listDangerousControls(doc),
    };
  },

  fill(_doc: Document, _roster: Roster, options: FillOptions): FillReport {
    return {
      platformId: 'unknown',
      dryRun: options.dryRun,
      overwrite: options.overwrite,
      plans: [],
      filled: 0,
      preserved: 0,
      overwritten: 0,
      skippedConflicts: 0,
      missingSource: 0,
      unmapped: 0,
      warnings: ['Template adapter — replace with fixture-backed selectors.'],
      errors: ['not_implemented'],
    };
  },

  validate(_doc: Document, _roster: Roster): ValidateReport {
    return {
      platformId: 'unknown',
      ok: false,
      issues: [
        {
          code: 'not_implemented',
          severity: 'error',
          message: 'Template adapter cannot validate.',
        },
      ],
      summary: {
        filledLike: 0,
        missingEmail: 0,
        conflicts: 0,
        mismatchedCount: 0,
      },
    };
  },
};
