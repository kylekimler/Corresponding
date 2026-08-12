import { natureMtsAdapter } from '@/adapters/nature-mts/adapter';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import type { Roster } from '@/schema/author';

export interface BenchRow {
  authors: number;
  slots: number;
  inspectMs: number;
  previewMs: number;
  fillMs: number;
  validateMs: number;
}

function now(): number {
  return performance.now();
}

export function benchmarkNatureMts(
  makeRoster: (n: number) => Roster,
  sizes: number[] = [10, 75, 200, 500, 1000],
): BenchRow[] {
  const rows: BenchRow[] = [];
  for (const n of sizes) {
    const slots = Math.min(n, 200); // Cap DOM size; large n still stress dry-run planning
    mountNatureMtsFixture({ slots });
    const roster = makeRoster(n);

    let t0 = now();
    natureMtsAdapter.inspect(document);
    const inspectMs = now() - t0;

    t0 = now();
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: true });
    const previewMs = now() - t0;

    mountNatureMtsFixture({ slots });
    t0 = now();
    natureMtsAdapter.fill(document, roster, { overwrite: true, dryRun: false });
    const fillMs = now() - t0;

    t0 = now();
    natureMtsAdapter.validate(document, roster);
    const validateMs = now() - t0;

    rows.push({ authors: n, slots, inspectMs, previewMs, fillMs, validateMs });
  }
  return rows;
}

/** Generous CI thresholds (ms) to avoid flakes. */
export const PERF_THRESHOLDS: Record<
  number,
  { inspect: number; preview: number; fill: number; validate: number }
> = {
  10: { inspect: 100, preview: 150, fill: 200, validate: 150 },
  75: { inspect: 400, preview: 600, fill: 800, validate: 600 },
  200: { inspect: 1500, preview: 2000, fill: 2500, validate: 2000 },
  500: { inspect: 2000, preview: 3000, fill: 3500, validate: 3000 },
  1000: { inspect: 2500, preview: 4000, fill: 4500, validate: 3500 },
};
