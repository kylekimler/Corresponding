import type { FillReport } from '@/adapters/types';
import type { RosterSource } from '@/schema/author';

/** Approximate time a scientist spends re-entering one author by hand. */
export const SECONDS_PER_AUTHOR = 40;

export function countFilledAuthors(
  report: FillReport,
  filledLike?: number,
): number {
  const sequences = new Set<number>();
  for (const plan of report.plans) {
    if (
      plan.authorSequence !== undefined &&
      (plan.action === 'fill' || plan.action === 'overwrite')
    ) {
      sequences.add(plan.authorSequence);
    }
  }
  if (sequences.size > 0) return sequences.size;
  if (typeof filledLike === 'number' && filledLike > 0) return filledLike;
  return 0;
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatSavedDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 seconds';
  if (totalSeconds < 90) {
    const seconds = Math.max(1, Math.round(totalSeconds));
    return seconds === 1 ? '1 second' : `${seconds} seconds`;
  }
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 90) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  const hours = totalSeconds / 3600;
  if (hours < 10) {
    const rounded = Math.round(hours * 10) / 10;
    return rounded === 1 ? '1 hour' : `${formatNumber(rounded, 1)} hours`;
  }
  const whole = Math.round(hours);
  return whole === 1 ? '1 hour' : `${formatNumber(whole)} hours`;
}

export function formatFillDelight(authorCount: number): string | undefined {
  if (authorCount <= 0) return undefined;
  const authors =
    authorCount === 1
      ? '1 author filled'
      : `${formatNumber(authorCount)} authors filled`;
  const time = formatSavedDuration(authorCount * SECONDS_PER_AUTHOR);
  return `${authors}. You just got ${time} of your life back.`;
}

export function lifetimeHoursValue(authorCount: number): number {
  return (Math.max(0, authorCount) * SECONDS_PER_AUTHOR) / 3600;
}

export function formatLifetimeHours(authorCount: number): string {
  const hours = lifetimeHoursValue(authorCount);
  const display =
    hours > 0 && hours < 10 ? formatNumber(hours, 1) : formatNumber(Math.round(hours));
  return `Lifetime researcher hours saved: ${display}`;
}

export function countsTowardLifetime(input: {
  rosterSource: RosterSource;
  isDevelopmentFixture: boolean;
}): boolean {
  if (input.isDevelopmentFixture) return false;
  if (input.rosterSource === 'sample') return false;
  return true;
}
