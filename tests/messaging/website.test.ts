import { describe, expect, it } from 'vitest';
import {
  handleWebsiteRequest,
  isAllowedWebsiteOrigin,
  parseWebsiteRequest,
} from '@/messaging/website';
import { createMemoryPopupPreferences } from '@/popup/preferences';
import { createMemoryRosterStore } from '@/roster/storage';
import { makeNAuthors, makeRoster } from '../helpers/roster';

function deps() {
  return {
    store: createMemoryRosterStore(),
    preferences: createMemoryPopupPreferences(),
    mode: 'development' as const,
    version: '0.1.0-test',
  };
}

describe('website origin validation', () => {
  it('allows the first-party site in every mode', () => {
    expect(isAllowedWebsiteOrigin('https://corresponding.app', 'production')).toBe(
      true,
    );
    expect(isAllowedWebsiteOrigin('https://corresponding.app', 'development')).toBe(
      true,
    );
  });

  it('allows localhost only in development', () => {
    expect(isAllowedWebsiteOrigin('http://localhost:5173', 'development')).toBe(
      true,
    );
    expect(isAllowedWebsiteOrigin('http://127.0.0.1:4173', 'development')).toBe(
      true,
    );
    expect(isAllowedWebsiteOrigin('http://localhost:5173', 'production')).toBe(
      false,
    );
  });

  it('rejects empty, malformed, and third-party origins', () => {
    expect(isAllowedWebsiteOrigin('', 'development')).toBe(false);
    expect(isAllowedWebsiteOrigin('not a url', 'development')).toBe(false);
    expect(isAllowedWebsiteOrigin('https://evil.example', 'development')).toBe(
      false,
    );
    expect(
      isAllowedWebsiteOrigin('https://corresponding.app.evil.example', 'production'),
    ).toBe(false);
    expect(
      isAllowedWebsiteOrigin('https://pages.dev', 'production'),
    ).toBe(false);
  });
});

describe('website-to-extension protocol', () => {
  it('rejects fill and other journal operations from a webpage', () => {
    const parsed = parseWebsiteRequest({
      type: 'FILL',
      roster: makeRoster(makeNAuthors(1)),
      overwrite: false,
    });
    expect(parsed.ok).toBe(false);
  });

  it('rejects malformed incoming data', () => {
    expect(parseWebsiteRequest(null).ok).toBe(false);
    expect(parseWebsiteRequest({ type: 'SAVE_ROSTER' }).ok).toBe(false);
    expect(
      parseWebsiteRequest({
        type: 'SAVE_ROSTER',
        roster: { name: 'Broken' },
      }).ok,
    ).toBe(false);
  });

  it('does not touch storage when the origin is forbidden', async () => {
    const handler = deps();
    const response = await handleWebsiteRequest(
      { type: 'SAVE_ROSTER', roster: makeRoster(makeNAuthors(2), 'Secret') },
      'https://evil.example',
      handler,
    );
    expect(response).toMatchObject({ type: 'ERROR', code: 'FORBIDDEN' });
    expect(await handler.store.list()).toEqual([]);
  });

  it('saves a roster, selects it, and reads it back', async () => {
    const handler = deps();
    const roster = makeRoster(makeNAuthors(3), 'Gut atlas');
    const saved = await handleWebsiteRequest(
      { type: 'SAVE_ROSTER', roster },
      'http://localhost:5173',
      handler,
    );
    expect(saved.type).toBe('SAVED');
    const listed = await handleWebsiteRequest(
      { type: 'LIST_ROSTERS' },
      'http://localhost:5173',
      handler,
    );
    expect(listed).toMatchObject({
      type: 'ROSTER_LIST',
      rosters: [{ id: roster.id, name: 'Gut atlas', authorCount: 3 }],
    });
    const selected = await handleWebsiteRequest(
      { type: 'GET_SELECTED' },
      'http://localhost:5173',
      handler,
    );
    expect(selected.type).toBe('SELECTED_ROSTER');
    if (selected.type === 'SELECTED_ROSTER') {
      expect(selected.roster?.id).toBe(roster.id);
      expect(selected.roster?.authors).toHaveLength(3);
    }
  });

  it('answers PING without exposing roster data', async () => {
    const response = await handleWebsiteRequest(
      { type: 'PING' },
      'https://corresponding.app',
      { ...deps(), mode: 'production' },
    );
    expect(response).toEqual({ type: 'PONG', version: '0.1.0-test' });
  });
});
