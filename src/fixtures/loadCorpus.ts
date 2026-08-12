import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { FixtureCorpusEntry } from './corpus';

const CORPUS_DIR = path.resolve(__dirname, '../../fixtures/corpus');

/** Load all community fixture JSON files from fixtures/corpus/. */
export function loadFixtureCorpus(
  corpusDir: string = CORPUS_DIR,
): FixtureCorpusEntry[] {
  const files = readdirSync(corpusDir)
    .filter(
      (f) =>
        f.endsWith('.json') &&
        f !== 'schema.json' &&
        !f.startsWith('template') &&
        !f.endsWith('.fixture.json'),
    )
    .sort();

  return files.map((file) => {
    const raw = readFileSync(path.join(corpusDir, file), 'utf8');
    return JSON.parse(raw) as FixtureCorpusEntry;
  });
}

export function getCorpusDir(): string {
  return CORPUS_DIR;
}
