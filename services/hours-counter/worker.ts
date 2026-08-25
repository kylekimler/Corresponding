import { handleHoursRequest, type HoursStore } from '../../src/hours/server';
import { applyPing } from '../../src/hours/protocol';

interface HoursKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

const AUTHORS_KEY = 'authors_filled';

function kvStore(kv: HoursKv): HoursStore {
  return {
    async getAuthorsFilled() {
      const raw = await kv.get(AUTHORS_KEY);
      const n = raw ? Number.parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    },
    async addAuthors(authors: number) {
      const next = applyPing(await this.getAuthorsFilled(), authors);
      await kv.put(AUTHORS_KEY, String(next));
      return next;
    },
  };
}

export default {
  async fetch(request: Request, env: { HOURS?: HoursKv }): Promise<Response> {
    const store = env.HOURS
      ? kvStore(env.HOURS)
      : {
          authors: 0,
          async getAuthorsFilled() {
            return this.authors;
          },
          async addAuthors(authors: number) {
            this.authors = applyPing(this.authors, authors);
            return this.authors;
          },
        };
    return handleHoursRequest(request, store);
  },
};
