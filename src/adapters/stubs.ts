import type { Roster } from '@/schema/author';
import { listDangerousControls } from './safety';
import type {
  DetectResult,
  FillOptions,
  FillReport,
  InspectReport,
  PlatformAdapter,
  PlatformId,
  ValidateReport,
} from './types';

function emptyAdapter(
  id: PlatformId,
  label: string,
  hints: string[],
): PlatformAdapter {
  return {
    id,
    label,
    detect(doc: Document): DetectResult {
      const evidence: string[] = [];
      let hits = 0;
      for (const hint of hints) {
        if (
          doc.body?.innerHTML?.toLowerCase().includes(hint.toLowerCase()) ||
          doc.querySelector(`[id*="${hint}"], [name*="${hint}"]`)
        ) {
          evidence.push(hint);
          hits += 1;
        }
      }
      // Stubs never claim high confidence — real fixtures required before selectors.
      const confidence = hits > 0 ? Math.min(0.35, hits * 0.1) : 0;
      return {
        platformId: confidence > 0 ? id : 'unknown',
        confidence,
        label: confidence > 0 ? `${label} (unsupported — needs fixture)` : 'Unknown',
        evidence,
      };
    },
    inspect(doc: Document): InspectReport {
      return {
        platformId: id,
        authorSlots: 0,
        linkedAuthorPids: [],
        fields: [],
        dangerousControls: listDangerousControls(doc),
      };
    },
    fill(_doc: Document, _roster: Roster, options: FillOptions): FillReport {
      return {
        platformId: id,
        dryRun: options.dryRun,
        overwrite: options.overwrite,
        plans: [],
        filled: 0,
        preserved: 0,
        overwritten: 0,
        skippedConflicts: 0,
        missingSource: 0,
        unmapped: 0,
        warnings: [
          `${label} adapter is a stub. Provide a real DOM fixture before implementing selectors.`,
        ],
        errors: [`Unsupported platform: ${id}`],
      };
    },
    validate(_doc: Document, _roster: Roster): ValidateReport {
      return {
        platformId: id,
        ok: false,
        issues: [
          {
            code: 'unsupported_platform',
            severity: 'error',
            message: `${label} is not implemented yet. Use the diagnostic tool to capture a redacted form map.`,
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
}

export const editorialManagerStub = emptyAdapter(
  'editorial-manager',
  'Editorial Manager',
  ['editorial manager', 'editorialmanager'],
);

export const eJournalPressGenericStub = emptyAdapter(
  'ejournalpress-generic',
  'eJournalPress (generic)',
  ['ejournalpress', 'ejp'],
);
