/**
 * Explicit safe failure states for Corresponding.
 * Every failure tells the user what was understood, what was not,
 * whether fields were modified, and what to do next.
 */

export type FailureCode =
  | 'unknown_portal'
  | 'partially_recognized_portal'
  | 'changed_known_portal'
  | 'unsupported_required_field'
  | 'missing_author_blocks'
  | 'wrong_author_block_count'
  | 'country_option_unavailable'
  | 'linked_account_mismatch'
  | 'malformed_imported_roster'
  | 'corrupted_local_storage';

export interface FailureState {
  code: FailureCode;
  title: string;
  understood: string;
  notUnderstood: string;
  fieldsModified: boolean;
  nextSteps: string[];
}

const CATALOG: Record<FailureCode, Omit<FailureState, 'fieldsModified'> & { fieldsModified: boolean }> = {
  unknown_portal: {
    code: 'unknown_portal',
    title: 'Portal not recognized',
    understood: 'This page does not match a tested submission platform.',
    notUnderstood: 'Author field layout for automatic fill.',
    fieldsModified: false,
    nextSteps: [
      'Use Diagnostics to capture a redacted structural map.',
      'Import or edit your roster locally — nothing was written to the page.',
      'Fill manually, or share the diagnostic with Corresponding support.',
    ],
  },
  partially_recognized_portal: {
    code: 'partially_recognized_portal',
    title: 'Partially recognized portal',
    understood: 'Some author-like fields were detected with mixed confidence.',
    notUnderstood: 'Enough high-confidence mappings to fill safely.',
    fieldsModified: false,
    nextSteps: [
      'Review unresolved fields in Preview.',
      'Confirm mappings explicitly before Fill.',
      'Prefer a tested platform adapter when available.',
    ],
  },
  changed_known_portal: {
    code: 'changed_known_portal',
    title: 'Known portal looks different',
    understood: 'This resembles a supported platform, but expected fields are missing or renamed.',
    notUnderstood: 'Whether automatic fill would target the correct controls.',
    fieldsModified: false,
    nextSteps: [
      'Do not Fill until Preview looks correct.',
      'Capture Diagnostics for adapter maintenance.',
    ],
  },
  unsupported_required_field: {
    code: 'unsupported_required_field',
    title: 'Required field unsupported',
    understood: 'The roster and most mapped fields.',
    notUnderstood: 'At least one required portal field Corresponding cannot map.',
    fieldsModified: false,
    nextSteps: [
      'Complete the unsupported field manually after Fill, or skip Fill.',
    ],
  },
  missing_author_blocks: {
    code: 'missing_author_blocks',
    title: 'No author blocks found',
    understood: 'The active tab content.',
    notUnderstood: 'Repeated author entry groups on this page.',
    fieldsModified: false,
    nextSteps: [
      'Open the author-entry step of the submission form.',
      'Run Diagnostics if the author form is visible but undetected.',
    ],
  },
  wrong_author_block_count: {
    code: 'wrong_author_block_count',
    title: 'Author count mismatch',
    understood: 'Your roster size and the number of author slots on the page.',
    notUnderstood: 'How to place extra authors without a portal control to add slots.',
    fieldsModified: false,
    nextSteps: [
      'Add or remove author slots in the journal portal to match your roster.',
      'Preview again before Fill.',
    ],
  },
  country_option_unavailable: {
    code: 'country_option_unavailable',
    title: 'Country option unavailable',
    understood: 'The author country value in your roster.',
    notUnderstood: 'A matching select option on the portal.',
    fieldsModified: false,
    nextSteps: [
      'Choose the closest country manually after Fill.',
      'Update the roster country string to match portal wording.',
    ],
  },
  linked_account_mismatch: {
    code: 'linked_account_mismatch',
    title: 'Linked account conflict',
    understood: 'A portal-linked author identity that differs from your roster.',
    notUnderstood: 'Permission to overwrite that linked record.',
    fieldsModified: false,
    nextSteps: [
      'Corresponding will not overwrite the linked identity.',
      'Resolve the conflict in the portal or adjust the roster order.',
    ],
  },
  malformed_imported_roster: {
    code: 'malformed_imported_roster',
    title: 'Imported roster is malformed',
    understood: 'That an import was attempted.',
    notUnderstood: 'A complete mapping of given and family names for each row.',
    fieldsModified: false,
    nextSteps: [
      'Confirm column mapping.',
      'Ensure each author row has a first/given and last/family name.',
    ],
  },
  corrupted_local_storage: {
    code: 'corrupted_local_storage',
    title: 'Local storage needs repair',
    understood: 'Some saved roster bytes could not be parsed cleanly.',
    notUnderstood: 'The original corrupted records.',
    fieldsModified: false,
    nextSteps: [
      'Re-import from CSV/JSON backup if available.',
      'Delete unreadable rosters from local storage.',
    ],
  },
};

export function failureState(
  code: FailureCode,
  overrides?: Partial<Pick<FailureState, 'understood' | 'notUnderstood' | 'fieldsModified' | 'nextSteps'>>,
): FailureState {
  return { ...CATALOG[code], ...overrides, code };
}

export function formatFailure(state: FailureState): string {
  return [
    state.title,
    `Understood: ${state.understood}`,
    `Could not understand: ${state.notUnderstood}`,
    `Fields modified: ${state.fieldsModified ? 'yes' : 'no'}`,
    'Next:',
    ...state.nextSteps.map((s) => `• ${s}`),
  ].join('\n');
}
