import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadFixtureCorpus } from '@/fixtures/loadCorpus';
import { replayAllFixtures } from '@/fixtures/replay';

describe('fixture corpus replay', () => {
  it('replays all corpus fixtures and writes metrics', () => {
    const fixtures = loadFixtureCorpus().filter(
      (f) => !f.id.startsWith('template'),
    );
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
    const report = replayAllFixtures(fixtures);
    mkdirSync(path.resolve('reports'), { recursive: true });
    writeFileSync(
      path.resolve('reports/fixture-replay.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    expect(report.summary.fixtureCount).toBe(fixtures.length);
    expect(report.summary.detectionPassRate).toBe(1);
    expect(report.summary.mappingPassRate).toBe(1);
  });
});
