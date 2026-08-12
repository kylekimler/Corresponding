export type ChaosOutcome = 'correct' | 'safe_fail' | 'unsafe';

export interface ChaosCaseReport {
  seed: number;
  ops: string[];
  outcome: ChaosOutcome;
  detail: string;
}

export interface ChaosSuiteReport {
  generatedAt: string;
  total: number;
  correct: number;
  safeFail: number;
  unsafe: number;
  cases: ChaosCaseReport[];
}

export function summarizeChaos(cases: ChaosCaseReport[]): ChaosSuiteReport {
  return {
    generatedAt: new Date().toISOString(),
    total: cases.length,
    correct: cases.filter((c) => c.outcome === 'correct').length,
    safeFail: cases.filter((c) => c.outcome === 'safe_fail').length,
    unsafe: cases.filter((c) => c.outcome === 'unsafe').length,
    cases,
  };
}
