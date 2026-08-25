import { z } from 'zod';
import {
  ROSTER_SCHEMA_VERSION,
  RosterSchema,
  type Roster,
} from './author';

export const MANUSCRIPT_SCHEMA_VERSION = 1;

export const ManuscriptSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  targetVenue: z.string().optional(),
  roster: RosterSchema,
  schemaVersion: z.literal(MANUSCRIPT_SCHEMA_VERSION),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Manuscript = z.infer<typeof ManuscriptSchema>;

export function createEmptyManuscript(
  title = '',
  now = new Date().toISOString(),
): Manuscript {
  const id = crypto.randomUUID();
  return {
    id,
    title,
    roster: {
      id,
      name: title.trim() || 'Untitled manuscript',
      authors: [],
      schemaVersion: ROSTER_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      source: 'web',
    },
    schemaVersion: MANUSCRIPT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

/** Roster the extension stores and fills. Title becomes the roster name. */
export function compileManuscriptRoster(manuscript: Manuscript): Roster {
  const title = manuscript.title.trim() || 'Untitled manuscript';
  return RosterSchema.parse({
    ...manuscript.roster,
    id: manuscript.roster.id || manuscript.id,
    name: title,
    source: manuscript.roster.source === 'sample' ? 'sample' : 'web',
    updatedAt: manuscript.updatedAt,
  });
}

export function touchManuscript(
  manuscript: Manuscript,
  patch: Partial<Pick<Manuscript, 'title' | 'targetVenue' | 'roster'>>,
  now = new Date().toISOString(),
): Manuscript {
  const next: Manuscript = {
    ...manuscript,
    ...patch,
    updatedAt: now,
  };
  if (patch.roster) {
    next.roster = {
      ...patch.roster,
      updatedAt: now,
    };
  }
  return ManuscriptSchema.parse(next);
}

export function serializeManuscript(manuscript: Manuscript): string {
  return `${JSON.stringify(ManuscriptSchema.parse(manuscript), null, 2)}\n`;
}

export function parseManuscriptJson(raw: unknown): Manuscript {
  return ManuscriptSchema.parse(raw);
}

export function parseManuscriptJsonSafe(raw: unknown): {
  manuscript: Manuscript | null;
  error?: string;
} {
  const result = ManuscriptSchema.safeParse(raw);
  if (result.success) return { manuscript: result.data };
  return {
    manuscript: null,
    error: result.error.issues
      .slice(0, 3)
      .map((issue) => issue.message)
      .join('; '),
  };
}
