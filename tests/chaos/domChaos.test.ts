import { describe, expect, it, vi } from 'vitest';
import { natureMtsAdapter } from '@/adapters/nature-mts/adapter';
import { mountNatureMtsFixture } from '@/adapters/nature-mts/fixture';
import { applyChaos } from '@/chaos/mutateDom';
import { summarizeChaos, type ChaosCaseReport } from '@/chaos/report';
import { recognizeForm } from '@/recognition/recognize';
import { makeNAuthors, makeRoster } from '../helpers/roster';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

describe('DOM chaos harness', () => {
  it('prefers correct or safe-fail over unsafe fills across seeds', () => {
    const cases: ChaosCaseReport[] = [];
    const roster = makeRoster(makeNAuthors(2));

    for (let seed = 1; seed <= 40; seed += 1) {
      mountNatureMtsFixture({
        slots: 2,
        includeSubmitControls: true,
        authors: [
          { first: '', last: '', email: '' },
          { first: '', last: '', email: '' },
        ],
      });
      const chaos = applyChaos(document, { seed, ops: 6 });

      const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');
      const report = natureMtsAdapter.fill(document, roster, {
        overwrite: false,
        dryRun: false,
      });
      const clicked = clickSpy.mock.calls.length > 0;
      clickSpy.mockRestore();

      // Unsafe: wrote into a linked conflicting identity, or clicked submit.
      const linkedConflictSkipped = report.skippedConflicts > 0;
      const first1 = (
        document.getElementById('contrib_auth_1_first_nm') as HTMLInputElement | null
      )?.value;
      const wroteWrong =
        first1 === roster.authors[1]?.givenName &&
        first1 !== roster.authors[0]?.givenName;

      let outcome: ChaosCaseReport['outcome'] = 'correct';
      let detail = 'filled or preserved without cross-author corruption';
      if (clicked || wroteWrong) {
        outcome = 'unsafe';
        detail = clicked ? 'clicked control' : 'cross-author write';
      } else if (
        report.errors.length ||
        report.skippedConflicts ||
        report.filled === 0
      ) {
        outcome = linkedConflictSkipped || report.filled === 0 ? 'safe_fail' : 'correct';
        detail = report.warnings[0] ?? 'partial/safe';
      }

      // Recognition should never use hidden csrf values
      const recognition = recognizeForm(document);
      const leaked = JSON.stringify(recognition).includes('SHOULD_NEVER_BE_READ');
      if (leaked) {
        outcome = 'unsafe';
        detail = 'recognition inspected secret hidden value text unexpectedly';
      }

      cases.push({
        seed,
        ops: chaos.ops,
        outcome,
        detail,
      });
    }

    const summary = summarizeChaos(cases);
    mkdirSync(path.resolve('reports'), { recursive: true });
    writeFileSync(
      path.resolve('reports/chaos-report.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
    );

    expect(summary.unsafe).toBe(0);
    expect(summary.correct + summary.safeFail).toBe(summary.total);
  });
});
