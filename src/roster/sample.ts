import { rowsToRoster } from '@/import/rosterFromTable';
import type { Roster, RosterSource } from '@/schema/author';
import type { RosterStore } from '@/roster/storage';

const SAMPLE_HEADERS = [
  'First Name',
  'Middle Name',
  'Last Name',
  'Email',
  'Institution',
  'City',
  'Country',
  'Corresponding',
  'Equal contribution',
];

/**
 * Shaped like a real six-author paper: two shared first authors, ordered third
 * and fourth authors, then two shared corresponding senior authors.
 */
const SAMPLE_ROWS = [
  [
    'Ada',
    '',
    'Lovelace',
    'ada@example.org',
    'Analytical Engines Institute',
    'London',
    'United Kingdom',
    '',
    'yes',
  ],
  [
    'Alan',
    'Mathison',
    'Turing',
    'alan@example.org',
    'Computing Research Centre',
    'Bletchley',
    'United Kingdom',
    '',
    'yes',
  ],
  [
    'Chien-Shiung',
    '',
    'Wu',
    'chien-shiung@example.org',
    'Physics Research Laboratory',
    'New York',
    'United States',
    '',
    '',
  ],
  [
    'Émilie',
    '',
    'du Châtelet',
    'emilie@example.org',
    'Institut de Physique Théorique',
    'Paris',
    'France',
    '',
    '',
  ],
  [
    'Rosalind',
    'Elsie',
    'Franklin',
    'rosalind@example.org',
    'Structural Biology Unit',
    'London',
    'United Kingdom',
    'yes',
    '',
  ],
  [
    'Grace',
    'Brewster',
    'Hopper',
    'grace@example.org',
    'Naval Computing Laboratory',
    'Arlington',
    'United States',
    'yes',
    '',
  ],
];

const SAMPLE_MAPPING = {
  0: 'givenName',
  1: 'middleName',
  2: 'familyName',
  3: 'email',
  4: 'institution',
  5: 'city',
  6: 'country',
  7: 'isCorresponding',
  8: 'equalContribution',
} as const;

/**
 * A local, obviously non-user roster for first-run Preview/Fill practice.
 * It uses the same canonical table-import path as real paste/CSV imports.
 */
export function createSampleRoster(now?: string): Roster {
  return rowsToRoster({
    name: 'Sample research team',
    headers: SAMPLE_HEADERS,
    rows: SAMPLE_ROWS,
    mapping: SAMPLE_MAPPING,
    source: 'sample',
    now,
  });
}

/**
 * Atomically import at most one sample for a UI action, even if a user clicks
 * twice before React has rerendered.
 */
export async function importSampleRosterOnce(
  store: RosterStore,
  lock: { current: boolean },
): Promise<Roster | undefined> {
  if (lock.current) return undefined;
  lock.current = true;
  try {
    return await store.importRoster(createSampleRoster());
  } finally {
    lock.current = false;
  }
}

export function sampleFillBlockReason(
  source: RosterSource,
  hasSuccessfulPreview: boolean,
  isDevelopmentFixture: boolean,
): string | undefined {
  if (source !== 'sample') return undefined;
  if (!hasSuccessfulPreview) {
    return 'Preview the sample roster before filling the local test fixture.';
  }
  if (!isDevelopmentFixture) {
    return 'Sample rosters can only fill the local Nature test fixture. Import your authors for a real portal.';
  }
  return undefined;
}
