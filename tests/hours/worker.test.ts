import { describe, expect, it } from 'vitest';
import { createMemoryHoursStore, handleHoursRequest } from '@/hours/server';

describe('hours counter backend', () => {
  it('increments on ping and serves marketing stats', async () => {
    const store = createMemoryHoursStore();
    const ping = await handleHoursRequest(
      new Request('https://hours.test/ping', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ v: 1, authors: 12 }),
      }),
      store,
    );
    expect(ping.status).toBe(200);
    const pinged = (await ping.json()) as { authorsFilled: number };
    expect(pinged.authorsFilled).toBe(12);

    const again = await handleHoursRequest(
      new Request('https://hours.test/ping', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ v: 1, authors: 3 }),
      }),
      store,
    );
    expect(((await again.json()) as { authorsFilled: number }).authorsFilled).toBe(15);

    const stats = await handleHoursRequest(
      new Request('https://hours.test/stats'),
      store,
    );
    expect(await stats.json()).toEqual({
      authorsFilled: 15,
      hoursSaved: 0.2,
      secondsPerAuthor: 40,
    });
  });

  it('refuses personal data and unknown fields', async () => {
    const store = createMemoryHoursStore();
    const res = await handleHoursRequest(
      new Request('https://hours.test/ping', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          v: 1,
          authors: 2,
          email: 'ada@example.org',
        }),
      }),
      store,
    );
    expect(res.status).toBe(400);
    expect(await store.getAuthorsFilled()).toBe(0);
  });
});
