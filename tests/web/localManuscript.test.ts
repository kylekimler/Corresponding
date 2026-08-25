import { describe, expect, it } from 'vitest';
import { createEmptyManuscript, touchManuscript } from '@/schema/manuscript';
import { addAuthor, removeAuthor, reorderAuthors } from '@/roster/mutations';
import {
  LOCAL_MANUSCRIPT_KEY,
  clearLocalManuscript,
  loadLocalManuscript,
  saveLocalManuscript,
} from '../../web/src/storage/localManuscript';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem(key: string) {
      return data[key] ?? null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
    removeItem(key: string) {
      delete data[key];
    },
    data,
  };
}

describe('web manuscript persistence', () => {
  it('saves and reloads a manuscript from local storage', () => {
    const storage = memoryStorage();
    let manuscript = createEmptyManuscript('Atlas');
    manuscript = touchManuscript(manuscript, {
      roster: addAuthor(manuscript.roster, {
        givenName: 'Ada',
        familyName: 'Lovelace',
      }),
    });
    saveLocalManuscript(manuscript, storage);
    expect(storage.data[LOCAL_MANUSCRIPT_KEY]).toContain('Ada');
    const loaded = loadLocalManuscript(storage);
    expect(loaded?.title).toBe('Atlas');
    expect(loaded?.roster.authors[0]?.familyName).toBe('Lovelace');
  });

  it('returns null for missing or malformed stored data', () => {
    expect(loadLocalManuscript(memoryStorage())).toBeNull();
    expect(
      loadLocalManuscript(memoryStorage({ [LOCAL_MANUSCRIPT_KEY]: '{' })),
    ).toBeNull();
    expect(
      loadLocalManuscript(
        memoryStorage({
          [LOCAL_MANUSCRIPT_KEY]: JSON.stringify({ title: 'Nope' }),
        }),
      ),
    ).toBeNull();
  });

  it('clears persistence', () => {
    const storage = memoryStorage();
    saveLocalManuscript(createEmptyManuscript('Atlas'), storage);
    clearLocalManuscript(storage);
    expect(loadLocalManuscript(storage)).toBeNull();
  });
});

describe('web roster edits', () => {
  it('reorders, edits, and deletes authors on the manuscript roster', () => {
    let manuscript = createEmptyManuscript('Edits');
    manuscript = touchManuscript(manuscript, {
      roster: addAuthor(manuscript.roster, {
        givenName: 'Ada',
        familyName: 'Lovelace',
      }),
    });
    manuscript = touchManuscript(manuscript, {
      roster: addAuthor(manuscript.roster, {
        givenName: 'Alan',
        familyName: 'Turing',
      }),
    });
    manuscript = touchManuscript(manuscript, {
      roster: reorderAuthors(manuscript.roster, 0, 1),
    });
    expect(manuscript.roster.authors.map((author) => author.givenName)).toEqual([
      'Alan',
      'Ada',
    ]);
    expect(manuscript.roster.authors.map((author) => author.sequence)).toEqual([
      1, 2,
    ]);
    manuscript = touchManuscript(manuscript, {
      roster: removeAuthor(manuscript.roster, manuscript.roster.authors[0]!.id),
    });
    expect(manuscript.roster.authors).toHaveLength(1);
    expect(manuscript.roster.authors[0]?.givenName).toBe('Ada');
    expect(manuscript.roster.authors[0]?.sequence).toBe(1);
  });
});
