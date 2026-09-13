import { RosterSchema, type Roster } from '@/schema/author';
import {
  createPopupPreferences,
  type PopupPreferences,
} from '@/popup/preferences';
import { createRosterStore, type RosterStore } from '@/roster/storage';
import { z } from 'zod';

export const PRODUCTION_WEBSITE_ORIGIN = 'https://corresponding.pages.dev';

export type WebsiteBuildMode = 'development' | 'production';

const WebsitePingSchema = z.object({ type: z.literal('PING') });
const WebsiteListSchema = z.object({ type: z.literal('LIST_ROSTERS') });
const WebsiteGetSchema = z.object({
  type: z.literal('GET_ROSTER'),
  id: z.string().min(1),
});
const WebsiteSaveSchema = z.object({
  type: z.literal('SAVE_ROSTER'),
  roster: RosterSchema,
});
const WebsiteSelectSchema = z.object({
  type: z.literal('SELECT_ROSTER'),
  id: z.string().min(1),
});
const WebsiteGetSelectedSchema = z.object({
  type: z.literal('GET_SELECTED'),
});

/**
 * Website → extension allowlist. Fill / detect / inspect / diagnostic
 * are intentionally absent so a webpage cannot trigger portal mutation.
 */
export const WebsiteRequestSchema = z.discriminatedUnion('type', [
  WebsitePingSchema,
  WebsiteListSchema,
  WebsiteGetSchema,
  WebsiteSaveSchema,
  WebsiteSelectSchema,
  WebsiteGetSelectedSchema,
]);

export type WebsiteRequest = z.infer<typeof WebsiteRequestSchema>;

export type WebsiteRosterSummary = {
  id: string;
  name: string;
  authorCount: number;
  updatedAt: string;
};

export type WebsiteResponse =
  | { type: 'PONG'; version: string }
  | { type: 'ROSTER_LIST'; rosters: WebsiteRosterSummary[] }
  | { type: 'ROSTER'; roster: Roster }
  | { type: 'SAVED'; roster: Roster }
  | { type: 'SELECTED'; id: string }
  | { type: 'SELECTED_ROSTER'; roster: Roster | null }
  | {
      type: 'ERROR';
      code: 'FORBIDDEN' | 'INVALID' | 'NOT_FOUND' | 'INVALID_ROSTER';
      message: string;
    };

export interface WebsiteHandlerDeps {
  store: RosterStore;
  preferences: PopupPreferences;
  mode: WebsiteBuildMode;
  version: string;
}

export function isAllowedWebsiteOrigin(
  origin: string,
  mode: WebsiteBuildMode,
): boolean {
  if (!origin) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin === PRODUCTION_WEBSITE_ORIGIN) return true;
  const localHost =
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  // Local Vite supports development and unpacked-install practice.
  // Other remote origins are never allowed, regardless of build mode.
  void mode;
  return localHost && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
}

export function parseWebsiteRequest(message: unknown):
  | { ok: true; request: WebsiteRequest }
  | { ok: false; error: string } {
  const result = WebsiteRequestSchema.safeParse(message);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues
        .slice(0, 3)
        .map((issue) => issue.message)
        .join('; '),
    };
  }
  return { ok: true, request: result.data };
}

function summarize(roster: Roster): WebsiteRosterSummary {
  return {
    id: roster.id,
    name: roster.name,
    authorCount: roster.authors.length,
    updatedAt: roster.updatedAt,
  };
}

export async function handleWebsiteRequest(
  message: unknown,
  origin: string,
  deps: WebsiteHandlerDeps,
): Promise<WebsiteResponse> {
  if (!isAllowedWebsiteOrigin(origin, deps.mode)) {
    return {
      type: 'ERROR',
      code: 'FORBIDDEN',
      message: 'This page is not allowed to talk to Corresponding.',
    };
  }

  const parsed = parseWebsiteRequest(message);
  if (!parsed.ok) {
    return {
      type: 'ERROR',
      code: 'INVALID',
      message: `Invalid website message: ${parsed.error}`,
    };
  }

  const request = parsed.request;
  try {
    switch (request.type) {
      case 'PING':
        return { type: 'PONG', version: deps.version };
      case 'LIST_ROSTERS': {
        const rosters = await deps.store.list();
        return {
          type: 'ROSTER_LIST',
          rosters: rosters.map(summarize),
        };
      }
      case 'GET_ROSTER': {
        const roster = await deps.store.get(request.id);
        if (!roster) {
          return {
            type: 'ERROR',
            code: 'NOT_FOUND',
            message: 'Roster not found.',
          };
        }
        return { type: 'ROSTER', roster };
      }
      case 'GET_SELECTED': {
        const selectedId = await deps.preferences.getSelectedRosterId();
        const roster = selectedId ? await deps.store.get(selectedId) : undefined;
        return { type: 'SELECTED_ROSTER', roster: roster ?? null };
      }
      case 'SAVE_ROSTER': {
        const roster = await deps.store.save(request.roster);
        await deps.preferences.setSelectedRosterId(roster.id);
        return { type: 'SAVED', roster };
      }
      case 'SELECT_ROSTER': {
        const roster = await deps.store.get(request.id);
        if (!roster) {
          return {
            type: 'ERROR',
            code: 'NOT_FOUND',
            message: 'Roster not found.',
          };
        }
        await deps.preferences.setSelectedRosterId(roster.id);
        return { type: 'SELECTED', id: roster.id };
      }
      default:
        return {
          type: 'ERROR',
          code: 'INVALID',
          message: 'Unknown website message type',
        };
    }
  } catch (error) {
    return {
      type: 'ERROR',
      code: 'INVALID_ROSTER',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createWebsiteHandlerDeps(
  overrides: Partial<WebsiteHandlerDeps> = {},
): WebsiteHandlerDeps {
  return {
    store: overrides.store ?? createRosterStore(),
    preferences: overrides.preferences ?? createPopupPreferences(),
    mode: overrides.mode ?? 'development',
    version: overrides.version ?? '0.0.0-test',
  };
}
