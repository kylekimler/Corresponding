import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  PERF_THRESHOLDS,
  benchmarkNatureMts,
} from '@/perf/benchmark';
import { makeNAuthors, makeRoster } from '../helpers/roster';

describe('performance benchmarks', () => {
  it('measures inspect/preview/fill/validate within generous thresholds', () => {
    const rows = benchmarkNatureMts((n) => makeRoster(makeNAuthors(Math.min(n, 200)).concat(
      n > 200
        ? makeNAuthors(n - 200).map((a, i) => ({
            ...a,
            sequence: 201 + i,
            givenName: `Given${201 + i}`,
            familyName: `Family${201 + i}`,
            email: `author${201 + i}@example.org`,
            isCorresponding: false,
          }))
        : [],
    )), [10, 75, 200, 500, 1000]);

    mkdirSync(path.resolve('reports'), { recursive: true });
    writeFileSync(
      path.resolve('reports/perf-benchmark.json'),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`,
    );

    for (const row of rows) {
      const t = PERF_THRESHOLDS[row.authors];
      if (!t) continue;
      expect(row.inspectMs).toBeLessThan(t.inspect);
      expect(row.previewMs).toBeLessThan(t.preview);
      expect(row.fillMs).toBeLessThan(t.fill);
      expect(row.validateMs).toBeLessThan(t.validate);
    }
  });
});
