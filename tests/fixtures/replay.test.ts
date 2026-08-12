import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { replayAllFixtures } from '@/fixtures/replay';

const REPORT_PATH = path.resolve(__dirname, '../../reports/fixture-replay.json');

describe('fixture replay corpus', () => {
  it('replays all adapters and recognition against corpus fixtures', () => {
    const report = replayAllFixtures();
    mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    expect(report.summary.fixtureCount).toBeGreaterThanOrEqual(3);
    expect(report.summary.adapterCount).toBeGreaterThanOrEqual(4);
    expect(report.fixtures.some((f) => f.fixtureId === 'nature-mts-synthetic')).toBe(
      true,
    );
    expect(report.fixtures.some((f) => f.fixtureId === 'generic-numbered-authors')).toBe(
      true,
    );
    expect(report.fixtures.some((f) => f.fixtureId === 'ambiguous-unlabeled-form')).toBe(
      true,
    );

    const nature = report.fixtures.find((f) => f.fixtureId === 'nature-mts-synthetic');
    expect(nature?.detection.pass).toBe(true);
    expect(nature?.adapters.some((a) => a.adapterId === 'nature-mts' && a.isExpectedPlatform)).toBe(
      true,
    );

    const generic = report.fixtures.find(
      (f) => f.fixtureId === 'generic-numbered-authors',
    );
    expect(generic?.mappings.passed).toBeGreaterThan(0);

    const ambiguous = report.fixtures.find(
      (f) => f.fixtureId === 'ambiguous-unlabeled-form',
    );
    expect(ambiguous?.mappings.expected).toBe(0);
  });
});
