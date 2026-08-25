import {
  DEFAULT_HOURS_COUNTER_URL,
  MAX_AUTHORS_PER_PING,
  parseHoursPing,
  type HoursPingBody,
} from './protocol';

export type HoursPingResult = 'sent' | 'skipped' | 'failed';

export function hoursCounterUrl(
  env: Record<string, unknown> = import.meta.env as Record<string, unknown>,
): string {
  const configured = env.VITE_HOURS_COUNTER_URL;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim().replace(/\/$/, '');
  }
  return DEFAULT_HOURS_COUNTER_URL;
}

export function shouldPingCommunityHours(
  env: Record<string, unknown> = import.meta.env as Record<string, unknown>,
): boolean {
  if (env.VITE_HOURS_COUNTER_DISABLE === '1' || env.VITE_HOURS_COUNTER_DISABLE === 'true') {
    return false;
  }
  if (env.VITEST === true || env.VITEST === 'true') return false;
  if (env.MODE === 'test') return false;
  return true;
}

/**
 * POST { v: 1, authors } to the Corresponding hours worker.
 * Never sends names, emails, URLs, or roster data. Failures are ignored
 * so marketing telemetry cannot break Fill.
 */
export async function pingCommunityHours(
  authors: number,
  options: {
    fetch?: typeof fetch;
    url?: string;
    enabled?: boolean;
  } = {},
): Promise<HoursPingResult> {
  const enabled = options.enabled ?? shouldPingCommunityHours();
  if (!enabled) return 'skipped';
  const parsed = parseHoursPing({
    v: 1,
    authors: Math.floor(authors),
  } satisfies HoursPingBody);
  if (!parsed.ok) return 'skipped';
  if (parsed.authors > MAX_AUTHORS_PER_PING) return 'skipped';

  const endpoint = `${options.url ?? hoursCounterUrl()}/ping`;
  const send = options.fetch ?? globalThis.fetch;
  if (typeof send !== 'function') return 'failed';

  try {
    const response = await send(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ v: 1, authors: parsed.authors }),
    });
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
