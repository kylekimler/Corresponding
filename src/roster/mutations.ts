import {
  ROSTER_SCHEMA_VERSION,
  type Author,
  type Roster,
} from '@/schema/author';

export function renameRoster(roster: Roster, name: string): Roster {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Roster name cannot be empty');
  return { ...roster, name: trimmed };
}

export function reorderAuthors(
  roster: Roster,
  fromIndex: number,
  toIndex: number,
): Roster {
  const authors = [...roster.authors].sort((a, b) => a.sequence - b.sequence);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= authors.length ||
    toIndex >= authors.length
  ) {
    throw new Error('Invalid author reorder index');
  }
  const [moved] = authors.splice(fromIndex, 1);
  authors.splice(toIndex, 0, moved!);
  return {
    ...roster,
    authors: authors.map((a, i) => ({ ...a, sequence: i + 1 })),
  };
}

export function updateAuthor(
  roster: Roster,
  authorId: string,
  patch: Partial<Omit<Author, 'id'>>,
): Roster {
  const authors = roster.authors.map((a) =>
    a.id === authorId ? { ...a, ...patch, id: a.id } : a,
  );
  if (!authors.some((a) => a.id === authorId)) {
    throw new Error(`Author not found: ${authorId}`);
  }
  return { ...roster, authors };
}

export function setCorrespondingAuthor(
  roster: Roster,
  authorId: string,
): Roster {
  return {
    ...roster,
    authors: roster.authors.map((a) => ({
      ...a,
      isCorresponding: a.id === authorId,
    })),
  };
}

export function createEmptyRoster(name = 'New roster'): Roster {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    authors: [],
    schemaVersion: ROSTER_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    source: 'manual',
  };
}
