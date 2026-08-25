import { describe, expect, it, vi } from 'vitest';
import { pingCommunityHours, shouldPingCommunityHours } from '@/hours/ping';

describe('community hours ping', () => {
  it('does not ping during Vitest', () => {
    expect(shouldPingCommunityHours()).toBe(false);
  });

  it('posts only v and authors when enabled', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(['authors', 'v']);
      expect(body).toEqual({ v: 1, authors: 12 });
      expect(String(init?.body)).not.toMatch(/@|Ada|http/i);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    await expect(
      pingCommunityHours(12, {
        enabled: true,
        url: 'https://hours.test',
        fetch: fetchMock as unknown as typeof fetch,
      }),
    ).resolves.toBe('sent');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hours.test/ping',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('skips invalid counts and swallows network errors', async () => {
    expect(await pingCommunityHours(0, { enabled: true, url: 'https://hours.test' })).toBe(
      'skipped',
    );
    const boom = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(
      pingCommunityHours(3, {
        enabled: true,
        url: 'https://hours.test',
        fetch: boom as unknown as typeof fetch,
      }),
    ).resolves.toBe('failed');
  });
});
