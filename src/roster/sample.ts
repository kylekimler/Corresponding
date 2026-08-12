import { rowsToRoster } from '@/import/rosterFromTable';
import type { Roster } from '@/schema/author';

const SAMPLE_HEADERS = [
  'First Name',
  'Middle Name',
  'Last Name',
  'Email',
  'Institution',
  'City',
  'Country',
  'Corresponding',
];

const SAMPLE_ROWS = [
  [
    'Ada',
    '',
    'Lovelace',
    'ada@example.org',
    'Analytical Engines Institute',
    'London',
    'United Kingdom',
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
    source: 'manual',
    now,
  });
}
