import { SECONDS_PER_AUTHOR } from '@/popup/timeSaved';

export const HOURS_PING_VERSION = 1;
export const MAX_AUTHORS_PER_PING = 200;
export const DEFAULT_HOURS_COUNTER_URL =
  'https://corresponding-hours.kylekimler.workers.dev';

const PII_KEYS = new Set([
  'email',
  'emails',
  'name',
  'givenname',
  'familyname',
  'firstname',
  'lastname',
  'orcid',
  'roster',
  'rosterid',
  'url',
  'title',
  'abstract',
  'manuscript',
  'affiliation',
  'institution',
]);

export type HoursPingBody = {
  v: typeof HOURS_PING_VERSION;
  authors: number;
};

export type HoursStats = {
  authorsFilled: number;
  hoursSaved: number;
  secondsPerAuthor: number;
};

export function hoursFromAuthors(authors: number): number {
  return (Math.max(0, authors) * SECONDS_PER_AUTHOR) / 3600;
}

export function parseHoursPing(
  input: unknown,
): { ok: true; authors: number } | { ok: false; error: string } {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (PII_KEYS.has(key.toLowerCase())) {
      return { ok: false, error: 'body must not include personal data' };
    }
    if (key !== 'v' && key !== 'authors') {
      return { ok: false, error: 'unknown field' };
    }
  }
  if (record.v !== HOURS_PING_VERSION) {
    return { ok: false, error: 'unsupported ping version' };
  }
  const authors = record.authors;
  if (typeof authors !== 'number' || !Number.isInteger(authors)) {
    return { ok: false, error: 'authors must be an integer' };
  }
  if (authors < 1 || authors > MAX_AUTHORS_PER_PING) {
    return { ok: false, error: 'authors out of range' };
  }
  return { ok: true, authors };
}

export function applyPing(current: number, authors: number): number {
  const safeCurrent =
    typeof current === 'number' && Number.isFinite(current) && current > 0
      ? Math.floor(current)
      : 0;
  return safeCurrent + authors;
}

export function statsFromAuthors(authorsFilled: number): HoursStats {
  const filled = Math.max(0, Math.floor(authorsFilled));
  return {
    authorsFilled: filled,
    hoursSaved: Math.round(hoursFromAuthors(filled) * 10) / 10,
    secondsPerAuthor: SECONDS_PER_AUTHOR,
  };
}
