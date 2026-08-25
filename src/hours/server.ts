import {
  applyPing,
  parseHoursPing,
  statsFromAuthors,
  type HoursStats,
} from './protocol';

export interface HoursStore {
  getAuthorsFilled(): Promise<number>;
  addAuthors(authors: number): Promise<number>;
}

export function createMemoryHoursStore(initial = 0): HoursStore {
  let authorsFilled = Math.max(0, Math.floor(initial));
  return {
    async getAuthorsFilled() {
      return authorsFilled;
    },
    async addAuthors(authors: number) {
      authorsFilled = applyPing(authorsFilled, authors);
      return authorsFilled;
    },
  };
}

export function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 256) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function handleHoursRequest(
  request: Request,
  store: HoursStore,
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/stats')) {
    const authorsFilled = await store.getAuthorsFilled();
    const stats: HoursStats = statsFromAuthors(authorsFilled);
    if (url.pathname === '/') {
      return new Response(
        `Corresponding has saved scientists an estimated ${stats.hoursSaved} hours (${stats.authorsFilled} authors × ${stats.secondsPerAuthor} seconds).\n`,
        { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', ...corsHeaders() } },
      );
    }
    return json(stats);
  }

  if (request.method === 'POST' && url.pathname === '/ping') {
    const type = request.headers.get('content-type') ?? '';
    if (!type.toLowerCase().includes('application/json')) {
      return json({ ok: false, error: 'json required' }, 415);
    }
    const parsed = parseHoursPing(await readJsonBody(request));
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
    const authorsFilled = await store.addAuthors(parsed.authors);
    return json({ ok: true, ...statsFromAuthors(authorsFilled) });
  }

  return json({ ok: false, error: 'not found' }, 404);
}
